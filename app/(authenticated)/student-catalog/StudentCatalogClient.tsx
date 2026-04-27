'use client';

import { useState, use, useEffect, useTransition, useCallback } from 'react';
import {
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { Book, Category as CatalogCategory } from '@/lib/types';
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from 'next/navigation';
import { StudentBookCard } from '@/components/library/StudentBookCard';
import { AnimatePresence, m } from 'framer-motion';
import { AdminTableShell } from '@/components/admin/AdminTableShell';


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
  const searchParams = useSearchParams();
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

  const [localQuery, setLocalQuery] = useState(initialFilters.q);
  const [debouncedQuery, setDebouncedQuery] = useState(initialFilters.q);
  const [page, setPage] = useState(initialFilters.page);
  const pageSize = 16;

  const [selectedCategory, setSelectedCategory] = useState(initialFilters.categoryId);
  const [availableOnly, setAvailableOnly] = useState(initialFilters.availableOnly);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);

  // Debounce the query update
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(localQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [localQuery]);


  const books = initialData.books || [];
  const totalBooks = initialData.total || 0;

  const updateParams = useCallback((updates: Record<string, string | number | boolean | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all' || (key === 'page' && value === 1)) {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });

    if (!updates.page && updates.page !== undefined) {
      params.delete('page');
    }

    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }, [router, searchParams]);

  // Synchronize local states when search params change (e.g. back button)
  useEffect(() => {
    setLocalQuery(searchParams.get('q') || '');
    setPage(parseInt(searchParams.get('page') || '1', 10));
    setSelectedCategory(searchParams.get('category') || '');
    setAvailableOnly(searchParams.get('available') === 'true');
    setSortBy((searchParams.get('sort') as 'title' | 'author' | 'availability') || 'title');
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedQuery !== localQuery) {
        updateParams({ q: localQuery, page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localQuery, debouncedQuery, updateParams]);

  const handleCatChange = (val: string) => updateParams({ category: val === 'all' ? null : val, page: 1 });
  const handleAvailableToggle = () => updateParams({ available: !availableOnly ? 'true' : null, page: 1 });
  const handleSortChange = (val: string) => updateParams({ sort: val });
  const handlePageChange = (p: number) => updateParams({ page: p });

  const clearFilters = () => {
    updateParams({ q: null, category: null, available: null, sort: 'title', page: 1 });
  };

  return (
    <AdminTableShell
      variant="ghost"
      controls={
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Search by title, author, or ISBN..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="h-10 pl-9 pr-10 rounded-xl border-border/40 bg-background/50 backdrop-blur-sm focus-visible:ring-primary/20"
            />
            {localQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground/40 hover:text-foreground"
                onClick={() => { setLocalQuery(''); updateParams({ q: null }); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <Select
              value={selectedCategory || 'all'}
              onValueChange={handleCatChange}
            >
              <SelectTrigger className="h-9 min-w-[140px] rounded-xl border-border/40 bg-background/50 text-xs font-bold shadow-none focus:ring-0">
                <SelectValue placeholder="Category" />
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
              variant={availableOnly ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleAvailableToggle}
              className={cn(
                "h-9 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all",
                availableOnly ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 shadow-none" : "border-border/40 bg-background/50 text-muted-foreground shadow-none"
              )}
            >
              Available
            </Button>

            <div className="h-6 w-[1px] bg-border/40 mx-1 hidden sm:block" />

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="h-9 w-[130px] rounded-xl border-border/40 bg-background/50 px-3 text-[11px] font-bold shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title A-Z</SelectItem>
                <SelectItem value="author">Author</SelectItem>
                <SelectItem value="availability">Availability</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(selectedCategory || availableOnly || localQuery || sortBy !== 'title') && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-3 text-[11px] font-bold uppercase text-muted-foreground hover:text-destructive transition-colors ml-auto sm:ml-0">
              Reset
            </Button>
          )}
        </div>
      }
      pagination={
        totalBooks > 0 ? (
          <CompactPagination
            page={page}
            totalItems={totalBooks}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        ) : null
      }
    >
      <div className={cn("transition-opacity w-full pb-10", isPending && "opacity-50")}>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div 
            key="grid"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {books.map((book) => (
              <StudentBookCard 
                key={book.id} 
                book={book} 
                reservedInfo={reservedBooksMap.get(book.id)}
                onReserveSuccess={(pos, status) => handleReserveSuccess(book.id, pos, status)}
              />
            ))}
          </m.div>
        </AnimatePresence>

        {books.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/40 bg-muted/5 px-4 py-20 text-center backdrop-blur-sm">
            <div className="mb-4 rounded-full bg-primary/5 p-5 text-primary/30 ring-1 ring-primary/10">
              <Search className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">No matching books found</h3>
            <p className="mt-2 max-w-[320px] text-sm text-muted-foreground/70 leading-relaxed">
              We couldn&apos;t find any titles matching your current search criteria. Try broadening your terms or clear all filters.
            </p>
            <Button variant="outline" onClick={clearFilters} className="mt-8 rounded-xl font-bold px-6 border-primary/20 text-primary hover:bg-primary/5">
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </AdminTableShell>
  );
}
