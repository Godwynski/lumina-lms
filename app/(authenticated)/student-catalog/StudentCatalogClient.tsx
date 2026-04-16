'use client';

import { useState, use, useEffect, useTransition, useCallback } from 'react';
import Image from 'next/image';
import {
  Search,
  ArrowUpDown,
  Ticket,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';

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

interface ReservationRow {
  status: string;
  queue_position: number;
  books: { id: string } | { id: string }[] | null;
}

interface ReservedInfo {
  status: string;
  queuePosition: number;
}

interface StudentCatalogClientProps {
  booksPromise: Promise<{ books: Book[]; total: number; hasMore: boolean }>;
  categoriesPromise: Promise<CatalogCategory[]>;
  reservationsPromise: Promise<ReservationRow[]>;
  initialFilters: {
    q: string;
    categoryId: string;
    availableOnly: boolean;
    page: number;
    sortBy: 'title' | 'author' | 'availability';
  };
}

export function StudentCatalogClient({ 
  booksPromise, 
  categoriesPromise,
  reservationsPromise,
  initialFilters
}: StudentCatalogClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialData = use(booksPromise);
  const categories = use(categoriesPromise);
  const reservations = use(reservationsPromise);

  // Build the initial map from server data
  const buildInitialMap = (rows: ReservationRow[]) => {
    const map = new Map<string, ReservedInfo>();
    for (const r of rows) {
      const bookId = Array.isArray(r.books) ? r.books[0]?.id : r.books?.id;
      if (bookId) {
        map.set(bookId, { status: r.status, queuePosition: r.queue_position });
      }
    }
    return map;
  };

  // Local reservation map — updated optimistically after each successful reserve
  const [reservedBooksMap, setReservedBooksMap] = useState<Map<string, ReservedInfo>>(
    () => buildInitialMap(reservations)
  );

  // If the server re-renders with fresh reservation data, sync it back
  useEffect(() => {
    setReservedBooksMap(buildInitialMap(reservations));
  }, [reservations]);

  // Called by ReserveTitleButton after a successful reservation
  const handleReserveSuccess = useCallback((
    bookId: string,
    queuePosition: number,
    status: 'READY' | 'ACTIVE'
  ) => {
    setReservedBooksMap(prev => {
      const next = new Map(prev);
      next.set(bookId, { status, queuePosition });
      return next;
    });
  }, []);

  const [query, setQuery] = useState(initialFilters.q);
  const [page, setPage] = useState(initialFilters.page);
  const pageSize = 16;

  const [selectedCategory, setSelectedCategory] = useState(initialFilters.categoryId);
  const [availableOnly, setAvailableOnly] = useState(initialFilters.availableOnly);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);

  // Synchronize state with URL to enable prefetching
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedCategory) params.set('category', selectedCategory);
    if (availableOnly) params.set('available', 'true');
    if (page > 1) params.set('page', page.toString());
    if (sortBy !== 'title') params.set('sort', sortBy);

    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }, [query, selectedCategory, availableOnly, page, sortBy, router]);

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

  const books = initialData.books || [];
  const totalBooks = initialData.total || 0;

  const renderBadge = (bookId: string) => {
    if (!reservedBooksMap.has(bookId)) return null;
    const info = reservedBooksMap.get(bookId)!;
    const isReady = info.status === 'READY';
    return (
      <Badge
        variant={isReady ? 'default' : 'outline'}
        className={`shrink-0 text-[9px] px-1.5 py-0 h-[18px] gap-1 font-black ${
          isReady
            ? 'bg-emerald-500 hover:bg-emerald-500 text-white border-transparent'
            : 'border-primary/30 text-primary bg-primary/5'
        }`}
      >
        {isReady
          ? <><Sparkles className="h-2.5 w-2.5" /> Pickup Ready</>
          : <><Ticket className="h-2.5 w-2.5" /> Your Queue #{info.queuePosition}</>}
      </Badge>
    );
  };

  return (
    <AdminTableShell
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

          <div className="flex w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide gap-2 pb-1">
            <Select
              value={selectedCategory || 'all'}
              onValueChange={handleCatChange}
            >
              <SelectTrigger className="h-8 min-w-[150px] px-2.5 text-xs">
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
              className="h-8 px-3 text-xs shrink-0"
            >
              Available only
            </Button>

            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'title' | 'author' | 'availability')}>
                <SelectTrigger className="h-8 min-w-[120px] px-2.5 text-xs">
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
      <div className={isPending ? "opacity-50 transition-opacity w-full overflow-hidden" : "transition-opacity w-full overflow-hidden"}>
        {/* ── Mobile view ── */}
        <div className="md:hidden flex flex-col divide-y divide-border">
          {books.length > 0 ? (
            books.map((book: Book) => (
              <div key={book.id} className={`p-4 flex gap-4 transition-colors ${reservedBooksMap.has(book.id) ? 'bg-primary/[0.04] hover:bg-primary/[0.07] border-l-2 border-l-primary/40' : 'hover:bg-muted/40'}`}>
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted">
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={book.title} fill sizes="56px" className="object-cover" unoptimized />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground leading-tight">{book.title}</p>
                      {renderBadge(book.id)}
                    </div>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">{book.author}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none ${
                        book.available_copies > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {book.available_copies}/{book.total_copies} available
                    </span>
                    <div className="flex items-center gap-1">
                      <Link href={`/student-catalog/${book.id}`}>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-semibold">
                          View
                        </Button>
                      </Link>
                      <ReserveTitleButton
                        bookId={book.id}
                        isAvailable={book.available_copies > 0}
                        hasExistingReservation={reservedBooksMap.has(book.id)}
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        onReserveSuccess={(queuePosition, status) =>
                          handleReserveSuccess(book.id, queuePosition, status)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <Search className="h-8 w-8 opacity-20" />
                <p>No books matching your criteria.</p>
                <Button variant="link" onClick={clearFilters} className="h-auto p-0 text-xs">Clear all filters</Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop table ── */}
        <table className="hidden md:table w-full text-left text-sm">
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
                <tr key={book.id} className={reservedBooksMap.has(book.id) ? 'bg-primary/[0.04] hover:bg-primary/[0.07]' : 'hover:bg-muted/40'}>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-10 w-8 overflow-hidden rounded border border-border bg-muted">
                        {book.cover_url ? (
                          <Image src={book.cover_url} alt={book.title} fill sizes="32px" className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-foreground">{book.title}</p>
                          {renderBadge(book.id)}
                        </div>
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
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/student-catalog/${book.id}`}>
                        <Button variant="outline" size="sm" className="h-8 px-4 text-xs font-semibold shadow-sm transition-all hover:bg-muted/60">
                          Detail
                        </Button>
                      </Link>
                      <ReserveTitleButton
                        bookId={book.id}
                        isAvailable={book.available_copies > 0}
                        hasExistingReservation={reservedBooksMap.has(book.id)}
                        variant="default"
                        size="sm"
                        className="h-8 text-[11px]"
                        onReserveSuccess={(queuePosition, status) =>
                          handleReserveSuccess(book.id, queuePosition, status)
                        }
                      />
                    </div>
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
