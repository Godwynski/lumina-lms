"use client";

import { m } from "framer-motion";
import { Book as BookIcon, MapPin, Package, CircleOff, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Book } from "@/lib/types";

interface ModernBookListItemProps {
  book: Book;
}

export function ModernBookListItem({ book }: ModernBookListItemProps) {
  const isOutOfStock = book.available_copies === 0;
  const isLowStock = !isOutOfStock && book.available_copies <= 2;
  
  return (
    <Link href={`/catalog/${book.id}`} className="block group">
      <m.div 
        layout 
        initial={{ opacity: 0, x: -10 }} 
        animate={{ opacity: 1, x: 0 }} 
        className="relative flex min-w-max flex-row items-center gap-4 rounded-xl border border-border/10 bg-card pr-4 transition-all hover:bg-muted/50 hover:border-primary/20 hover:shadow-sm sm:min-w-[700px]"
      >
        
        {/* Pinned Title & Context Column */}
        <div className="sticky left-0 z-10 flex min-w-[280px] flex-1 shrink-0 items-center justify-start gap-3 bg-card py-3 pl-4 pr-6 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.06)] transition-colors group-hover:bg-muted group-hover:shadow-none sm:min-w-[320px] sm:gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-500 ${
            isOutOfStock 
            ? "bg-destructive/10 text-destructive shadow-sm" 
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          }`}>
            <BookIcon size={18} />
          </div>

          <div className="min-w-0 flex-1 text-left">
            <h3 className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
              {book.title}
            </h3>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground/80">by {book.author}</p>
            
            <div className="mt-2.5 flex items-center justify-start gap-3">
               <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  <MapPin size={11} className="text-primary/60" />
                  {book.location || "Central Storage"}
               </div>
               <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-mono font-bold tracking-tight text-foreground shadow-none group-hover:bg-muted transition-colors">
                  <Package size={11} className="text-muted-foreground/50 group-hover:text-primary/50" />
                  {book.isbn || "INTERNAL-ID"}
               </div>
            </div>
          </div>
        </div>

        {/* Stock Status */}
        <div className="flex min-w-[160px] flex-col justify-center items-start gap-1.5 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            {book.available_copies} of {book.total_copies} available
          </span>
          
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-destructive">
              <CircleOff className="h-3 w-3" />
              Depleted
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Critically Low
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              In Stock
            </span>
          )}
        </div>

        {/* Section Column */}
        <div className="min-w-[120px] py-3 flex flex-col items-start gap-1 justify-center">
           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Classification</span>
           <span className="text-xs font-semibold text-foreground/80">{book.section || "General"}</span>
        </div>

        {/* Action Indication */}
        <div className="flex items-center gap-2 py-3 pl-4 ml-auto">
           <div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 group-hover:translate-x-1">
              <ChevronRight size={18} />
           </div>
        </div>

        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary rounded-r-full opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:h-12" />
      </m.div>
    </Link>
  );
}
