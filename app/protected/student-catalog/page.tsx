'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPublicBooksCached, getCategoriesCached } from '@/lib/actions/public-catalog';
import Image from 'next/image';
import {
  Search,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import Link from 'next/link';

type CatalogBook = {
  id: string;
  title: string;
  author: string;
  isbn?: string | null;
  cover_url?: string | null;
  available_copies: number;
  total_copies: number;
  section?: string | null;
};

type CatalogCategory = {
  id: string;
  name: string;
};

export default function StudentCatalogPage() {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const pageSize = 16;
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'availability'>('title');

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategoriesCached();
        setCategories(data);
      } catch (err) {
        console.error(err);
      }
    }
    loadCategories();
  }, []);

  const loadBooks = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await getPublicBooksCached(
        query,
        selectedCategory,
        '',
        availableOnly,
        currentPage,
        pageSize,
      );

      setBooks(result.books);
      setTotalBooks(result.total);
    } catch (err) {
      console.error(err);
      setLoadError('Unable to load catalog right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, availableOnly, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedCategory, availableOnly]);

  useEffect(() => {
    void loadBooks(page);
  }, [page, loadBooks]);

  const clearFilters = () => {
    setSelectedCategory('');
    setAvailableOnly(false);
    setQuery('');
    setSortBy('title');
  };

  const displayBooks = [...books].sort((a, b) => {
    if (sortBy === 'author') return a.author.localeCompare(b.author);
    if (sortBy === 'availability') return b.available_copies - a.available_copies;
    return a.title.localeCompare(b.title);
  });

  return (
    <AdminTableShell
      title="Book Catalog"
      description="Browse available books, sections, and current shelf availability."
      feedback={
        loadError ? <div className="status-danger rounded-lg px-3 py-2 text-sm">{loadError}</div> : null
      }
      controls={
        <>
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search title, author, or ISBN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Select
              value={selectedCategory || 'all'}
              onValueChange={(value) => setSelectedCategory(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="h-8 min-w-[170px] px-2.5 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={availableOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAvailableOnly((prev) => !prev)}
              className="h-8 px-3 text-xs"
            >
              Available only
            </Button>

            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="h-8 min-w-[140px] px-2.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="author">Author</SelectItem>
                  <SelectItem value="availability">Availability</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(selectedCategory || availableOnly || query || sortBy !== 'title') && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2.5 text-xs">
                Clear
              </Button>
            )}
          </div>
        </>
      }
      pagination={
        !loading && totalBooks > 0 ? (
          <CompactPagination
            page={page}
            totalItems={totalBooks}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : null
      }
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Title</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Author</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Section</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Availability</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Loading catalog...
              </td>
            </tr>
          ) : displayBooks.length > 0 ? (
            displayBooks.map((book) => (
              <tr key={book.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-10 w-8 overflow-hidden rounded border border-border bg-muted">
                      {book.cover_url ? (
                        <Image src={book.cover_url} alt={book.title} fill sizes="32px" className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{book.title}</p>
                      <p className="truncate text-xs text-muted-foreground">ISBN: {book.isbn || 'N/A'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{book.author}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{book.section || 'General'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      book.available_copies > 0 ? 'status-success' : 'status-warning'
                    }`}
                  >
                    {book.available_copies}/{book.total_copies}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/protected/student-catalog/${book.id}`}>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                      Open
                    </Button>
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No books found for the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </AdminTableShell>
  );
}
