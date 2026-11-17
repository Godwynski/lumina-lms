"use client";

import { useState } from "react";
import { Sparkles, Ticket } from "lucide-react";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { Badge } from "@/components/ui/badge";
import { ReserveTitleButton } from "@/components/common/ReserveTitleButton";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { cn, getCategoryName } from "@/lib/utils";
import type { Book } from "@/lib/types";

export interface CatalogReservationInfo {
  status: string;
  queuePosition: number;
  holdExpiresAt?: string | null;
}

interface CatalogTableProps {
  books: Book[];
  reservedBooksMap: Map<string, CatalogReservationInfo>;
  onReserveSuccess: (
    bookId: string,
    queuePosition: number,
    status: "READY" | "ACTIVE",
    holdExpiresAt?: string | null
  ) => void;
  onCancelSuccess: (bookId: string) => void;
}

/** Tabular catalog view matching Inventory's table mode with inline reservation controls. */
export function CatalogTable({
  books,
  reservedBooksMap,
  onReserveSuccess,
  onCancelSuccess,
}: CatalogTableProps) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const columns: LuminaColumn<Book>[] = [
    {
      header: "Title",
      mobileMain: true,
      accessor: (book) => {
        const reserved = reservedBooksMap.get(book.id);
        const isReady = reserved?.status === "READY";
        return (
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-foreground line-clamp-1">{book.title}</p>
              {book.section && (
                <p className="text-xs text-muted-foreground">{book.section}</p>
              )}
            </div>
            {reserved && (
              <Badge
                variant={isReady ? "default" : "outline"}
                className={cn(
                  "shrink-0 text-xs px-1.5 py-0 h-5 gap-1 font-semibold",
                  isReady
                    ? "bg-emerald-700 hover:bg-emerald-700 text-white border-transparent"
                    : "border-primary/30 text-primary bg-primary/5"
                )}
              >
                {isReady ? <Sparkles className="h-2.5 w-2.5" /> : <Ticket className="h-2.5 w-2.5" />}
                {isReady ? "Ready" : `#${reserved.queuePosition}`}
              </Badge>
            )}
          </div>
        );
      },
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
        const isOutOfStock = book.available_copies === 0;
        const total = book.total_copies ?? book.available_copies;
        return (
          <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight tabular-nums whitespace-nowrap">
            {book.available_copies} / {total}
          </Badge>
        );
      },
    },
    {
      header: "Action",
      accessor: (book) => {
        const reserved = reservedBooksMap.get(book.id);
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ReserveTitleButton
              bookId={book.id}
              isAvailable={book.available_copies > 0}
              hasExistingReservation={!!reserved}
              isReady={reserved?.status === "READY"}
              queuePosition={reserved?.queuePosition}
              holdExpiresAt={reserved?.holdExpiresAt}
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5 rounded-lg"
              onReserveSuccess={(pos, status, expires) => onReserveSuccess(book.id, pos, status, expires)}
            />
          </div>
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
          variant="student"
          initialData={selectedBook}
          onCancelSuccess={() => onCancelSuccess(selectedBook.id)}
        />
      )}
    </>
  );
}
