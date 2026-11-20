"use client";

import { m } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { 
  MapPin, 
  Layers, 
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";

interface ModernBookCardProps {
  book: Book;
  priority?: boolean;
  canManage?: boolean;
}

export function ModernBookCard({ book, priority = false, canManage = true }: ModernBookCardProps) {
  const isOutOfStock = book.available_copies === 0;
  const [modalOpen, setModalOpen] = useState(false);
  // Derived from the prop so an updated cover shows up; only a URL that failed
  // to load falls back to the default image.
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const imgSrc = book.cover_url && book.cover_url !== failedCover ? book.cover_url : "/images/default-book-cover.png";
  
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        aria-label={`View details for ${book.title}`}
        onKeyDown={(e) => {
          // Keys on nested controls belong to them.
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setModalOpen(true);
          }
        }}
        className="group h-full block w-full text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        <m.div
          layout
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          whileHover={{ y: -4 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-3 transition-all group-hover:bg-accent/50 group-hover:border-primary/30"
        >
          <div className="mb-3 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2">
                <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                  {book.title}
                </h3>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">by {book.author}</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg">
                  <MapPin size={12} className="text-primary/80 shrink-0" />
                  <span className="font-medium text-muted-foreground">Location:</span>
                  <span className="truncate text-foreground font-medium">{book.location || "Central Shelf"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                  <Layers size={12} className="text-primary/80 shrink-0" />
                  <span className="font-medium text-muted-foreground">ISBN:</span>
                  <span className="truncate font-mono text-foreground/90">{book.isbn || "INTERNAL-STOCK"}</span>
                </div>
                {book.dewey_decimal && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                    <Tag size={12} className="text-primary/80 shrink-0" />
                    <span className="font-medium text-muted-foreground">DDC:</span>
                    <span className="truncate font-mono text-foreground/90">{book.dewey_decimal}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted ring-1 ring-border/50 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2">
              <Image 
                src={imgSrc} 
                alt={book.title} 
                fill 
                className="object-cover" 
                sizes="80px"
                priority={priority}
                unoptimized
                onError={() => setFailedCover(book.cover_url ?? null)}
              />
              {isOutOfStock && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                   <span className="text-[11px] font-black uppercase tracking-tighter text-destructive rotate-[-15deg] border-2 border-destructive px-1 py-0.5 rounded-sm">OUT</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/10">
            <div className="flex items-center gap-1.5">
              {!book.is_active ? (
                <Badge variant="outline" className="whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30">
                  Archived
                </Badge>
              ) : (
                <Badge 
                  variant={isOutOfStock ? "destructive" : "secondary"} 
                  className={cn(
                    "whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold transition-all duration-300",
                    !isOutOfStock && "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                  )}
                >
                  {book.available_copies} / {book.total_copies} In Pool
                </Badge>
              )}
            </div>
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">
              {book.section || "General"}
            </span>
          </div>

          {/* Tactile progress bar at the bottom */}
          <div className="absolute bottom-0 left-0 h-1 w-full bg-muted/20">
            <m.div 
              initial={{ width: 0 }}
              animate={{ width: `${(book.available_copies / (book.total_copies || 1)) * 100}%` }}
              className={`h-full transition-colors duration-500 ${isOutOfStock ? "bg-destructive" : "bg-primary group-hover:bg-primary-foreground"}`}
            />
          </div>
        </m.div>
      </div>

      <BookDetailModal
        bookId={book.id}
        open={modalOpen}
        onOpenChange={setModalOpen}
        variant="super_admin"
        initialData={book}
        canManage={canManage}
      />
    </>
  );
}
