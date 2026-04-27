"use client";

import { useState, use } from "react";
import { Search, BookOpen, Clock, CheckCircle2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { BorrowingRecord } from "@/lib/actions/history";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";

interface HistoryContentProps {
  historyPromise: Promise<{ records: BorrowingRecord[]; totalCount: number }>;
  page: number;
  statusFilter: string;
  searchQuery: string;
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
}: HistoryContentProps) {
  const { records, totalCount } = use(historyPromise);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const updateFilters = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });
    router.push(`/history?${params.toString()}`);
  };

// Redundant badge logic removed, using centralized StatusBadge

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isOverdue = (record: BorrowingRecord) => {
    return record.status === "ACTIVE" && new Date(record.due_date) < new Date();
  };

  const columns: LuminaColumn<BorrowingRecord>[] = [
    {
      header: "Resource",
      accessor: (record) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-[10px] font-black text-muted-foreground uppercase tracking-widest group-hover:bg-background transition-colors">
            {record.books?.title?.charAt(0) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {record.books?.title || "Unknown Title"}
            </p>
            <p className="truncate text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {record.books?.author || "Internal Entity"}
            </p>
          </div>
        </div>
      ),
      mobileMain: true
    },
    {
      header: "Borrowed",
      accessor: (record) => (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted-foreground" />
          <span className="text-[11px] font-bold text-foreground">{formatDate(record.borrowed_at)}</span>
        </div>
      )
    },
    {
      header: "Due Date",
      accessor: (record) => {
        const overdue = isOverdue(record);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Clock size={14} className={cn("text-muted-foreground", overdue && "text-destructive")} />
              <span className={cn("text-[11px] font-bold", overdue ? "text-destructive" : "text-foreground")}>
                {formatDate(record.due_date)}
              </span>
            </div>
            {record.returned_at && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
                <CheckCircle2 size={12} />
                Returned {formatDate(record.returned_at)}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: "Status",
      accessor: (record) => {
        const overdue = isOverdue(record);
        return <StatusBadge status={overdue ? "OVERDUE" : record.status} />;
      }
    }
  ];

  return (
    <div className="space-y-4 w-full">
      {/* Header Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-border/10 bg-card/40 rounded-2xl backdrop-blur-sm shadow-sm font-sans">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            updateFilters({ q: localSearch, page: 1 });
          }}
          className="relative w-full sm:max-w-xs"
        >
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            type="text"
            placeholder="Search timeline..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-10 rounded-xl pl-9 bg-muted/10 border-border/40 focus:bg-background transition-all text-xs font-bold"
          />
        </form>
        <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-xl border border-border/10">
          {(["all", "ACTIVE", "RETURNED", "OVERDUE"] as const).map((status) => (
            <button
              key={status}
              onClick={() => updateFilters({ status, page: 1 })}
              className={cn(
                "rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
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

      <LuminaTable
        data={records}
        columns={columns}
        totalCount={totalCount}
        page={page}
        pageSize={10}
        onPageChange={(p) => updateFilters({ page: p })}
        emptyState={{
          title: searchQuery || statusFilter !== "all" ? "No matches found" : "Timeline empty",
          description: searchQuery || statusFilter !== "all" ? "Try reframing your search strategy." : "Your borrowing history will appear here.",
          icon: BookOpen,
          action: {
            label: "Clear All Filters",
            onClick: () => updateFilters({ q: "", status: "all", page: 1 })
          }
        }}
      />
    </div>
  );
}

