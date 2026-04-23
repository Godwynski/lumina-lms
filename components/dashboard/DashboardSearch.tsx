'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { useState, useEffect, useTransition } from 'react';
import { cn } from "@/lib/utils";

interface DashboardSearchProps {
  role?: string | null;
}

export function DashboardSearch({ role: _role }: DashboardSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isPending, startTransition] = useTransition();

  // Sync internal state when URL changes externally
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== query) setQuery(q);
  }, [searchParams, query]);

  // Debounce search updates to the URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        params.set('q', query.trim());
      } else {
        params.delete('q');
      }
      params.delete('page'); // Reset page on search

      startTransition(() => {
        router.replace(`?${params.toString()}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router, searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // No-op as we use the useEffect debounce for searching
  };

  return (
    <form onSubmit={handleSearch} className="relative group w-full">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
        <Search className="h-4 w-4 text-primary transition-colors group-focus-within:text-primary" />
        <div className="h-3 w-[1px] bg-border/60" />
      </div>
      <input
        type="text"
        placeholder="Search inventory, books, or records..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cn(
          "h-10 w-full rounded-2xl border-2 border-border/40 bg-background/80 pl-10 pr-10 text-sm font-medium transition-all duration-300",
          "placeholder:text-muted-foreground/50",
          "hover:border-primary/30 hover:bg-background/90 hover:shadow-md",
          "focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-background focus:shadow-lg",
          isPending && "opacity-80"
        )}
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
        </div>
      )}
    </form>
  );
}
