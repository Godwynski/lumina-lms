"use client";

import { useState } from "react";
import { PackageSearch, Plus, SearchX } from "lucide-react";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { Badge } from "@/components/ui/badge";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { getCategoryName } from "@/lib/utils";
import type { Book } from "@/lib/types";

interface InventoryTableProps {
  books: Book[];
  canManage?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function InventoryTable({
  books,
  canManage = true,
  hasActiveFilters = false,
  onClearFilters,
}: InventoryTableProps) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const columns: LuminaColumn<Book>[] = [
    {
      header: "Title",
      mobileMain: true,
      accessor: (book) => (
        <div className="min-w-0">
          <p className="font-semibold text-foreground line-clamp-1">{book.title}</p>
          {book.location && (
            <p className="text-xs text-muted-foreground truncate">{book.location}</p>
          )}
        </div>
      ),
    },
    {
      header: "Author",
      accessor: (book) => (
        <span className="text-xs font-medium text-muted-foreground">{book.author}</span>
      ),
    },
    {
      header: "ISBN",
      accessor: (book) => (
        <span className="font-mono text-xs text-foreground/80 whitespace-nowrap">{book.isbn || "—"}</span>
      ),
    },
    {
      header: "Category",
      accessor: (book) => (
        <span className="text-xs text-muted-foreground">{getCategoryName(book.categories)}</span>
      ),
    },
    {
      header: "Copies (Avail / Total)",
      accessor: (book) => {
        const total = book.total_copies ?? book.available_copies;
        return (
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground whitespace-nowrap">
            {book.available_copies} / {total}
          </span>
        );
      },
    },
    {
      header: "Status",
      className: "whitespace-nowrap",
      accessor: (book) => {
        if (!book.is_active) {
          return (
            <Badge
              variant="outline"
              className="whitespace-nowrap rounded-lg px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30"
            >
              Archived
            </Badge>
          );
        }
        if (book.available_copies === 0) {
          return (
            <Badge variant="destructive" className="whitespace-nowrap rounded-lg px-2.5 py-0.5 text-xs font-semibold">
              Out of Stock
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="whitespace-nowrap rounded-lg px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
            Available
          </Badge>
        );
      },
    },
  ];

  const emptyState = hasActiveFilters
    ? {
        variant: "no-results" as const,
        icon: SearchX,
        title: "No matches found",
        description: "No inventory items match your current search or filters.",
        action: onClearFilters
          ? { label: "Clear all filters", onClick: onClearFilters }
          : undefined,
      }
    : {
        variant: "first-use" as const,
        icon: PackageSearch,
        title: "No books in inventory yet",
        description: "No physical assets have been added to the catalog yet.",
        action: canManage
          ? { href: "/inventory/add", label: "Add Book", icon: Plus }
          : undefined,
      };

  return (
    <>
      <LuminaTable
        data={books}
        columns={columns}
        onRowClick={(book) => setSelectedBook(book)}
        emptyState={emptyState}
      />

      {selectedBook && (
        <BookDetailModal
          bookId={selectedBook.id}
          open={Boolean(selectedBook)}
          onOpenChange={(open) => {
            if (!open) setSelectedBook(null);
          }}
          variant="super_admin"
          initialData={selectedBook}
          canManage={canManage}
        />
      )}
    </>
  );
}
