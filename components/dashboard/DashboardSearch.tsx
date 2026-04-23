'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface DashboardSearchProps {
  role: string | null;
}

export function DashboardSearch({ role }: DashboardSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const path = role === 'student' ? '/student-catalog' : '/dashboard';
    setIsPending(true);
    router.push(`${path}?q=${encodeURIComponent(query.trim())}`);
    setIsPending(false);
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
          "h-10 w-full rounded-2xl border-2 border-border/40 bg-background/80 pl-10 pr-4 text-sm font-medium transition-all duration-300",
          "placeholder:text-muted-foreground/50",
          "hover:border-primary/30 hover:bg-background/90 hover:shadow-md",
          "focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-background focus:shadow-lg"
        )}
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </form>
  );
}
