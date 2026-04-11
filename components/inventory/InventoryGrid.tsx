"use client";

import { AnimatePresence, m } from "framer-motion";
import { ModernBookCard } from "./ModernBookCard";
import { PackageSearch, Plus } from "lucide-react";
import { Book } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import * as React from "react";

interface InventoryGridProps {
  books: Book[];
}

const MemoizedBookCard = React.memo(ModernBookCard);

export function InventoryGrid({ books }: InventoryGridProps) {
  if (books.length === 0) {
    return (
      <m.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full"
      >
        <EmptyState
          icon={PackageSearch}
          title="Vault is Empty"
          description="No physical assets were found matching your criteria. Start by populating your catalog."
          action={{
            href: "/catalog/add",
            label: "Initialize First Entry",
            icon: Plus,
          }}
          contentClassName="min-h-[500px]"
        />
      </m.div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {books.map((book) => (
          <MemoizedBookCard key={book.id} book={book} />
        ))}
      </AnimatePresence>
    </div>
  );
}
