'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
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

type CatalogCategory = {
  id: string;
  name: string;
};

function StudentCatalogData() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 16;
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'availability'>('title');

  const handleQueryChange = (val: string) => { setQuery(val); setPage(1); };
  const handleCatChange = (val: string) => { setSelectedCategory(val === 'all' ? '' : val); setPage(1); };
  const handleAvailableToggle = () => { setAvailableOnly(p => !p); setPage(1); };

  const clearFilters = () => {
    setSelectedCategory('');
    setAvailableOnly(false);
    setQuery('');
    setSortBy('title');
    setPage(1);
  };

  const { data: categories = [] } = useSWR('public-categories', () => getCategoriesCached(), { suspense: true });

  const swrKey = ['student-books', query, selectedCategory, availableOnly, page, pageSize];
  const { data: booksData, error } = useSWR(
    swrKey,
    () => getPublicBooksCached(query, selectedCategory, '', availableOnly, page, pageSize),
    { keepPreviousData: true, suspense: true }
  );

  const books = booksData?.books || [];
  const totalBooks = booksData?.total || 0;

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
        error ? <div className="status-danger rounded-lg px-3 py-2 text-sm">Unable to load catalog right now. Please try again.</div> : null
      }
      controls={
        <>
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search title, author, or ISBN"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Select
              value={selectedCategory || 'all'}
              onValueChange={handleCatChange}
            >
              <SelectTrigger className="h-8 min-w-[170px] px-2.5 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category: CatalogCategory) => (
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
              onClick={handleAvailableToggle}
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
        totalBooks > 0 ? (
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
          {displayBooks.length > 0 ? (
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

function StudentCatalogSkeleton() {
  return (
    <div className="w-full animate-pulse p-4">
      <div className="h-8 w-1/3 rounded-lg bg-muted border border-border mb-4"></div>
      <div className="h-12 w-full rounded-lg bg-muted border border-border mb-6"></div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
           <div key={i} className="h-16 w-full rounded-lg bg-muted opacity-50 border border-border"></div>
        ))}
      </div>
    </div>
  );
}

export default function StudentCatalogPage() {
  return (
    <Suspense fallback={<StudentCatalogSkeleton />}>
      <StudentCatalogData />
    </Suspense>
  );
}
