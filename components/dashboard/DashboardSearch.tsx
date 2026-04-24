'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Loader2, X } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { cn } from "@/lib/utils";

interface DashboardSearchProps {
  role?: string | null;
}

export function DashboardSearch({ role: _role }: DashboardSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep a ref to the latest searchParams so navigate() never needs it as a dep.
  // This breaks the searchParams → navigate → effect → navigate loop.
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  // The URL is the ground truth — but we maintain local state for instant input feedback
  const urlQuery = searchParams.get('q') ?? '';
  const [localQuery, setLocalQuery] = useState(urlQuery);

  // Track if the local state is "ahead" of the URL (user is typing)
  const isTyping = localQuery !== urlQuery;

  // Sync URL → local only when the URL changes externally (not from our own push)
  const prevUrlQuery = useRef(urlQuery);
  useEffect(() => {
    if (prevUrlQuery.current !== urlQuery && !isTyping) {
      setLocalQuery(urlQuery);
    }
    prevUrlQuery.current = urlQuery;
  }, [urlQuery, isTyping]);

  // Stable navigation function — reads searchParams from ref, never recreated
  const navigate = useCallback((q: string) => {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    if (q.trim()) {
      params.set('q', q.trim());
    } else {
      params.delete('q');
    }
    params.delete('page');

    // Only push if the URL will actually change — prevents a replace on empty string
    const next = params.toString();
    const current = searchParamsRef.current.toString();
    if (next === current) return;

    startTransition(() => {
      router.replace(`?${next}`, { scroll: false });
    });
  }, [router]); // ← searchParams removed; read via ref inside instead

  // Debounce: fire navigation 350ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => navigate(localQuery), 350);
    return () => clearTimeout(timer);
  }, [localQuery, navigate]);

  const handleClear = () => {
    setLocalQuery('');
    inputRef.current?.focus();
  };

  const showClear = localQuery.length > 0;
  const showSpinner = isPending && !isTyping;

  return (
    <div className="relative group w-full">
      {/* Left icon */}
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
        <Search
          className={cn(
            "h-4 w-4 transition-colors duration-200",
            localQuery ? "text-primary" : "text-muted-foreground/50",
            "group-focus-within:text-primary"
          )}
        />
      </div>

      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search books, authors, ISBN..."
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClear();
        }}
        className={cn(
          "h-10 w-full rounded-2xl border-2 bg-background/80 text-sm font-medium",
          "pl-10 pr-10",
          "transition-all duration-200",
          "placeholder:text-muted-foreground/40 placeholder:font-normal",
          "focus:outline-none",
          // border states
          "border-border/40",
          "hover:border-border/70",
          "focus:border-primary/60 focus:bg-background focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]",
          // loading fade
          showSpinner && "opacity-70"
        )}
      />

      {/* Right: spinner or clear button */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
        {showSpinner && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/40" />
        )}
        {!showSpinner && showClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              "text-muted-foreground/40 hover:text-foreground hover:bg-muted/60",
              "transition-all duration-150"
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
