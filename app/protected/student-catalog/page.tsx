'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getPublicBooksCached, getCategoriesCached } from '@/lib/actions/public-catalog';
import Image from 'next/image';
import { 
  Search, 
  Filter, 
  MapPin, 
  BookOpen, 
  X, 
  ChevronRight, 
  WifiOff,
  AlertCircle,
  ArrowUpDown,
  LayoutGrid,
  Rows3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedSection, setSelectedSection] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'availability'>('title');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const observer = useRef<IntersectionObserver | null>(null);
  const lastBookElementRef = useCallback((node: HTMLAnchorElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    setIsOffline(!navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const loadBooks = useCallback(async (isNewSearch = false, currentPage = 1) => {
    if (isOffline && !isNewSearch) return;
    
    setLoading(true);
    setLoadError('');
    try {
      const result = await getPublicBooksCached(
        query,
        selectedCategory,
        selectedSection,
        availableOnly,
        currentPage
      );
      
      if (isNewSearch) {
        setBooks(result.books);
      } else {
        setBooks(prev => [...prev, ...result.books]);
      }
      setHasMore(result.hasMore);
    } catch (err) {
      console.error(err);
      setLoadError('Unable to load catalog right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, selectedSection, availableOnly, isOffline]);

  useEffect(() => {
    setPage(1);
    void loadBooks(true, 1);
  }, [query, selectedCategory, selectedSection, availableOnly, loadBooks]);

  useEffect(() => {
    if (page > 1) {
      void loadBooks(false, page);
    }
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
    <div className="min-h-screen bg-zinc-50 pb-20 overflow-x-hidden">
      {/* Offline Banner */}
      {isOffline && (
        <div className="sticky top-0 z-[100] bg-zinc-900 text-white p-3 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300">
          <WifiOff className="w-4 h-4 text-zinc-400" />
          <p className="text-xs font-medium uppercase tracking-wider">
            You are offline. Search is disabled, but you can view your digital library card and currently borrowed books.
          </p>
        </div>
      )}

      {/* Header & Search */}
      <div className="bg-white border-b border-zinc-200/50 pt-6 pb-4 px-4 sticky top-0 md:relative z-40">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Book Catalog</h1>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowFilters(true)}
                className="relative md:hidden"
            >
              <Filter className="w-5 h-5 text-zinc-600" />
              {(selectedCategory || availableOnly || selectedSection) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></span>
              )}
            </Button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by title, author, or ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isOffline}
              className="w-full bg-zinc-100 border-none rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
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

            <div className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold outline-none"
              >
                <option value="title">Sort: Title</option>
                <option value="author">Sort: Author</option>
                <option value="availability">Sort: Availability</option>
              </select>
            </div>
          </div>

          {/* Desktop Filters */}
          <div className="hidden md:flex flex-wrap items-center gap-2 pt-2">
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-600 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button 
              variant={availableOnly ? "default" : "outline"} 
              size="sm" 
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`rounded-xl text-[11px] h-8 ${availableOnly ? "bg-indigo-600" : "text-zinc-600 border-zinc-200"}`}
            >
              Available Now
            </Button>
            {(selectedCategory || availableOnly || selectedSection || query) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[11px] text-zinc-400 hover:text-red-600">
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
          <p className="text-xs font-semibold text-zinc-500">
            Showing {displayBooks.length} title{displayBooks.length === 1 ? '' : 's'}
          </p>
          {(selectedCategory || availableOnly || query) && (
            <p className="text-[11px] text-indigo-600 font-semibold">Filtered view</p>
          )}
        </div>

        {displayBooks.map((book, index) => (
          <Link 
            key={book.id} 
            href={`/protected/student-catalog/${book.id}`}
            ref={index === displayBooks.length - 1 ? lastBookElementRef : null}
            className={`block bg-white rounded-2xl border border-zinc-200/50 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group ${density === 'compact' ? 'p-3' : 'p-4'}`}
          >
            <div className={`flex ${density === 'compact' ? 'gap-3' : 'gap-5'}`}>
              {/* Cover Preview */}
              <div className={`${density === 'compact' ? 'w-16 h-24' : 'w-24 h-32'} bg-zinc-50 rounded-xl overflow-hidden shadow-inner flex-shrink-0 relative`}>
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
                    <BookOpen className="w-6 h-6 text-zinc-300 mb-2" />
                    <span className="text-[10px] text-zinc-400 font-medium">No Cover</span>
                  </div>
                )}
                {book.available_copies === 0 && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                     <span className="bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Borrowed</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div>
                  <h3 className={`font-bold text-zinc-900 line-clamp-1 leading-snug group-hover:text-indigo-600 transition-colors ${density === 'compact' ? 'text-sm' : ''}`}>{book.title}</h3>
                  <p className={`text-zinc-500 font-medium ${density === 'compact' ? 'text-xs' : 'text-sm'}`}>{book.author}</p>
                </div>
                
                <div className="space-y-3">
                  {book.section && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-bold border border-indigo-100/50">
                      <MapPin className="w-3 h-3" />
                      {book.section}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-zinc-400">ISBN: {book.isbn || '---'}</span>
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
          <div className="py-8 flex justify-center">
             <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {books.length === 0 && !loading && (
          <div className="py-20 text-center space-y-4">
             <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-zinc-300" />
             </div>
             <p className="text-zinc-400 font-medium">No books found matching your search.</p>
             <Button variant="outline" onClick={clearFilters} className="rounded-xl px-6">
                Clear Filters
             </Button>
          </div>
        )}
      </div>

      {/* Sticky Bottom Sheet Filter (Mobile Only) */}
      {showFilters && (
        <div className="fixed inset-0 z-[110] bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowFilters(false)}>
           <div 
             className="absolute bottom-0 inset-x-0 bg-white rounded-t-[32px] p-6 pb-12 space-y-8 animate-in slide-in-from-bottom duration-300 shadow-2xl"
             onClick={e => e.stopPropagation()}
           >
              <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-2 opacity-50" />
              
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-zinc-900">Filter Search</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-6">
                 {/* Category Grid */}
                 <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Browse Category</label>
                    <div className="grid grid-cols-2 gap-2">
                       {categories.map(c => (
                         <button 
                          key={c.id}
                          onClick={() => setSelectedCategory(c.id === selectedCategory ? '' : c.id)}
                          className={`p-3 rounded-2xl text-xs font-bold transition-all text-left flex justify-between items-center ${
                            selectedCategory === c.id 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                         >
                           {c.name}
                           {selectedCategory === c.id && <ChevronRight className="w-3 h-3" />}
                         </button>
                       ))}
                    </div>
                 </div>

                 {/* Availability Toggle */}
                 <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-200/50">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900">Available Now</h4>
                      <p className="text-[10px] text-zinc-500 font-medium">Only show books currently on shelves</p>
                    </div>
                    <button 
                      onClick={() => setAvailableOnly(!availableOnly)}
                      className={`w-12 h-6 flex items-center rounded-full transition-colors ${availableOnly ? 'bg-indigo-600' : 'bg-zinc-300'}`}
                    >
                       <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${availableOnly ? 'translate-x-6' : ''}`} />
                    </button>
                 </div>
              </div>

              <Button 
                onClick={() => setShowFilters(false)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl h-14 font-bold shadow-xl shadow-zinc-200"
              >
                Apply Filters
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
