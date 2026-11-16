"use client";

import { useState } from "react";
import { PackageSearch, Plus } from "lucide-react";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { getCategoryName } from "@/lib/utils";
import type { Book } from "@/lib/types";

interface InventoryTableProps {
  books: Book[];
  canManage?: boolean;
}

export function InventoryTable({ books, canManage = true }: InventoryTableProps) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  if (books.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Vault is Empty"
        description="No physical assets were found matching your criteria. Start by populating your catalog."
        action={
          canManage
            ? {
                href: "/inventory/add",
                label: "Initialize First Entry",
                icon: Plus,
              }
            : undefined
        }
        contentClassName="min-h-[500px]"
      />
    );
  }

  const columns: LuminaColumn<Book>[] = [
    {
      header: "Title",
      mobileMain: true,
      accessor: (book) => (
        <div className="min-w-0">
          <p className="font-bold text-foreground line-clamp-1">{book.title}</p>
          {book.section && (
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{book.section}</p>
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
        <span className="font-mono text-xs text-foreground/80">{book.isbn || "—"}</span>
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
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {book.available_copies} / {total}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessor: (book) => {
        if (!book.is_active) {
          return (
            <Badge
              variant="outline"
              className="rounded-lg px-2 py-0 h-5 text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
            >
              Archived
            </Badge>
          );
        }
        if (book.available_copies === 0) {
          return (
            <Badge variant="destructive" className="rounded-lg px-2 py-0 h-5 text-[11px] font-bold uppercase tracking-wider">
              Out of Stock
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="rounded-lg px-2 py-0 h-5 text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
            Available
          </Badge>
        );
      },
    },
  ];

  return (
    <>
      <LuminaTable
        data={books}
        columns={columns}
        onRowClick={(book) => setSelectedBook(book)}
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
