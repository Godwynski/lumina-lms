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
      "flex items-center justify-between gap-2 transition-all duration-300",
      variant === "default" && "rounded-2xl border border-border/10 bg-card/50 p-2 shadow-xs backdrop-blur-sm",
      variant === "ghost" && "px-1"
    )}>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
          Showing <span className="text-foreground/80">{start}-{end}</span> of <span className="text-foreground/80">{totalItems}</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        {pageSizeOptions && onPageSizeChange ? (
          <div className="flex items-center gap-2 pr-2 border-r border-border/10">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/40">Per Page</span>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger className="h-7 w-14 rounded-lg border-none bg-muted/20 hover:bg-muted/30 transition-colors text-[10px] font-bold shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[5rem] rounded-xl border-border/10 shadow-xl">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-xs font-bold py-2">
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
            className="h-8 w-8 rounded-xl hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-20"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-muted/10 border border-border/5">
            <span className="text-[11px] font-black text-foreground">{page}</span>
            <span className="text-[10px] font-bold text-muted-foreground/40">/</span>
            <span className="text-[10px] font-bold text-muted-foreground/60">{totalPages}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-20"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
