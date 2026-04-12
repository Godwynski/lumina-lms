'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCategoriesCached, getPublicBooksCached } from '@/lib/actions/public-catalog';
import { Filter, Search, X, BookOpen, MapPin } from 'lucide-react';
import { Book, Category } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CompactPagination } from '@/components/ui/compact-pagination';

export function PublicCatalog() {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [section, setSection] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  
  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 12;
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await getCategoriesCached();
        setCategories(cats);
      } catch { /* silent fail */ }
    }
    loadCategories();
  }, []);

  const loadBooks = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      const data = await getPublicBooksCached(query, categoryId, section, availableOnly, targetPage, pageSize);

      setBooks(data.books);
      setTotalBooks(data.total);
    } catch (_e) {
      console.error(_e);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, section, availableOnly, pageSize]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, categoryId, section, availableOnly]);

  useEffect(() => {
    void loadBooks(page);
  }, [page, loadBooks]);

  return (
    <div id="catalog" className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-left w-full md:w-auto">
          <h2 className="text-3xl font-bold text-foreground">Library Catalog</h2>
          <p className="text-muted-foreground">Find and browse available resources</p>
        </div>
        
        <div className="flex w-full md:w-auto items-center gap-2">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search title, author, ISBN..."
              className="w-full pl-10 pr-4 py-2 rounded-full bg-muted/50 border-border/50 focus:ring-primary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            onClick={() => setShowFilters(true)}
            variant="outline"
            size="icon"
            className="rounded-full shrink-0"
          >
            <Filter className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {books.map(book => (
          <Link key={book.id} href={`/book/${book.id}`} className="group h-full">
            <div className="h-full border border-border/50 rounded-2xl p-4 hover:shadow-xl hover:border-primary/20 transition-all duration-300 bg-card/50 backdrop-blur-sm flex flex-col gap-4">
              <div className="aspect-[2/3] bg-muted rounded-xl overflow-hidden shadow-inner relative group-hover:scale-[1.02] transition-transform duration-300">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 250px"
                    className="object-cover"
                  />
                ) : (
                   <div className="w-full h-full flex items-center justify-center">
                     <BookOpen className="w-12 h-12 text-muted-foreground/20" />
                   </div>
                )}
              </div>
              <div className="flex-1 flex flex-col">
                <h3 className="font-bold text-lg leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">{book.title}</h3>
                <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{book.author}</p>
                
                <div className="mt-auto pt-4 flex flex-wrap gap-2">
                  {book.available_copies > 0 ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider status-success border border-emerald-500/20 px-2 py-0.5 rounded-full">Available</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider status-danger border border-red-500/20 px-2 py-0.5 rounded-full">Reserved</span>
                  )}
                  {book.section && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {book.section}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-50">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[2/3.5] bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      )}
      
      {!loading && books.length === 0 && (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/60">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No results found for your search.</p>
          <Button variant="link" onClick={() => { setQuery(''); setCategoryId(''); setSection(''); setAvailableOnly(false); }}>
            Clear all filters
          </Button>
        </div>
      )}

      {!loading && totalBooks > 0 && (
        <div className="pt-8 border-t border-border/50">
          <CompactPagination
            page={page}
            totalItems={totalBooks}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Filter Bottom Sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all duration-300" onClick={() => setShowFilters(false)}>
          <div 
            className="bg-card w-full max-w-lg rounded-t-[2.5rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-300 ease-out"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Refine Search</h2>
                <p className="text-sm text-muted-foreground">Filter the catalog to find exactly what you need</p>
              </div>
              <Button onClick={() => setShowFilters(false)} variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Availability Preference</Label>
                <div 
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${availableOnly ? 'border-primary bg-primary/5' : 'border-border/50 bg-muted/20'}`}
                  onClick={() => setAvailableOnly(!availableOnly)}
                >
                  <span className="font-medium">Show available results only</span>
                  <Checkbox
                    checked={availableOnly}
                    onCheckedChange={(checked) => setAvailableOnly(Boolean(checked))}
                    className="rounded-full w-6 h-6"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Collection Category</Label>
                <Select value={categoryId || "all"} onValueChange={(value) => setCategoryId(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-full h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-medium">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Specific Section</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text" 
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Science Fiction, Reference"
                    className="w-full h-14 pl-11 rounded-2xl bg-muted/20 border-border/50 text-base font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  onClick={() => {
                    setCategoryId('');
                    setSection('');
                    setAvailableOnly(false);
                  }}
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl font-bold"
                >
                  Reset
                </Button>
                <Button
                  onClick={() => setShowFilters(false)}
                  className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] transition-all"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
