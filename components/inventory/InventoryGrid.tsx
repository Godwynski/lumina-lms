"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ModernBookCard } from "./ModernBookCard";
import { PackageSearch, Plus } from "lucide-react";
import { Book } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";

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
        className="w-full"
      >
        <EmptyState
          icon={PackageSearch}
          title="Vault is Empty"
          description="No physical assets were found matching your criteria. Start by populating your catalog."
          action={{
            href: "/protected/catalog/add",
            label: "Initialize First Entry",
            icon: Plus,
          }}
          contentClassName="min-h-[500px]"
        />
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {books.map((book, index) => (
          <ModernBookCard key={book.id} book={book} onDelete={onDelete} onEdit={onEdit} index={index} />
        ))}
      </AnimatePresence>
    </div>
  );
}
