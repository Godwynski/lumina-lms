"use client";

import { motion } from "framer-motion";
import { 
  Book as BookIcon, 
  MapPin, 
  Trash2, 
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Book } from "@/lib/types";

interface ModernBookListItemProps {
  book: Book;
  onDelete: (book: Book) => void;
  onEdit: (book: Book) => void;
}

export function ModernBookListItem({ book, onDelete, onEdit }: ModernBookListItemProps) {
  const isOutOfStock = book.available_copies === 0;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="group relative bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 hover:shadow-lg transition-all flex flex-col sm:flex-row items-center gap-4 sm:gap-6 overflow-hidden"
    >
      {/* Icon Area */}
      <div className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 ${
        isOutOfStock 
        ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500" 
        : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500"
      }`}>
        <BookIcon size={24} />
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <h3 className="font-bold text-zinc-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
          {book.title}
        </h3>
        <p className="text-xs text-zinc-500 truncate mt-0.5">by {book.author}</p>
        
        <div className="flex items-center justify-center sm:justify-start gap-4 mt-2">
           <div className="flex items-center gap-1.5 text-[10px] uppercase font-black text-zinc-400">
              <MapPin size={10} />
              {book.location || "Shelf A1"}
           </div>
           <div className="flex items-center gap-1.5 text-[10px] uppercase font-black text-zinc-400">
              <Package size={10} />
              {book.isbn || "INTERNAL"}
           </div>
        </div>
      </div>

      {/* Stock Status */}
      <div className="flex flex-col items-center sm:items-end gap-1.5 min-w-[120px]">
        <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="rounded-full px-2.5 py-0.5 font-bold text-[9px] uppercase tracking-widest whitespace-nowrap">
          {book.available_copies} / {book.total_copies}
        </Badge>
        <div className="h-1 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
           <div 
             className={`h-full truncate ${isOutOfStock ? "bg-orange-500" : "bg-emerald-500"}`} 
             style={{ width: `${(book.available_copies / (book.total_copies || 1)) * 100}%` }}
           />
        </div>
      </div>

      {/* Action Area */}
      <div className="flex items-center gap-2">
        <Button 
          onClick={() => onEdit(book)}
          variant="ghost" 
          size="sm" 
          className="h-9 rounded-xl transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-xs"
        >
          Edit
        </Button>
        <Link href={`/protected/catalog/${book.id}`}>
          <Button variant="ghost" size="sm" className="h-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-xs">
            Info
          </Button>
        </Link>
        <Button 
          onClick={() => onDelete(book)}
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}
