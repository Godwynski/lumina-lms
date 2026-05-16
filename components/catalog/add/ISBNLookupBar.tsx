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
    <div className="space-y-4 rounded-xl border border-border/40 bg-card/50 p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-foreground/80">
        <Search className="w-4 h-4 text-primary/70" />
        <span className="text-xs font-bold uppercase tracking-wider">ISBN Quick Lookup</span>
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text" 
            value={isbn}
            onChange={(e) => onIsbnChange(e.target.value)}
            className="h-10 w-full rounded-xl border-border/40 bg-background px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 shadow-sm"
            placeholder="Enter ISBN-10 or ISBN-13"
          />
        </div>
        <Button 
          type="button" 
          onClick={onFetchData}
          disabled={isbnLoading || !isbn}
          className="h-10 rounded-xl bg-primary px-6 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
        >
          {isbnLoading ? 'Searching...' : 'Fetch Data'}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground/70 font-medium">Retrieves title, author, and cover from external APIs (Google Books, Open Library).</p>
    </div>
  );
}
