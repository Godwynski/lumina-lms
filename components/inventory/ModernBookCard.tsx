"use client";

import { motion } from "framer-motion";
import { 
  Book as BookIcon, 
  MapPin, 
  Layers, 
  ArrowRight, 
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
}

export function ModernBookCard({ book, onDelete, onEdit }: ModernBookCardProps) {
  const isOutOfStock = book.available_copies === 0;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative h-full"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-500" />
      
      <div className="relative h-full bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200/60 dark:border-zinc-800/60 shadow-xl shadow-zinc-200/10 dark:shadow-none flex flex-col overflow-hidden">
        
        {/* Status Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="relative">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              isOutOfStock 
              ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500" 
              : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500"
            } group-hover:scale-110 group-hover:rotate-3`}>
              <BookIcon size={28} />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest">
              {book.available_copies} / {book.total_copies} Available
            </Badge>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">
              {book.section || "General"}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1">
          <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight mb-2">
            {book.title}
          </h3>
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-6 flex items-center gap-1.5">
            by {book.author}
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
              <div className="h-8 w-8 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <MapPin size={14} className="text-zinc-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Floor / Row</p>
                <p className="text-xs font-bold truncate">{book.location || "Central Shelf"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
              <div className="h-8 w-8 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Layers size={14} className="text-zinc-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Standard Item</p>
                <p className="text-xs font-mono font-medium truncate">ID: {book.isbn || "INTERNAL-STOCK"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <Button 
            onClick={() => onEdit(book)}
            className="flex-1 h-11 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-indigo-600 dark:hover:bg-indigo-400 font-bold transition-all flex items-center justify-center gap-2 group/btn"
          >
            Edit Metadata
            <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
          </Button>
          
          <Link href={`/protected/catalog/${book.id}`}>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl border border-zinc-100 dark:border-zinc-800 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50">
              <Info size={18} />
            </Button>
          </Link>

          <Button 
            onClick={() => onDelete(book)}
            variant="ghost" 
            size="icon" 
            className="h-11 w-11 rounded-xl border border-zinc-100 dark:border-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 size={18} />
          </Button>
        </div>

        {/* Tactile progress bar at the bottom */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-100 dark:bg-zinc-900">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(book.available_copies / (book.total_copies || 1)) * 100}%` }}
            className={`h-full ${isOutOfStock ? "bg-orange-500" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"}`}
          />
        </div>
      </div>
    </motion.div>
  );
}
