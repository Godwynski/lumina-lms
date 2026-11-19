'use client';

import { useState, use, useEffect, useTransition, useCallback, useRef } from 'react';
import {
  Search,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { Book, Category as CatalogCategory } from '@/lib/types';
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from 'next/navigation';
import { StudentBookCard } from '@/components/library/StudentBookCard';
import { CatalogTable } from '@/components/library/CatalogTable';
import { ViewModeToggle, replaceViewModeInUrl, resolveViewMode, type CatalogViewMode } from '@/components/common/ViewModeToggle';
import { ToolbarSearchField } from '@/components/common/ToolbarSearchField';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { AnimatePresence, m } from 'framer-motion';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import { createClient } from '@/lib/supabase/client';
import { BOOK_SORT_OPTIONS, bookColumnSort, normalizeBookSort, parseBookSort, type BookSortParam } from '@/lib/catalog-sort';



interface ReservationRow {
  status: string;
  queue_position: number;
  hold_expires_at?: string | null;
  books: { id: string } | { id: string }[] | null;
}

interface ReservedInfo {
  status: string;
  queuePosition: number;
  holdExpiresAt?: string | null;
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
    sortBy: BookSortParam;
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
  const { preferences, updatePreferences } = usePreferences();
  const initialData = use(booksPromise);
  const categories = use(categoriesPromise);
  const reservations = use(reservationsPromise);


  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 500);
  }, [router, startTransition]);

  // Real-time synchronization (debounced; book_copies & borrowing_records propagate via books trigger)
  useEffect(() => {
    const supabase = createClient();
    const channelName = `catalog-realtime-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, debouncedRefresh)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [debouncedRefresh]);


  // Build the initial map from server data
  const buildInitialMap = (rows: ReservationRow[]) => {
    const map = new Map<string, ReservedInfo>();
    for (const r of rows) {
      const bookId = Array.isArray(r.books) ? r.books[0]?.id : r.books?.id;
      if (bookId) {
        map.set(bookId, { 
          status: r.status, 
          queuePosition: r.queue_position,
          holdExpiresAt: r.hold_expires_at
        });
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
    status: 'READY' | 'ACTIVE',
    holdExpiresAt?: string | null
  ) => {
    setReservedBooksMap(prev => {
      const next = new Map(prev);
      next.set(bookId, { status, queuePosition, holdExpiresAt });
      return next;
    });
  }, []);

  const handleCancelSuccess = useCallback((bookId: string) => {
    setReservedBooksMap(prev => {
      const next = new Map(prev);
      next.delete(bookId);
      return next;
    });
  }, []);

  const urlQuery = searchParams.get('q') || '';
  const [localQuery, setLocalQuery] = useState(initialFilters.q);
  // Queries this component pushed that the URL hasn't caught up with yet.
  const pendingQueries = useRef<string[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [page, setPage] = useState(initialFilters.page);
  const pageSize = 16;

  const [selectedCategory, setSelectedCategory] = useState(initialFilters.categoryId);
  const [availableOnly, setAvailableOnly] = useState(initialFilters.availableOnly);
  // An explicit Sort choice wins; otherwise searches show "Best match" first.
  const hasQuery = urlQuery.trim().length > 0;
  const explicitSort = parseBookSort(searchParams.get('sort'), hasQuery);
  const sortBy = normalizeBookSort(explicitSort ?? (hasQuery ? 'relevance' : 'newest'));
  const sortOptions = BOOK_SORT_OPTIONS.filter(({ value }) => value !== 'relevance' || hasQuery);

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
    setPage(parseInt(searchParams.get('page') || '1', 10));
    setSelectedCategory(searchParams.get('category') || '');
    setAvailableOnly(searchParams.get('available') === 'true');
  }, [searchParams]);

  // The input owns its value. Only adopt the URL's query when it changed from
  // outside (back button, link); our own debounced pushes are ignored so a
  // late-landing URL never overwrites what the user is still typing.
  useEffect(() => {
    const i = pendingQueries.current.lastIndexOf(urlQuery);
    if (i !== -1) {
      pendingQueries.current = pendingQueries.current.slice(i + 1);
      return;
    }
    pendingQueries.current = [];
    setLocalQuery(urlQuery);
  }, [urlQuery]);

  const pushQuery = useCallback((raw: string, sort?: string) => {
    clearTimeout(searchDebounce.current);
    const q = raw.trim();
    if (q !== urlQuery) pendingQueries.current.push(q);
    updateParams({ q: q || null, ...(sort ? { sort } : {}), page: 1 });
  }, [urlQuery, updateParams]);

  // Debounce search input for realtime as-you-type search
  useEffect(() => {
    const q = localQuery.trim();
    if (q === urlQuery.trim() || q === pendingQueries.current.at(-1)) return;
    const timer = setTimeout(() => pushQuery(localQuery), 300);
    searchDebounce.current = timer;
    return () => clearTimeout(timer);
  }, [localQuery, urlQuery, pushQuery]);

  // Results belong to the typed query only once the debounce and navigation finish.
  const isSearchSettled = !isPending && localQuery.trim() === urlQuery.trim();

  const selectedIds = selectedCategory ? selectedCategory.split(',').filter(Boolean) : [];

  const handleCatToggle = (id: string) => {
    let newSelected: string[];
    if (selectedIds.includes(id)) {
      newSelected = selectedIds.filter((cid) => cid !== id);
    } else {
      newSelected = [...selectedIds, id];
    }
    const val = newSelected.join(',');
    updateParams({ category: val || null, page: 1 });
  };

  const handleCatClear = () => {
    updateParams({ category: null, page: 1 });
  };
  const handleAvailableToggle = () => updateParams({ available: !availableOnly ? 'true' : null, page: 1 });
  const handleSortChange = (sort: string) => pushQuery(localQuery, sort);
  const handlePageChange = (p: number) => updateParams({ page: p });
  const viewMode = resolveViewMode(searchParams.get('view'), preferences.catalogView);
  const setViewMode = (nextView: CatalogViewMode) => {
    if (nextView === viewMode) return;
    replaceViewModeInUrl(nextView);
    void updatePreferences({ catalogView: nextView });
  };

  const clearFilters = () => {
    setLocalQuery('');
    updateParams({ q: null, category: null, available: null, sort: null, page: 1 });
  };

  const mobileActiveFilterCount =
    (selectedIds.length > 0 ? 1 : 0) +
    (availableOnly ? 1 : 0) +
    (explicitSort ? 1 : 0);

  return (
    <AdminTableShell
      variant="ghost"
      controls={
        <div className="app-toolbar-row w-full">
          <div className="app-toolbar-search basis-full lg:basis-52">
            <ToolbarSearchField
              label="Search the catalog"
              placeholder="Search by title, author, or ISBN..."
              value={localQuery}
              onChange={setLocalQuery}
              onClear={() => { setLocalQuery(''); pushQuery(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  pushQuery(localQuery);
                }
              }}
            />
          </div>

          {/* Mobile compact filter + view bar */}
          <div className="app-toolbar-row flex-1 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={mobileActiveFilterCount > 0 ? `Catalog filters (${mobileActiveFilterCount} active)` : "Catalog filters"}
                  className={cn(
                    "app-toolbar-control flex-1 min-w-0 justify-between border-border/50 bg-background px-3.5",
                    mobileActiveFilterCount > 0 && "border-primary/30 bg-primary/5 text-primary"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Filters &amp; Sort</span>
                  </span>
                  {mobileActiveFilterCount > 0 && (
                    <Badge className="ml-2 h-5 min-w-5 px-1.5 rounded-full text-[11px] bg-primary text-primary-foreground">
                      {mobileActiveFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" responsiveBottom className="p-0 overflow-hidden flex flex-col">
                <div className="p-5 pb-4 border-b border-border/10">
                  <SheetTitle className="text-lg font-bold">Catalog Filters</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Filter by availability, category, or change sort order.
                  </SheetDescription>
                </div>

                <div className="p-5 space-y-6 flex-1 overflow-y-auto">
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground block">Availability</span>
                    <Button
                      type="button"
                      variant={availableOnly ? 'default' : 'outline'}
                      onClick={handleAvailableToggle}
                      aria-pressed={availableOnly}
                      className="h-11 w-full justify-between rounded-xl px-4 text-xs font-bold"
                    >
                      <span>Available copies only</span>
                      <span>{availableOnly ? 'On' : 'Off'}</span>
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground block">Sort by</span>
                    <Select value={sortBy} onValueChange={handleSortChange}>
                      <SelectTrigger aria-label="Sort books (mobile)" className="app-toolbar-control min-h-11 w-full border-border/50 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground block">Categories</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={selectedIds.length === 0 ? 'default' : 'outline'}
                        aria-pressed={selectedIds.length === 0}
                        onClick={handleCatClear}
                        className="h-11 rounded-xl px-4 text-xs font-bold"
                      >
                        All Categories
                      </Button>
                      {categories.map((category) => {
                        const isSelected = selectedIds.includes(category.id);
                        return (
                          <Button
                            key={category.id}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            aria-pressed={isSelected}
                            onClick={() => handleCatToggle(category.id)}
                            className="h-11 rounded-xl px-4 text-xs font-bold"
                          >
                            {category.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-border/10 bg-muted/5 flex gap-3">
                  <Button type="button" variant="outline" onClick={clearFilters} className="h-11 flex-1 rounded-xl text-xs font-bold">
                    Reset
                  </Button>
                  <SheetClose asChild>
                    <Button type="button" className="h-11 flex-1 rounded-xl text-xs font-bold">
                      Done
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>

          </div>

          {/* Desktop inline filter + sort bar */}
          <div className="hidden lg:contents">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline"
                  size="sm"
                  className={cn(
                    "app-toolbar-control max-w-full justify-between border-border/50 bg-background px-3",
                    selectedIds.length > 0 && "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                  )}
                >
                  <span className="truncate">
                    {selectedIds.length === 0 
                      ? "All Categories" 
                      : selectedIds.length === 1 
                        ? categories.find(c => c.id === selectedIds[0])?.name || "1 Category"
                        : `${selectedIds.length} Categories`}
                  </span>
                  <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto no-scrollbar bg-card border border-border/10 rounded-xl">
                <DropdownMenuCheckboxItem
                  checked={selectedIds.length === 0}
                  onCheckedChange={handleCatClear}
                  className="text-xs font-medium cursor-pointer"
                >
                  All Categories
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator className="bg-border/10" />
                {categories.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category.id}
                    checked={selectedIds.includes(category.id)}
                    onCheckedChange={() => handleCatToggle(category.id)}
                    className="text-xs font-medium cursor-pointer"
                  >
                    {category.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant={availableOnly ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleAvailableToggle}
              aria-pressed={availableOnly}
              className={cn(
                "app-toolbar-control px-3",
                availableOnly ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : "border-border/50 bg-background"
              )}
            >
              Available
            </Button>

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger aria-label="Sort books" className="app-toolbar-control min-h-11 min-w-36 border-border/50 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>

          </div>

          <ViewModeToggle value={viewMode} onChange={setViewMode} ariaLabel="Catalog view mode" />

          {(selectedCategory || availableOnly || localQuery || explicitSort) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="app-toolbar-control hidden px-3 text-muted-foreground lg:inline-flex">
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
      <p className="sr-only" role="status">{isSearchSettled ? `${totalBooks} ${totalBooks === 1 ? "book" : "books"} found.` : "Searching..."}</p>
      <div className={cn("w-full transition-opacity", isPending && "opacity-50")}>
        {viewMode === 'table' ? (
          books.length > 0 ? (
            <CatalogTable
              books={books}
              reservedBooksMap={reservedBooksMap}
              onReserveSuccess={handleReserveSuccess}
              onCancelSuccess={handleCancelSuccess}
              columnSort={(column) => bookColumnSort(sortBy, column, handleSortChange)}
            />
          ) : null
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div 
              key="grid"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            >
              {books.map((book, index) => (
                <StudentBookCard 
                  key={book.id} 
                  book={book} 
                  priority={index < 4}
                  reservedInfo={reservedBooksMap.get(book.id)}
                  onReserveSuccess={(pos, status, expires) => handleReserveSuccess(book.id, pos, status, expires)}
                  onCancelSuccess={() => handleCancelSuccess(book.id)}
                />
              ))}
            </m.div>
          </AnimatePresence>
        )}

        {books.length === 0 && !isSearchSettled && (
          // Don't claim "no results" while a search is still in flight.
          <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {books.length === 0 && isSearchSettled && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-muted/10 px-4 py-20 text-center">
            <div className="mb-4 rounded-full bg-primary/5 p-5 text-primary/40 ring-1 ring-primary/10">
              <Search className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">No matching books found</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
              We couldn&apos;t find any titles matching your current search criteria. Try broadening your terms or clear all filters.
            </p>
            <Button variant="outline" onClick={clearFilters} className="mt-8 rounded-lg font-semibold px-6">
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </AdminTableShell>
  );
}
