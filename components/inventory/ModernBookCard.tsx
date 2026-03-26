"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { 
  Book as BookIcon, 
  MapPin, 
  Layers, 
  Trash2, 
  Info,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Book } from "@/lib/types";

interface ModernBookCardProps {
  book: Book;
  onDelete: (book: Book) => void;
  onEdit: (book: Book) => void;
  index: number;
}

export function ModernBookCard({ book, onDelete, onEdit, index }: ModernBookCardProps) {
  const isOutOfStock = book.available_copies === 0;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group h-full"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card p-2.5 shadow-sm transition-colors hover:bg-muted">
        
        <div className="mb-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-foreground">
                  {book.title}
                </h3>
                <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">by {book.author}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                  {book.available_copies} / {book.total_copies} Available
                </Badge>
                <span className="text-[9px] font-semibold uppercase tracking-tight text-muted-foreground">
                  {book.section || "General"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={11} />
                <span className="font-medium uppercase tracking-wide text-[10px]">Floor/Row:</span>
                <span className="truncate text-foreground">{book.location || "Central Shelf"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers size={11} />
                <span className="font-medium uppercase tracking-wide text-[10px]">ID:</span>
                <span className="truncate font-mono text-foreground">{book.isbn || "INTERNAL-STOCK"}</span>
              </div>
            </div>
          </div>

          <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {book.cover_url ? (
              <Image 
                src={book.cover_url} 
                alt={book.title} 
                fill 
                className="object-cover" 
                sizes="(max-width: 768px) 30vw, (max-width: 1200px) 15vw, 10vw"
                unoptimized={true}
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center ${isOutOfStock ? "status-danger" : "text-muted-foreground"}`}>
                <BookIcon size={14} />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-1 border-t border-border pt-2.5">
          <Button 
            onClick={() => onEdit(book)}
            className="group/btn flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-primary text-[11px] font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Edit
            <ChevronRight size={14} className="transition-transform group-hover/btn:translate-x-1" />
          </Button>
          
          <Link href={`/protected/catalog/${book.id}`}>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-md border-border text-muted-foreground hover:bg-muted hover:text-foreground">
              <Info size={16} />
            </Button>
          </Link>

          <Button 
            onClick={() => onDelete(book)}
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={16} />
          </Button>
        </div>

        {/* Tactile progress bar at the bottom */}
        <div className="absolute bottom-0 left-0 h-1 w-full bg-muted">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(book.available_copies / (book.total_copies || 1)) * 100}%` }}
            className={`h-full ${isOutOfStock ? "status-fill-danger" : "status-fill-success"}`}
          />
        </div>
      </div>
    </motion.div>
  );
}
