'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCategoriesCached, getPublicBooksCached } from '@/lib/actions/public-catalog';
import { Filter, Search, X } from 'lucide-react';
import { Book, Category } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function PublicSearchPage() {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [section, setSection] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  
  const [books, setBooks] = useState<Book[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Native IntersectionObserver for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await getCategoriesCached();
        setCategories(cats);
      } catch { /* silent fail */ }
    }
    loadCategories();
  }, []);

  const loadBooks = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const data = await getPublicBooksCached(query, categoryId, section, availableOnly, currentPage, 10);
      
      if (reset) {
        setBooks(data.books);
      } else {
        setBooks(prev => [...prev, ...data.books]);
      }
      
      setHasMore(data.hasMore);
      setPage(currentPage + 1);
    } catch (_e) {
      console.error(_e);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, section, availableOnly, page]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      setPage(1);
      loadBooks(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadBooks]);

  // Native IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadBooks(false);
        }
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadBooks]);

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 relative min-h-screen">
      <div className="sticky top-0 bg-white z-10 py-4 border-b flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search title, author, ISBN..."
            className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          onClick={() => setShowFilters(true)}
          variant="outline"
          size="icon"
          className="p-2 border rounded-full hover:bg-gray-50"
        >
          <Filter className="w-5 h-5 text-gray-600" />
        </Button>
      </div>

      <div className="py-6 space-y-4">
        {books.map(book => (
          <Link key={book.id} href={`/book/${book.id}`} className="block">
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow flex gap-4 bg-white">
              <div className="w-16 h-24 bg-gray-200 rounded-md overflow-hidden flex-shrink-0 relative">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                   <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Cover</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg leading-tight">{book.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{book.author}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {book.available_copies > 0 ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Available</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">Borrowed</span>
                  )}
                  {book.section && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                      📍 {book.section}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}

        {loading && <div className="text-center py-4 text-gray-500">Loading...</div>}
        
        {!loading && books.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No books found matching your criteria.
          </div>
        )}

        {/* Intersection sentinel for infinite scrolling */}
        {hasMore && <div ref={sentinelRef} className="h-10" />}
      </div>

      {/* Sticky Bottom Sheet for Filters */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowFilters(false)}>
          <div 
            className="bg-white w-full max-w-md rounded-t-2xl p-6 slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Filters</h2>
              <Button onClick={() => setShowFilters(false)} variant="ghost" size="icon" className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Availability</Label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={availableOnly}
                    onCheckedChange={(checked) => setAvailableOnly(Boolean(checked))}
                  />
                  <span>Show available only</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <Select value={categoryId || "all"} onValueChange={(value) => setCategoryId(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Section</Label>
                <Input
                  type="text" 
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g. Fiction Section"
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <Button
                onClick={() => setShowFilters(false)}
                className="w-full bg-blue-600 text-white font-medium p-3 rounded-md mt-4"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
