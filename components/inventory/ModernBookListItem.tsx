"use client";

import { motion } from "framer-motion";
import { Book as BookIcon, MapPin, Trash2, Package, CircleOff, AlertTriangle } from "lucide-react";
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
    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="group relative flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-card px-3 py-2.5 transition-all hover:bg-muted sm:flex-row sm:items-center sm:gap-3">
      <div className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center transition-all duration-500 ${
        isOutOfStock 
        ? "bg-orange-100 text-orange-600" 
        : "bg-muted text-muted-foreground"
      }`}>
        <BookIcon size={16} />
      </div>

      {/* Main Info */}
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h3 className="truncate font-bold text-foreground transition-colors group-hover:text-foreground">
          {book.title}
        </h3>
        <p className="text-xs text-muted-foreground truncate mt-0.5">by {book.author}</p>
        
        <div className="flex items-center justify-center sm:justify-start gap-4 mt-2">
           <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
              <MapPin size={10} />
              {book.location || "Shelf A1"}
           </div>
           <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
              <Package size={10} />
              {book.isbn || "INTERNAL"}
           </div>
        </div>
      </div>

      {/* Stock Status */}
      <div className="flex min-w-[110px] flex-col items-center gap-1 sm:items-end">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {book.available_copies} of {book.total_copies} copies
        </span>
        {isOutOfStock && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500">
            <CircleOff className="h-3 w-3" />
            Out of stock
          </span>
        )}
        {isLowStock && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Low stock
          </span>
        )}
        <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
           <div 
             className={`h-full ${isOutOfStock ? "bg-orange-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"}`} 
             style={{ width: `${(book.available_copies / (book.total_copies || 1)) * 100}%` }}
            />
        </div>
      </div>

      {/* Action Area */}
       <div className="flex items-center gap-1.5">
        <Button 
          onClick={() => onEdit(book)}
          variant="outline" 
          size="sm" 
          className="h-8 rounded-md px-2.5 text-[11px] font-semibold"
        >
          Edit
        </Button>
        <Link href={`/protected/catalog/${book.id}`}>
          <Button variant="outline" size="sm" className="h-8 rounded-md px-2.5 text-[11px] font-semibold">
            Open
          </Button>
        </Link>
        <Button 
          onClick={() => onDelete(book)}
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="absolute left-0 top-0 h-full w-1 bg-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.div>
  );
}
