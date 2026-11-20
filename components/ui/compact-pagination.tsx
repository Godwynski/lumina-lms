"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CompactPaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  variant?: "default" | "ghost";
  /** Plural noun for what is being paged, e.g. "books" → "1-24 of 127 books". */
  itemLabel?: string;
  /** Blocks navigation, e.g. while a page is loading. */
  disabled?: boolean;
}

/**
 * The one pagination bar used across the app.
 * sm and up: range · per page · pager on one row.
 * Phone width: range + per page on the first row, the pager across the second.
 * The page number is an input: type a page and press Enter (or leave the field) to jump.
 */
export function CompactPagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  variant = "ghost",
  itemLabel = "items",
  disabled = false,
}: CompactPaginationProps) {
  const inputId = useId();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);
  // null = not editing; the field shows the current page.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const target = Number.parseInt(draft, 10);
    setDraft(null);
    if (!Number.isFinite(target)) return;
    const clamped = Math.min(totalPages, Math.max(1, target));
    if (clamped !== page) onPageChange(clamped);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      setDraft(null);
    }
  };

  const navButton = "size-11 shrink-0 rounded-lg hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-40 sm:size-9";

  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 transition-all duration-300",
      variant === "default" && "rounded-xl border border-border/50 bg-card/70 p-2 shadow-xs backdrop-blur-sm",
      variant === "ghost" && "px-1"
    )}>
      <p className="whitespace-nowrap text-xs font-medium text-muted-foreground">
        <span className="max-sm:sr-only">Showing </span>
        <span className="font-semibold text-foreground">{start}-{end}</span> of{" "}
        <span className="font-semibold text-foreground">{totalItems}</span> {itemLabel}
      </p>

      {pageSizeOptions && onPageSizeChange ? (
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-xs font-medium text-muted-foreground">Per page</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))} disabled={disabled}>
            <SelectTrigger aria-label="Items per page" className="h-9 w-16 rounded-lg border-border/50 bg-background hover:bg-muted/30 transition-colors text-xs font-semibold shadow-none focus:ring-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[5rem] rounded-xl border-border/40 shadow-xl">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)} className="text-xs font-semibold py-2">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <nav aria-label="Pagination" className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
        <Button
          variant="ghost"
          size="icon"
          className={navButton}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={disabled || page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <label htmlFor={inputId}>Page</label>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label={`Go to page, 1 to ${totalPages}`}
            value={draft ?? String(page)}
            disabled={disabled || totalPages <= 1}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={onKeyDown}
            onBlur={commit}
            className="h-9 w-12 rounded-lg border border-border/50 bg-background text-center text-xs font-semibold text-foreground tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          />
          <span className="whitespace-nowrap">of {totalPages}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={navButton}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={disabled || page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        <span role="status" aria-label={`Page ${page} of ${totalPages}`} className="sr-only">
          Page {page} of {totalPages}
        </span>
      </nav>
    </div>
  );
}
