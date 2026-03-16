"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ModernBookCard } from "./ModernBookCard";
import { PackageSearch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Book } from "@/lib/types";

interface InventoryGridProps {
  books: Book[];
  onDelete: (book: Book) => void;
  onEdit: (book: Book) => void;
}

export function InventoryGrid({ books, onDelete, onEdit }: InventoryGridProps) {
  if (books.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/50 p-20 rounded-[3rem] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center w-full min-h-[500px]"
      >
        <div className="h-24 w-24 bg-zinc-50 rounded-3xl flex items-center justify-center text-zinc-300 mb-6 shadow-inner">
          <PackageSearch size={48} />
        </div>
        <h3 className="text-2xl font-black text-zinc-900 mb-2 tracking-tight">Vault is Empty</h3>
        <p className="text-zinc-500 max-w-xs mb-8">No physical assets were found matching your criteria. Start by populating your catalog.</p>
        <Link href="/protected/catalog/add">
          <Button className="rounded-2xl h-14 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2 font-black text-xs uppercase tracking-widest">
            <Plus size={20} />
            Initialize First Entry
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      <AnimatePresence mode="popLayout">
        {books.map((book) => (
          <ModernBookCard key={book.id} book={book} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </AnimatePresence>
    </div>
  );
}
