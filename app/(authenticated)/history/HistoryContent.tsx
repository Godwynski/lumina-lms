"use client";

import { useState, use } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, Clock, CheckCircle2, AlertCircle, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { BorrowingRecord } from "@/lib/actions/history";

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

  const getStatusBadge = (status: BorrowingRecord["status"]) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none shadow-none text-[10px] uppercase font-bold px-2 py-0.5">Active</Badge>;
      case "RETURNED":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none shadow-none text-[10px] uppercase font-bold px-2 py-0.5">Returned</Badge>;
      case "OVERDUE":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none shadow-none text-[10px] uppercase font-bold px-2 py-0.5">Overdue</Badge>;
      case "LOST":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-none shadow-none text-[10px] uppercase font-bold px-2 py-0.5">Lost</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5">{status}</Badge>;
    }
  };

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

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <div className="space-y-4 w-full">
      <Card className="border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateFilters({ q: localSearch, page: 1 });
              }}
              className="relative w-full sm:max-w-xs"
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search history..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="h-10 rounded-lg pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
              />
            </form>
            <div className="flex gap-1.5 p-1 bg-muted/30 rounded-lg border border-border/50">
              {(["all", "ACTIVE", "RETURNED", "OVERDUE"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => updateFilters({ status, page: 1 })}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                    statusFilter === status
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {status === "all" ? "All" : status.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="status-muted mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
                <BookOpen size={32} />
              </div>
              <p className="text-sm font-semibold text-foreground italic">
                {searchQuery || statusFilter !== "all"
                  ? "No matching records found."
                  : "Start your library journey today!"}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-4 text-xs h-8"
                onClick={() => updateFilters({ q: "", status: "all", page: 1 })}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {records.map((record) => {
                const overdue = isOverdue(record);
                const book = record.books;
                return (
                  <div key={record.id} className="flex items-start gap-4 p-5 transition-colors hover:bg-muted/30 group">
                    <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest transition-transform group-hover:scale-105">
                      {book?.title?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">
                            {book?.title || "Unknown Title"}
                          </p>
                          <p className="truncate text-[11px] font-medium text-muted-foreground">
                            by {book?.author || "Internal Entity"}
                          </p>
                        </div>
                        <div className="shrink-0">{getStatusBadge(overdue ? "OVERDUE" : record.status)}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-primary/70" />
                          {formatDate(record.borrowed_at)}
                        </span>
                        <span className={cn("flex items-center gap-1.5", overdue ? "text-destructive" : "")}>
                          <Clock size={12} className={cn("opacity-70", overdue ? "text-destructive" : "text-primary/70")} />
                          {formatDate(record.due_date)}
                        </span>
                        {record.returned_at && (
                          <span className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 size={12} className="opacity-70" />
                            {formatDate(record.returned_at)}
                          </span>
                        )}
                        {overdue && (
                          <span className="flex items-center gap-1.5 text-destructive animate-pulse">
                            <AlertCircle size={12} />
                            Critical Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Showing {records.length} of {totalCount} records
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-muted"
              disabled={page <= 1}
              onClick={() => updateFilters({ page: page - 1 })}
            >
              <ChevronLeft size={14} className="mr-1" />
              Prev
            </Button>
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground bg-muted px-2 py-1 rounded">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-muted"
              disabled={page >= totalPages}
              onClick={() => updateFilters({ page: page + 1 })}
            >
              Next
              <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

