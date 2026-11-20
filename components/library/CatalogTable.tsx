"use client";

import { useState } from "react";
import { ChevronRight, Sparkles, Ticket } from "lucide-react";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { Badge } from "@/components/ui/badge";
import { ReserveTitleButton } from "@/components/common/ReserveTitleButton";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { cn, getCategoryName } from "@/lib/utils";
import type { Book } from "@/lib/types";
import type { BookSortColumn } from "@/lib/catalog-sort";

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
  columnSort?: (column: BookSortColumn) => LuminaColumn<Book>["sort"];
}

/** Tabular catalog view matching Inventory's table mode with inline reservation controls. */
export function CatalogTable({
  books,
  reservedBooksMap,
  onReserveSuccess,
  onCancelSuccess,
  columnSort,
}: CatalogTableProps) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const renderAction = (book: Book) => {
    const reserved = reservedBooksMap.get(book.id);
    if (book.total_copies === 0 && !reserved) {
      return <span className="text-xs text-muted-foreground">Unavailable</span>;
    }
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
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold shadow-none hover:scale-100 [&_svg]:size-3.5"
          onReserveSuccess={(pos, status, expires) => onReserveSuccess(book.id, pos, status, expires)}
        />
      </div>
    );
  };

  const renderCopies = (book: Book) => {
    const total = book.total_copies ?? book.available_copies;
    return (
      <Badge variant={book.available_copies === 0 ? "destructive" : "secondary"} className="rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight tabular-nums whitespace-nowrap">
        {book.available_copies} / {total}
      </Badge>
    );
  };

  // Phone width: one compact list row per book. Tapping it opens the book dialog,
  // whose footer holds the reserve action, so the row carries no button.
  const renderMobileRow = (book: Book) => {
    const reserved = reservedBooksMap.get(book.id);
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">{book.author}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reserved && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs font-semibold">
              {reserved.status === "READY" ? "Ready" : `#${reserved.queuePosition}`}
            </Badge>
          )}
          {renderCopies(book)}
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
    );
  };

  const columns: LuminaColumn<Book>[] = [
    {
      header: "Title",
      sort: columnSort?.("title"),
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
      sort: columnSort?.("author"),
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
      sort: columnSort?.("availability"),
      accessor: renderCopies,
    },
    {
      header: "Action",
      accessor: renderAction,
    },
  ];

  return (
    <>
      <LuminaTable
        data={books}
        columns={columns}
        onRowClick={(book) => setSelectedBook(book)}
        renderMobileRow={renderMobileRow}
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
