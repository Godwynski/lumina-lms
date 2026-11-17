"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ISBNLookupBarProps {
  isbn: string;
  onIsbnChange: (isbn: string) => void;
  onFetchData: () => void;
  isbnLoading: boolean;
}

export function ISBNLookupBar({
  isbn,
  onIsbnChange,
  onFetchData,
  isbnLoading,
}: ISBNLookupBarProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-5">
      <div className="flex items-center gap-2 text-foreground">
        <Search className="w-4 h-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold">ISBN Quick Lookup</span>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            aria-label="ISBN quick lookup"
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (!isbnLoading && isbn) onFetchData(); } }}
            type="text" 
            value={isbn}
            onChange={(e) => onIsbnChange(e.target.value.replace(/[^0-9Xx]/g, '').toUpperCase())}
            className="h-10 w-full rounded-lg border-border/60 bg-background px-3 text-sm"
            placeholder="Enter ISBN-10 or ISBN-13"
          />
        </div>
        <Button 
          type="button" 
          onClick={onFetchData}
          disabled={isbnLoading || !isbn}
          className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {isbnLoading ? 'Searching...' : 'Fetch Data'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">Enter an ISBN-10 or ISBN-13 to store with this book, or fetch title, author, and cover from Google Books and Open Library.</p>
    </div>
  );
}
