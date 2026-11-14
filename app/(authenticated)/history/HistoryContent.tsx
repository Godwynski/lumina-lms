"use client";

import { useState, use, useEffect, useTransition, useCallback, useRef } from "react";
import Image from "next/image";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { BorrowerDetailsModal } from "@/components/common/BorrowerDetailsModal";
import { Search, BookOpen, Clock, CheckCircle2, Calendar, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDisplayDate } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { BorrowingRecord, settleBorrowingFine } from "@/lib/actions/history";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { type UserRole } from "@/lib/auth-helpers";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { CompactPagination } from "@/components/ui/compact-pagination";

interface HistoryContentProps {
  historyPromise: Promise<{ records: BorrowingRecord[]; totalCount: number }>;
  page: number;
  statusFilter: string;
  searchQuery: string;
  userRole: UserRole;
  userId?: string | null;
}

function HistoryBookCover({ coverUrl, title }: { coverUrl?: string | null; title?: string }) {
  const [imgError, setImgError] = useState(false);

  if (!coverUrl || imgError) {
    return (
      <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-[11px] font-black text-muted-foreground uppercase tracking-widest group-hover:bg-background transition-colors">
        {title?.charAt(0) || "?"}
      </div>
    );
  }

  return (
    <div className="relative flex h-10 w-8 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30 shadow-xs">
      <Image
        src={coverUrl}
        alt={title || "Book cover"}
        fill
        className="object-cover"
        unoptimized
        onError={() => setImgError(true)}
      />
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="space-y-4 w-full animate-pulse">
      <div className="h-20 w-full bg-muted rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 w-full bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function HistoryContent({
  historyPromise,
  page,
  statusFilter,
  searchQuery,
  userRole,
}: HistoryContentProps) {
  const { records, totalCount } = use(historyPromise);
  const [selectedBook, setSelectedBook] = useState<BorrowingRecord["books"]>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<BorrowingRecord["profiles"]>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    detailTrigger.current?.focus();
  };
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ record: BorrowingRecord } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep local search in sync if URL query changes externally
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Realtime refresh with startTransition wrapping router.refresh()
  useEffect(() => {
    const supabase = createClient();
    const channelName = `history-realtime-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'borrowing_records' }, 
        () => {
          startTransition(() => {
            router.refresh();
          });
        }
      )
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'book_copies' }, 
        () => {
          startTransition(() => {
            router.refresh();
          });
        }
      )
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'books' }, 
        () => {
          startTransition(() => {
            router.refresh();
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, startTransition]);

  const updateFilters = useCallback((updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });
    startTransition(() => {
      router.replace(`/history?${params.toString()}`, { scroll: false });
    });
  }, [searchParams, router, startTransition]);

  // Debounced auto-search on typing (300ms) with zero UI freezing
  useEffect(() => {
    if (localSearch === searchQuery) return;
    const timer = setTimeout(() => {
      updateFilters({ q: localSearch, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, updateFilters]);

  const formatDate = (dateStr: string) => formatDisplayDate(dateStr);

  const isOverdue = (record: BorrowingRecord) => {
    return (
      record.status?.toUpperCase() === "OVERDUE" ||
      (record.status?.toUpperCase() === "ACTIVE" && new Date(record.due_date) < new Date())
    );
  };

  const handleSettle = async (
    recordId: string,
    mode: "settle" | "return_and_settle" | "return_only" = "settle"
  ) => {
    setSettlingId(recordId);
    try {
      const res = await settleBorrowingFine({ recordId, mode });
      if (!res.success) {
        toast.error(res.error || "Failed to process overdue action");
        return;
      }
      toast.success(
        mode === "return_only"
          ? "Book returned (penalty marked unpaid)"
          : mode === "return_and_settle"
            ? "Book returned and overdue penalty settled"
            : "Overdue penalty settled"
      );
      setPendingAction(null);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSettlingId(null);
    }
  };

  const viewParam = searchParams.get("view");
  const isPrivileged =
    userRole === "super_admin" ||
    userRole === "librarian" ||
    (userRole === "student_assistant" && viewParam === "logs");

  const columns: LuminaColumn<BorrowingRecord>[] = [
    ...(isPrivileged
      ? [
          {
            header: "Borrower",
            accessor: (record: BorrowingRecord) => (
              <div className="flex flex-col">
                {record.profiles ? <button type="button"
                  aria-label={`View borrower: ${record.profiles.full_name || "Unknown User"}`}
                  className="w-fit text-left text-xs font-bold text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={(event) => { detailTrigger.current = event.currentTarget; setSelectedBorrower(record.profiles); }}>
                  {record.profiles.full_name || "Unknown User"}
                </button> : <span className="text-xs font-bold">Unknown User</span>}
                <span className="text-[11px] text-muted-foreground uppercase tracking-tighter">
                  {record.profiles?.student_id ||
                    record.profiles?.email?.split("@")[0] ||
                    "No ID"}
                </span>
              </div>
            ),
          },
        ]
      : []),
    {
      header: "Resource",
      accessor: (record) => (
        <button type="button" disabled={!record.books?.id}
          aria-label={`View book details: ${record.books?.title || "Unknown Title"}`}
          onClick={(event) => { detailTrigger.current = event.currentTarget; setSelectedBook(record.books); }}
          className="group flex max-w-full items-center gap-3 rounded-md text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:no-underline">
          <HistoryBookCover coverUrl={record.books?.cover_url} title={record.books?.title} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-foreground">
                {record.books?.title || "Unknown Title"}
              </p>
              {record.status?.toUpperCase() === 'RETURNED' && (
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              )}
            </div>
            <p className="truncate text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {record.books?.author || "Internal Entity"}
            </p>
          </div>
        </button>
      ),
      mobileMain: true,
    },
    {
      header: "Borrowed",
      accessor: (record) => (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted-foreground" />
          <span className="text-[11px] font-bold text-foreground">{formatDate(record.borrowed_at)}</span>
        </div>
      ),
    },
    {
      header: "Timeline",
      accessor: (record) => {
        const overdue = isOverdue(record);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Clock size={14} className={cn("text-muted-foreground", overdue && "text-destructive")} />
              <span className={cn("text-[11px] font-bold", overdue ? "text-destructive" : "text-foreground")}>
                Due {formatDate(record.due_date)}
              </span>
            </div>
            {record.returned_at && (
              <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 uppercase tracking-tight">
                <CheckCircle2 size={12} strokeWidth={3} />
                Returned {formatDate(record.returned_at)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: "Status",
      accessor: (record) => {
        const overdue = isOverdue(record);
        return <StatusBadge status={overdue ? "OVERDUE" : record.status} />;
      },
    },
    ...(statusFilter === "ACTIVE"
      ? []
      : [
          {
            header: "Penalty",
            accessor: (record: BorrowingRecord) => {
              const fine = Number(record.fine_amount ?? 0);
              if (fine <= 0) {
                return <span className="text-[11px] font-bold text-muted-foreground">—</span>;
              }
              if (record.fine_settled_at) {
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground tabular-nums">
                      ₱{fine.toFixed(2)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Settled
                    </span>
                  </div>
                );
              }
              const isUnreturned = !record.returned_at;
              return (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-destructive tabular-nums">
                    ₱{fine.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                      isUnreturned
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {isUnreturned ? "Accruing" : "Unpaid"}
                  </span>
                  {isPrivileged && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={settlingId === record.id}
                      onClick={() => setPendingAction({ record })}
                      className="h-7 rounded-lg px-2.5 text-[11px] font-black uppercase tracking-wider"
                    >
                      {settlingId === record.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isUnreturned ? (
                        "Return / Settle"
                      ) : (
                        "Settle"
                      )}
                    </Button>
                  )}
                </div>
              );
            },
          },
        ]),
  ];

  const filterControls = (
    <div className="flex flex-wrap items-center justify-between gap-4 w-full font-sans">
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          updateFilters({ q: localSearch, page: 1 });
        }}
        className="relative w-full sm:max-w-xs"
      >
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          type="search"
          aria-label="Search borrowing history"
          placeholder="Search timeline, borrower, book, barcode..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="h-10 rounded-xl pl-9 pr-8 bg-muted/10 border-border/40 focus:bg-background transition-all text-xs font-bold"
        />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary animate-spin" />
        )}
      </form>
      <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/20 rounded-xl border border-border/10">
        {(["all", "ACTIVE", "OVERDUE", "RETURNED", "SETTLED"] as const).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={statusFilter === status}
            onClick={() => updateFilters({ status, page: 1 })}
            className={cn(
              "rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all",
              statusFilter === status
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {status === "all" ? "All" : status.toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
    <AdminTableShell
      controls={filterControls}
      pagination={
        totalCount > 0 ? (
          <CompactPagination
            page={page}
            totalItems={totalCount}
            pageSize={10}
            onPageChange={(p) => updateFilters({ page: p })}
            variant="ghost"
          />
        ) : null
      }
      className={cn(
        "max-w-none animate-in fade-in-50 duration-300 transition-opacity",
        isPending && "opacity-80"
      )}
    >
      <LuminaTable
        data={records}
        columns={columns}
        noBorder
        emptyState={{
          title: searchQuery || statusFilter !== "all" ? "No matches found" : "Timeline empty",
          description: searchQuery || statusFilter !== "all" 
            ? "Try searching for a book title, borrower name, date (e.g. 'Oct' or '2026'), or barcode." 
            : isPrivileged 
              ? "No borrowing records exist in the system yet."
              : "Your borrowing history will appear here.",
          icon: BookOpen,
          action: {
            label: "Clear All Filters",
            onClick: () => updateFilters({ q: "", status: "all", page: 1 }),
          },
        }}
      />

      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <DialogContent>
          {pendingAction && !pendingAction.record.returned_at ? (
            <>
              <DialogHeader>
                <DialogTitle>Return &amp; Penalty Settlement</DialogTitle>
                <DialogDescription>
                  <span className="font-semibold text-foreground">
                    {pendingAction.record.books?.title || "This book"}
                  </span>{" "}
                  is still checked out with an accruing penalty of{" "}
                  <span className="font-bold text-destructive tabular-nums">
                    ₱{Number(pendingAction.record.fine_amount ?? 0).toFixed(2)}
                  </span>
                  . Return the copy first, then settle now or mark it unpaid to pay later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={settlingId === pendingAction.record.id}
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={settlingId === pendingAction.record.id}
                  onClick={() => handleSettle(pendingAction.record.id, "return_only")}
                >
                  Return Only (Pay Later)
                </Button>
                <Button
                  type="button"
                  disabled={settlingId === pendingAction.record.id}
                  onClick={() => handleSettle(pendingAction.record.id, "return_and_settle")}
                >
                  Return &amp; Settle (₱{Number(pendingAction.record.fine_amount ?? 0).toFixed(2)})
                </Button>
              </DialogFooter>
            </>
          ) : pendingAction ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Penalty Settlement</DialogTitle>
                <DialogDescription>
                  Mark the overdue penalty of{" "}
                  <span className="font-bold text-destructive tabular-nums">
                    ₱{Number(pendingAction.record.fine_amount ?? 0).toFixed(2)}
                  </span>{" "}
                  for{" "}
                  <span className="font-semibold text-foreground">
                    {pendingAction.record.books?.title || "this book"}
                  </span>{" "}
                  as paid?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={settlingId === pendingAction.record.id}
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={settlingId === pendingAction.record.id}
                  onClick={() => handleSettle(pendingAction.record.id, "settle")}
                >
                  Confirm Settle (₱{Number(pendingAction.record.fine_amount ?? 0).toFixed(2)})
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminTableShell>
    {selectedBook && <BookDetailModal key={selectedBook.id} bookId={selectedBook.id}
      open variant="read_only" onOpenChange={(open) => { if (!open) setSelectedBook(null); }}
      onCloseAutoFocus={restoreFocus} />}
    <BorrowerDetailsModal borrower={selectedBorrower} onClose={() => setSelectedBorrower(null)}
      canOpenProfile={userRole === 'super_admin' || userRole === 'librarian'} onCloseAutoFocus={restoreFocus} />
    </>
  );
}
