"use client";

import { useState, use, useEffect, useTransition, useCallback, useRef } from "react";
import Image from "next/image";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { BorrowerDetailsModal } from "@/components/common/BorrowerDetailsModal";
import { Search, BookOpen, Clock, CheckCircle2, Calendar, Loader2, Download, Printer, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FineSettlementDialog } from "@/components/common/FineSettlementDialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDisplayDate } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BorrowingRecord,
  FineResolution,
  exportBorrowingHistory,
  settleBorrowingFine,
} from "@/lib/actions/history";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { type UserRole } from "@/lib/auth-helpers";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { CompactPagination } from "@/components/ui/compact-pagination";

interface HistoryContentProps {
  historyPromise: Promise<{ records: BorrowingRecord[]; totalCount: number }>;
  page: number;
  statusFilter: string;
  resolutionFilter?: string;
  searchQuery: string;
  userRole: UserRole;
  userId?: string | null;
}

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "RETURNED", label: "Returned" },
  { key: "SETTLED", label: "Settlements" },
] as const;

const RESOLUTION_FILTERS = [
  { key: "all", label: "All" },
  { key: "PAID", label: "Paid" },
  { key: "CONDONED", label: "Condoned" },
] as const;

function ResolutionBadge({ resolution }: { resolution?: FineResolution | null }) {
  const isCondoned = resolution === "CONDONED";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        isCondoned
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
      )}
    >
      {isCondoned ? "Condoned" : "Paid"}
    </span>
  );
}

function HistoryBookCover({ coverUrl, title }: { coverUrl?: string | null; title?: string }) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = Boolean(coverUrl) && !imgError;

  return (
    <div className="relative flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-primary/5 text-xs font-bold text-primary/70 uppercase">
      <span>{title?.charAt(0) || "?"}</span>
      {showImage && (
        <Image
          src={coverUrl!}
          alt={title || "Book cover"}
          fill
          className={cn("object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
          unoptimized
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
              setImgError(true);
            } else {
              setLoaded(true);
            }
          }}
          onError={() => setImgError(true)}
        />
      )}
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
  resolutionFilter,
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
  const effectiveResolution = (resolutionFilter ?? searchParams.get("resolution") ?? "all").toUpperCase() === "ALL"
    ? "all"
    : (resolutionFilter ?? searchParams.get("resolution") ?? "all").toUpperCase();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
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
    if (!("status" in updates) && statusFilter && statusFilter !== "all" && !params.has("status")) {
      params.set("status", statusFilter);
    }
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
  }, [searchParams, statusFilter, router, startTransition]);

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
    mode: "settle" | "return_and_settle" | "return_only" = "settle",
    resolution: FineResolution = "PAID",
    remarks?: string
  ) => {
    setSettlingId(recordId);
    try {
      const payload: {
        recordId: string;
        mode: "settle" | "return_and_settle" | "return_only";
        resolution?: FineResolution;
        remarks?: string;
      } = { recordId, mode };
      if (mode !== "return_only") {
        payload.resolution = resolution;
        if (remarks && remarks.trim().length > 0) {
          payload.remarks = remarks.trim();
        }
      }
      const res = await settleBorrowingFine(payload);
      if (!res.success) {
        toast.error(res.error || "Failed to process overdue action");
        return;
      }
      const resLabel = resolution === "CONDONED" ? "condoned" : "paid";
      toast.success(
        mode === "return_only"
          ? "Book returned (penalty marked receivable)"
          : mode === "return_and_settle"
            ? `Book returned and penalty marked as ${resLabel}`
            : `Penalty marked as ${resLabel}`
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
    (userRole === "library_staff" && viewParam === "logs");

  const isSettlementsTab = statusFilter.toUpperCase() === "SETTLED";
  const isOverdueTab = statusFilter.toUpperCase() === "OVERDUE";
  const showExportPrint = isOverdueTab || isSettlementsTab;

  const handleExportXlsx = async () => {
    setIsExporting(true);
    try {
      const res = await exportBorrowingHistory({
        status: statusFilter,
        resolution: effectiveResolution,
        search: searchQuery,
        scope: isPrivileged ? "logs" : "personal",
      });
      if (!res.success) {
        toast.error(res.error || "Failed to export records");
        return;
      }
      if (res.data.records.length === 0) {
        toast.info("No records match the current filters.");
        return;
      }

      const XLSX = await import("xlsx");
      const rows = res.data.records.map((r) => {
        const fine = Number(r.fine_amount ?? 0);
        const fineStatus =
          fine <= 0
            ? "None"
            : r.fine_settled_at
              ? r.fine_resolution === "CONDONED"
                ? "Condoned"
                : "Paid"
              : "Receivable";
        return {
          ...(isPrivileged
            ? {
                Borrower: r.profiles?.full_name || "Unknown User",
                "Patron ID": r.profiles?.student_id || "—",
                Email: r.profiles?.email || "—",
              }
            : {}),
          "Book Title": r.books?.title || "Unknown Title",
          Author: r.books?.author || "—",
          "Copy QR": r.copy_qr || "—",
          Borrowed: formatDate(r.borrowed_at),
          "Due Date": formatDate(r.due_date),
          Returned: r.returned_at ? formatDate(r.returned_at) : "Not returned",
          Status: isOverdue(r) ? "OVERDUE" : r.status,
          "Fine Amount (PHP)": fine.toFixed(2),
          "Fine Resolution": fineStatus,
          Remarks: r.fine_remarks || "—",
          "Settled Date": r.fine_settled_at ? formatDate(r.fine_settled_at) : "—",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      const sheetTitle = isSettlementsTab ? "Settlements" : "Overdue & Receivables";
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
      const filename = isSettlementsTab
        ? "lumina_fine_settlements.xlsx"
        : "lumina_overdue_receivables.xlsx";
      XLSX.writeFile(workbook, filename);
      toast.success(`Exported ${rows.length} record(s) to Excel.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

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
                  onClick={(event) => { event.stopPropagation(); detailTrigger.current = event.currentTarget; setSelectedBorrower(record.profiles); }}>
                  {record.profiles.full_name || "Unknown User"}
                </button> : <span className="text-xs font-bold">Unknown User</span>}
                <span className="text-xs text-muted-foreground">
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
          onClick={(event) => { event.stopPropagation(); detailTrigger.current = event.currentTarget; setSelectedBook(record.books); }}
          className="group flex max-w-full items-center gap-3 rounded-md text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:no-underline">
          <HistoryBookCover coverUrl={record.books?.cover_url} title={record.books?.title} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-foreground">
                {record.books?.title || "Unknown Title"}
              </p>
              {record.status?.toUpperCase() === 'RETURNED' && (
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {record.books?.author || "Internal Entity"}
            </p>
          </div>
        </button>
      ),
      mobileMain: true,
    },
    ...(isSettlementsTab
      ? [
          {
            header: "Fine Amount",
            accessor: (record: BorrowingRecord) => (
              <span className="text-xs font-semibold text-foreground tabular-nums">
                ₱{Number(record.fine_amount ?? 0).toFixed(2)}
              </span>
            ),
          },
          {
            header: "Resolution",
            accessor: (record: BorrowingRecord) => (
              <ResolutionBadge resolution={record.fine_resolution} />
            ),
          },
          {
            header: "Remarks",
            accessor: (record: BorrowingRecord) => (
              <span
                className="block max-w-[240px] truncate text-xs text-muted-foreground"
                title={record.fine_remarks || undefined}
              >
                {record.fine_remarks || "—"}
              </span>
            ),
          },
          {
            header: "Settled Date",
            accessor: (record: BorrowingRecord) => (
              <span className="text-xs font-medium text-foreground whitespace-nowrap">
                {record.fine_settled_at ? formatDate(record.fine_settled_at) : "—"}
              </span>
            ),
          },
        ]
      : [
          {
            header: "Borrowed",
            accessor: (record: BorrowingRecord) => (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground whitespace-nowrap">{formatDate(record.borrowed_at)}</span>
              </div>
            ),
          },
          {
            header: "Timeline",
            accessor: (record: BorrowingRecord) => {
              const overdue = isOverdue(record);
              return (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className={cn("text-muted-foreground shrink-0", overdue && "text-destructive")} />
                    <span className={cn("text-xs font-medium whitespace-nowrap", overdue ? "text-destructive font-semibold" : "text-foreground")}>
                      Due {formatDate(record.due_date)}
                    </span>
                  </div>
                  {record.returned_at && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                      Returned {formatDate(record.returned_at)}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            header: "Status",
            accessor: (record: BorrowingRecord) => {
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
                      return <span className="text-xs text-muted-foreground">—</span>;
                    }
                    if (record.fine_settled_at) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground tabular-nums">
                            ₱{fine.toFixed(2)}
                          </span>
                          <ResolutionBadge resolution={record.fine_resolution} />
                        </div>
                      );
                    }
                    const isUnreturned = !record.returned_at;
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-destructive tabular-nums">
                          ₱{fine.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                            isUnreturned
                              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
                              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300"
                          )}
                        >
                          Receivable
                        </span>
                        {isPrivileged && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={settlingId === record.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingAction({ record });
                            }}
                            className="h-8 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap print:hidden"
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
        ]),
  ];

  const filterControls = (
    <div className="flex flex-col gap-3 w-full font-sans print:hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 w-full">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            updateFilters({ q: localSearch, page: 1 });
          }}
          className="relative w-full lg:max-w-xs"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search borrowing history"
            placeholder="Search timeline, borrower, book, barcode..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-10 rounded-xl pl-9 pr-9 bg-background border-border/60 transition-all text-sm [&::-webkit-search-cancel-button]:appearance-none"
          />
          {isPending ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary animate-spin" />
          ) : localSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={() => {
                setLocalSearch("");
                updateFilters({ q: "", page: 1 });
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </form>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/30 rounded-xl border border-border/40 w-full sm:w-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={statusFilter === tab.key}
              onClick={() => updateFilters({ status: tab.key, resolution: tab.key === "SETTLED" ? effectiveResolution : "", page: 1 })}
              className={cn(
                "h-8 sm:h-9 rounded-lg px-2.5 sm:px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors",
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {(isSettlementsTab || showExportPrint) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {isSettlementsTab ? (
            <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/20 rounded-xl border border-border/40" role="group" aria-label="Filter settlements by resolution">
              {RESOLUTION_FILTERS.map((res) => (
                <button
                  key={res.key}
                  type="button"
                  aria-pressed={effectiveResolution === res.key}
                  onClick={() => updateFilters({ resolution: res.key, page: 1 })}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors",
                    effectiveResolution === res.key
                      ? "bg-background text-foreground shadow-xs border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {res.label}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

          {showExportPrint && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={handleExportXlsx}
                className="h-9 rounded-lg gap-1.5 text-xs font-semibold"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export (.xlsx)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-9 rounded-lg gap-1.5 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const hasReceivableRows = isPrivileged && records.some((r) => !r.fine_settled_at && Number(r.fine_amount ?? 0) > 0);

  return (
    <>
    <div className="hidden print:block mb-4 border-b pb-2">
      <h1 className="text-lg font-bold">
        {isSettlementsTab
          ? "Lumina LMS — Fine Settlements Report"
          : isOverdueTab
            ? "Lumina LMS — Overdue & Receivable Fines Report"
            : "Lumina LMS — Borrowing History"}
      </h1>
      <p className="text-xs text-muted-foreground">
        Filter: {statusFilter}
        {isSettlementsTab && effectiveResolution !== "all" ? ` · Resolution: ${effectiveResolution}` : ""}
        {searchQuery ? ` · Search: "${searchQuery}"` : ""}
      </p>
    </div>

    <AdminTableShell
      controls={filterControls}
      pagination={
        totalCount > 0 ? (
          <div className="print:hidden">
            <CompactPagination
              page={page}
              totalItems={totalCount}
              pageSize={10}
              onPageChange={(p) => updateFilters({ page: p })}
              variant="ghost"
            />
          </div>
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
        onRowClick={
          hasReceivableRows
            ? (record) => {
                if (isPrivileged && !record.fine_settled_at && Number(record.fine_amount ?? 0) > 0) {
                  setPendingAction({ record });
                }
              }
            : undefined
        }
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
            onClick: () => updateFilters({ q: "", status: "all", resolution: "", page: 1 }),
          },
        }}
      />

      <FineSettlementDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title={pendingAction && !pendingAction.record.returned_at ? "Return & Penalty Settlement" : "Penalty Settlement"}
        description={
          pendingAction && !pendingAction.record.returned_at ? (
            <>
              <span className="font-semibold text-foreground">
                {pendingAction.record.books?.title || "This book"}
              </span>{" "}
              is still checked out with an accruing penalty of{" "}
              <span className="font-bold text-destructive tabular-nums">
                ₱{Number(pendingAction.record.fine_amount ?? 0).toFixed(2)}
              </span>
              . Return the copy first, then mark it as Paid or Condoned, or return unpaid (Receivable).
            </>
          ) : pendingAction ? (
            <>
              Resolve the overdue penalty of{" "}
              <span className="font-bold text-destructive tabular-nums">
                ₱{Number(pendingAction.record.fine_amount ?? 0).toFixed(2)}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {pendingAction.record.books?.title || "this book"}
              </span>
              .
            </>
          ) : null
        }
        fineAmount={Number(pendingAction?.record.fine_amount ?? 0)}
        isSubmitting={Boolean(pendingAction && settlingId === pendingAction.record.id)}
        allowReturnOnly={Boolean(pendingAction && !pendingAction.record.returned_at)}
        onReturnOnly={() => {
          if (pendingAction) void handleSettle(pendingAction.record.id, "return_only");
        }}
        onResolve={(resolution, remarks) => {
          if (!pendingAction) return;
          const mode = pendingAction.record.returned_at ? "settle" : "return_and_settle";
          void handleSettle(pendingAction.record.id, mode, resolution, remarks);
        }}
      />
    </AdminTableShell>
    {selectedBook && <BookDetailModal key={selectedBook.id} bookId={selectedBook.id}
      open variant="read_only" onOpenChange={(open) => { if (!open) setSelectedBook(null); }}
      onCloseAutoFocus={restoreFocus} />}
    <BorrowerDetailsModal borrower={selectedBorrower} onClose={() => setSelectedBorrower(null)}
      canOpenProfile={userRole === 'super_admin' || userRole === 'librarian'} onCloseAutoFocus={restoreFocus} />
    </>
  );
}
