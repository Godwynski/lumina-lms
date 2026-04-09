"use client";

import { m } from "framer-motion";
import { Book as BookIcon, MapPin, Trash2, Package, CircleOff, AlertTriangle, CheckCircle2, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Book } from "@/lib/types";

interface ModernBookListItemProps {
  book: Book;
  onDelete: (book: Book) => void;
  onEdit: (book: Book) => void;
}

export function ModernBookListItem({ book, onDelete, onEdit }: ModernBookListItemProps) {
  const isOutOfStock = book.available_copies === 0;
  const isLowStock = !isOutOfStock && book.available_copies <= 2;
  
  return (
    <m.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="group relative flex min-w-[700px] flex-row items-center gap-4 rounded-lg border border-border bg-card pr-3 transition-all hover:bg-muted">
      
      {/* Pinned Title & Context Column */}
      <div className="sticky left-0 z-10 flex min-w-[280px] flex-1 shrink-0 items-center justify-start gap-4 bg-card py-2.5 pl-3 pr-4 shadow-[12px_0_15px_-10px_rgba(0,0,0,0.06)] transition-colors group-hover:bg-muted">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-all duration-500 ${
          isOutOfStock 
          ? "status-warning" 
          : "bg-muted text-muted-foreground"
        }`}>
          <BookIcon size={18} />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <h3 className="truncate font-bold text-foreground transition-colors group-hover:text-foreground">
            {book.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">by {book.author}</p>
          
          <div className="mt-2 flex items-center justify-start gap-4">
             <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                <MapPin size={10} />
                {book.location || "Shelf A1"}
             </div>
             <div className="flex items-center gap-1.5 rounded-sm bg-muted/60 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-foreground shadow-sm ring-1 ring-border/50">
                <Package size={12} className="text-muted-foreground" />
                {book.isbn || "INTERNAL-ID"}
             </div>
          </div>
        </div>
      </div>

      {/* Stock Status */}
      <div className="flex min-w-[140px] flex-col justify-center items-start gap-1.5 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {book.available_copies} of {book.total_copies} copies
        </span>
        
        {isOutOfStock ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <CircleOff className="h-3.5 w-3.5" />
            Out of stock
          </span>
        ) : isLowStock ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Low stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Available
          </span>
        )}
      </div>

      {/* Empty space filler mapped from original width usage */}
      <div className="flex-1" />

      {/* Action Area */}
       <div className="flex items-center gap-2 py-2.5 pl-4 ml-auto border-l border-border/50">
        <Button 
          onClick={() => onEdit(book)}
          variant="ghost" 
          size="icon" 
          className="h-11 w-11 shrink-0 rounded-md bg-transparent text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground shadow-none"
          title="Edit"
          aria-label="Edit book metadata"
        >
          <Pencil size={18} />
        </Button>
        <Link href={`/protected/catalog/${book.id}`}>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-md bg-transparent text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground shadow-none" title="Open details" aria-label="Open book details">
            <ExternalLink size={18} />
          </Button>
        </Link>
         <Button 
           onClick={() => onDelete(book)}
           variant="ghost" 
           size="icon" 
           className="h-11 w-11 shrink-0 rounded-md bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive shadow-none"
           title="Remove"
           aria-label="Remove book"
         >
          <Trash2 size={18} />
        </Button>
      </div>

      <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </m.div>
  );
}
