'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPublicBooksCached, getCategoriesCached } from '@/lib/actions/public-catalog';
import Image from 'next/image';
import {
  Search, 
  Filter, 
  MapPin, 
  BookOpen, 
  X, 
  ChevronRight, 
  AlertCircle,
  ArrowUpDown,
  LayoutGrid,
  Rows3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CompactPagination } from '@/components/ui/compact-pagination';
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
  const pageSize = 12;
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedSection, setSelectedSection] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'availability'>('title');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

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
        selectedSection,
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
  }, [query, selectedCategory, selectedSection, availableOnly, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedCategory, selectedSection, availableOnly]);

  useEffect(() => {
    void loadBooks(page);
  }, [page, loadBooks]);

  const clearFilters = () => {
    setSelectedCategory('');
    setAvailableOnly(false);
    setSelectedSection('');
    setQuery('');
  };

  const displayBooks = [...books].sort((a, b) => {
    if (sortBy === 'author') return a.author.localeCompare(b.author);
    if (sortBy === 'availability') return b.available_copies - a.available_copies;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="min-h-screen overflow-x-hidden bg-muted pb-20">
      {/* Header & Search */}
      <div className="sticky top-0 z-40 border-b border-border bg-card px-4 pb-4 pt-6 md:relative">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Book Catalog</h1>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowFilters(true)}
                className="relative md:hidden"
            >
              <Filter className="w-5 h-5 text-muted-foreground" />
              {(selectedCategory || availableOnly || selectedSection) && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-white bg-slate-700" />
                )}
              </Button>
            </div>

            <div className="relative group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-slate-700" />
            <Input
              type="text" 
              placeholder="Search by title, author, or ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-muted py-3.5 pl-11 pr-4 text-sm transition-all focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
              <Button
                type="button"
                variant={density === 'comfortable' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDensity('comfortable')}
                className="h-7 rounded-lg px-2 text-[11px]"
              >
                <LayoutGrid className="mr-1 h-3.5 w-3.5" />
                Comfortable
              </Button>
              <Button
                type="button"
                variant={density === 'compact' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDensity('compact')}
                className="h-7 rounded-lg px-2 text-[11px]"
              >
                <Rows3 className="mr-1 h-3.5 w-3.5" />
                Compact
              </Button>
            </div>

            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="h-7 rounded-lg border-border bg-card px-2 py-1 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Sort: Title</SelectItem>
                  <SelectItem value="author">Sort: Author</SelectItem>
                  <SelectItem value="availability">Sort: Availability</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Desktop Filters */}
          <div className="hidden md:flex flex-wrap items-center gap-2 pt-2">
            <Select
              value={selectedCategory || "all"}
              onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-8 min-w-[180px] rounded-xl border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant={availableOnly ? "default" : "outline"} 
              size="sm" 
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`h-8 rounded-xl text-[11px] ${availableOnly ? "bg-primary" : "border-border text-muted-foreground"}`}
            >
              Available Now
            </Button>
            {(selectedCategory || availableOnly || selectedSection || query) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[11px] text-muted-foreground hover:text-red-600">
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {loadError}
          </div>
        )}

        <div className="flex items-center justify-between px-1 pb-1">
          <p className="text-xs font-semibold text-muted-foreground">
            Showing {displayBooks.length} title{displayBooks.length === 1 ? '' : 's'}
          </p>
          {(selectedCategory || availableOnly || query) && (
            <p className="text-[11px] font-semibold text-slate-700">Filtered view</p>
          )}
        </div>

        {displayBooks.map((book) => (
          <Link 
            key={book.id} 
            href={`/protected/student-catalog/${book.id}`}
            className={`group block rounded-2xl border border-border bg-card shadow-sm transition-all hover:bg-muted active:scale-[0.98] ${density === 'compact' ? 'p-3' : 'p-4'}`}
          >
            <div className={`flex ${density === 'compact' ? 'gap-3' : 'gap-5'}`}>
              {/* Cover Preview */}
              <div className={`${density === 'compact' ? 'w-16 h-24' : 'w-24 h-32'} bg-muted rounded-xl overflow-hidden shadow-inner flex-shrink-0 relative`}>
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes={density === 'compact' ? '64px' : '96px'}
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                    <BookOpen className="w-6 h-6 text-muted-foreground mb-2" />
                    <span className="text-[10px] text-muted-foreground font-medium">No Cover</span>
                  </div>
                )}
                {book.available_copies === 0 && (
                  <div className="absolute inset-0 bg-card/60 backdrop-blur-[2px] flex items-center justify-center">
                     <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Borrowed</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div>
                    <h3 className={`line-clamp-1 font-bold leading-snug text-foreground transition-colors group-hover:text-slate-800 ${density === 'compact' ? 'text-sm' : ''}`}>{book.title}</h3>
                  <p className={`text-muted-foreground font-medium ${density === 'compact' ? 'text-xs' : 'text-sm'}`}>{book.author}</p>
                </div>
                
                <div className="space-y-3">
                  {book.section && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      <MapPin className="w-3 h-3" />
                      {book.section}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-muted-foreground">ISBN: {book.isbn || '---'}</span>
                    <span className={`font-bold ${book.available_copies > 0 ? 'text-green-600' : 'text-orange-500'}`}>
                      {book.available_copies} Available
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {loading && (
          <div className="flex justify-center py-8">
             <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
          </div>
        )}

        {books.length === 0 && !loading && (
          <div className="py-20 text-center space-y-4">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
             </div>
             <p className="text-muted-foreground font-medium">No books found matching your search.</p>
             <Button variant="outline" onClick={clearFilters} className="rounded-xl px-6">
                Clear Filters
             </Button>
          </div>
        )}

        {!loading && totalBooks > 0 && (
          <CompactPagination
            page={page}
            totalItems={totalBooks}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Sticky Bottom Sheet Filter (Mobile Only) */}
      {showFilters && (
        <div className="fixed inset-0 z-[110] bg-primary/40 backdrop-blur-sm" onClick={() => setShowFilters(false)}>
           <div 
             className="absolute bottom-0 inset-x-0 animate-in space-y-8 rounded-t-[32px] bg-card p-6 pb-12 shadow-2xl slide-in-from-bottom duration-300"
             onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-2 opacity-50" />
              
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-foreground">Filter Search</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-6">
                 {/* Category Grid */}
                 <div className="space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Browse Category</label>
                    <div className="grid grid-cols-2 gap-2">
                       {categories.map(c => (
                         <Button
                           key={c.id}
                           onClick={() => setSelectedCategory(c.id === selectedCategory ? '' : c.id)}
                           variant="ghost"
                           className={`p-3 rounded-2xl text-xs font-bold transition-all text-left flex justify-between items-center ${
                             selectedCategory === c.id 
                            ? 'bg-primary text-primary-foreground shadow-lg' 
                            : 'bg-muted text-muted-foreground hover:bg-muted'
                           }`}
                          >
                            {c.name}
                            {selectedCategory === c.id && <ChevronRight className="w-3 h-3" />}
                         </Button>
                       ))}
                     </div>
                  </div>

                 {/* Availability Toggle */}
                 <div className="flex items-center justify-between p-4 bg-muted rounded-2xl border border-border/50">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Available Now</h4>
                      <p className="text-[10px] text-muted-foreground font-medium">Only show books currently on shelves</p>
                    </div>
                     <Switch
                       checked={availableOnly}
                       onCheckedChange={setAvailableOnly}
                       aria-label="Available now"
                     />
                  </div>
               </div>

              <Button 
                onClick={() => setShowFilters(false)}
                className="h-14 w-full rounded-2xl bg-primary font-bold text-white hover:bg-primary/90"
              >
                Apply Filters
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
