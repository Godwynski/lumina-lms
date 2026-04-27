"use client";

import { m } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { 
  Book as BookIcon, 
  MapPin, 
  Layers, 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Book } from "@/lib/types";

interface ModernBookCardProps {
  book: Book;
  priority?: boolean;
}

export function ModernBookCard({ book, priority = false }: ModernBookCardProps) {
  const isOutOfStock = book.available_copies === 0;
  
  return (
    <Link href={`/catalog/${book.id}`} className="group h-full block">
      <m.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-all group-hover:bg-accent/50 group-hover:border-primary/30 group-hover:shadow-lg"
      >
        <div className="mb-3 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2">
              <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                {book.title}
              </h3>
              <p className="mt-1 truncate text-xs font-semibold text-muted-foreground/80">by {book.author}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/20 p-1.5 rounded-lg">
                <MapPin size={11} className="text-primary/70" />
                <span className="font-bold uppercase tracking-widest text-[8px] opacity-70">Location:</span>
                <span className="truncate text-foreground/90 font-medium">{book.location || "Central Shelf"}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1.5">
                <Layers size={11} className="text-primary/70" />
                <span className="font-bold uppercase tracking-widest text-[8px] opacity-70">ISBN:</span>
                <span className="truncate font-mono text-foreground/80">{book.isbn || "INTERNAL-STOCK"}</span>
              </div>
            </div>
          </div>

          <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted shadow-sm ring-1 ring-border/50 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2 group-hover:shadow-md">
            {book.cover_url ? (
              <Image 
                src={book.cover_url} 
                alt={book.title} 
                fill 
                className="object-cover" 
                sizes="80px"
                priority={priority}
                unoptimized
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center ${isOutOfStock ? "status-danger" : "text-muted-foreground/40"}`}>
                <BookIcon size={20} />
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                 <span className="text-[8px] font-black uppercase tracking-tighter text-destructive rotate-[-15deg] border-2 border-destructive px-1 py-0.5 rounded-sm">OUT</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
          <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="rounded-full px-2.5 py-0 h-5 text-[9px] font-black uppercase tracking-widest transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            {book.available_copies} / {book.total_copies} In Pool
          </Badge>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 transition-colors group-hover:text-primary/60">
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
    </Link>
  );
}
