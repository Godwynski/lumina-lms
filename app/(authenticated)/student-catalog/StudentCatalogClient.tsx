'use client';

import { useState, use } from 'react';
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
import useSWR from 'swr';
import { getPublicBooksCached } from '@/lib/actions/public-catalog';

type CatalogCategory = {
  id: string;
  name: string;
};

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category_id: string | null;
  tags: string[] | null;
  section: string | null;
  cover_url: string | null;
  total_copies: number;
  available_copies: number;
  categories: { name: string | null }[];
}

interface StudentCatalogClientProps {
  booksPromise: Promise<{ books: Book[]; total: number; hasMore: boolean }>;
  categoriesPromise: Promise<CatalogCategory[]>;
  initialQuery?: string;
}

export function StudentCatalogClient({ 
  booksPromise, 
  categoriesPromise,
  initialQuery = ''
}: StudentCatalogClientProps) {
  const initialBooksData = use(booksPromise);
  const categories = use(categoriesPromise);
  
  const [query, setQuery] = useState(initialQuery);
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

  const swrKey = ['student-books', query, selectedCategory, availableOnly, page, pageSize, sortBy];
  const { data: booksData, error, isLoading } = useSWR(
    swrKey,
    () => getPublicBooksCached(query, selectedCategory, '', availableOnly, page, pageSize, sortBy),
    { 
        fallbackData: query === initialQuery && page === 1 && selectedCategory === '' && !availableOnly && sortBy === 'title' 
            ? initialBooksData 
            : undefined,
        keepPreviousData: true 
    }
  );

  const books = booksData?.books || initialBooksData.books;
  const totalBooks = booksData?.total || initialBooksData.total;

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
              onClick={handleAvailableToggle}
              className="h-8 px-3 text-xs"
            >
              Available only
            </Button>

            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'title' | 'author' | 'availability')}>
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
      <div className={isLoading ? "opacity-50 transition-opacity" : "transition-opacity"}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="px-4 py-2.5 font-medium text-muted-foreground">Title</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground text-center">Author</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground text-center">Availability</th>
              <th className="px-4 py-2.5 font-medium text-muted-foreground text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {books.length > 0 ? (
              books.map((book: Book) => (
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
                  <td className="px-4 py-3 text-sm text-foreground text-center">{book.author}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold leading-none ${
                        book.available_copies > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {book.available_copies}/{book.total_copies}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/student-catalog/${book.id}`}>
                      <Button variant="outline" size="sm" className="h-8 px-4 text-xs font-semibold shadow-sm transition-all hover:bg-primary hover:text-primary-foreground">
                        Open Detail
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
                <tr>
                <td colSpan={4} className="px-4 py-20 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p>No books matching your criteria.</p>
                        <Button variant="link" onClick={clearFilters} className="h-auto p-0 text-xs">Clear all filters</Button>
                    </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminTableShell>
  );
}

