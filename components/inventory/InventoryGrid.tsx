"use client";

import { AnimatePresence, m } from "framer-motion";
import { ModernBookCard } from "./ModernBookCard";
import { StudentBookCard } from "@/components/library/StudentBookCard";
import { PackageSearch, Plus, SearchX } from "lucide-react";
import { Book, Reservation } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import * as React from "react";

interface InventoryGridProps {
  books: Book[];
  canManage?: boolean;
  isStudentView?: boolean;
  reservations?: Reservation[];
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

const MemoizedBookCard = React.memo(ModernBookCard);
const MemoizedStudentCard = React.memo(StudentBookCard);

export function InventoryGrid({ 
  books, 
  canManage = true,
  isStudentView = false,
  reservations = [],
  hasActiveFilters = false,
  onClearFilters,
}: InventoryGridProps) {
  if (books.length === 0) {
    return (
      <m.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full"
      >
        {hasActiveFilters ? (
          <EmptyState
            variant="no-results"
            icon={SearchX}
            title="No matches found"
            description="No inventory items match your current search or filters."
            action={onClearFilters ? {
              label: "Clear all filters",
              onClick: onClearFilters,
            } : undefined}
            contentClassName="min-h-[380px]"
          />
        ) : (
          <EmptyState
            variant="first-use"
            icon={PackageSearch}
            title="No books in inventory yet"
            description="No physical assets have been added to the catalog yet."
            action={canManage ? {
              href: "/inventory/add",
              label: "Add Book",
              icon: Plus,
            } : undefined}
            contentClassName="min-h-[420px]"
          />
        )}
      </m.div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {books.map((book, index) => {
          if (isStudentView) {
            // Find reservation info for this book
            const res = reservations.find(r => {
              const bookId = Array.isArray(r.books) ? r.books[0]?.id : r.books?.id;
              return bookId === book.id;
            });
            
            return (
              <MemoizedStudentCard 
                key={book.id} 
                book={book} 
                priority={index < 6}
                reservedInfo={res ? { status: res.status, queuePosition: res.queue_position } : undefined}
              />
            );
          }
          
          return (
            <MemoizedBookCard 
              key={book.id} 
              book={book} 
              priority={index < 6} 
              canManage={canManage} 
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
