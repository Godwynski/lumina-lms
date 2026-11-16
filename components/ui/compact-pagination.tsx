"use client";

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
}

export function CompactPagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  variant = "ghost",
}: CompactPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-2 transition-all duration-300",
      variant === "default" && "rounded-xl border border-border/50 bg-card/70 p-2 shadow-xs backdrop-blur-sm",
      variant === "ghost" && "px-1"
    )}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{start}-{end}</span> of <span className="font-semibold text-foreground">{totalItems}</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        {pageSizeOptions && onPageSizeChange ? (
          <div className="flex items-center gap-2 pr-2 border-r border-border/40">
            <span className="text-xs font-medium text-muted-foreground">Per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
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

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-40"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          
          <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-muted/20 border border-border/40" aria-label={`Page ${page} of ${totalPages}`} role="status">
            <span className="text-xs font-semibold text-foreground">{page}</span>
            <span className="text-xs font-medium text-muted-foreground">/</span>
            <span className="text-xs font-medium text-muted-foreground">{totalPages}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-40"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
