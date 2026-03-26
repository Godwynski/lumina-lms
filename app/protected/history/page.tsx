"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, Clock, CheckCircle2, AlertCircle, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BookInfo = {
  id: string;
  title: string;
  author: string;
};

type BorrowingRecord = {
  id: string;
  book_copy_id: string;
  user_id: string;
  status: "ACTIVE" | "RETURNED" | "OVERDUE" | "LOST";
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  renewal_count: number;
  books: BookInfo | null;
};

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [records, setRecords] = useState<BorrowingRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "RETURNED" | "OVERDUE">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setRecords([]);
          setTotalCount(0);
          return;
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: recordsData, error: recordsError, count } = await supabase
          .from("borrowing_records")
          .select("id, book_copy_id, status, borrowed_at, due_date, returned_at, renewal_count", { count: "exact" })
          .eq("user_id", user.id)
          .order("borrowed_at", { ascending: false })
          .range(from, to);

        if (recordsError) {
          console.error("Records query error:", recordsError);
          throw recordsError;
        }

        setTotalCount(count ?? 0);

        if (!recordsData || recordsData.length === 0) {
          setRecords([]);
          return;
        }

        const copyIds = [...new Set(recordsData.map((r) => r.book_copy_id))];
        const { data: copiesData } = await supabase
          .from("book_copies")
          .select("id, book_id")
          .in("id", copyIds);

        const copyToBookMap = new Map((copiesData ?? []).map((c) => [c.id, c.book_id]));
        const bookIds = [...new Set((copiesData ?? []).map((c) => c.book_id))];

        const { data: booksData } = await supabase
          .from("books")
          .select("id, title, author")
          .in("id", bookIds);

        const booksMap = new Map((booksData ?? []).map((b) => [b.id, b]));

        const enriched = recordsData.map((record) => {
          const bookId = copyToBookMap.get(record.book_copy_id);
          return {
            ...record,
            books: bookId ? booksMap.get(bookId) ?? null : null,
          };
        });

        setRecords(enriched as BorrowingRecord[]);
      } catch (error) {
        console.error("Failed to load history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, [supabase, page]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const book = record.books;
      const matchesSearch =
        !searchQuery ||
        book?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book?.author?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const getStatusBadge = (status: BorrowingRecord["status"]) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Active</Badge>;
      case "RETURNED":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Returned</Badge>;
      case "OVERDUE":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>;
      case "LOST":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Lost</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Borrow History</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Review your borrowing timeline, due dates, and completed returns.
          </p>
        </div>
      </section>

      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by title or author"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-lg pl-9"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "ACTIVE", "RETURNED", "OVERDUE"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === status
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {status === "all" ? "All" : status === "ACTIVE" ? "Active" : status === "RETURNED" ? "Returned" : "Overdue"}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {records.length === 0
                  ? "No borrowing history yet."
                  : "No records match your search."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredRecords.map((record) => {
                const overdue = isOverdue(record);
                const book = record.books;
                return (
                  <div key={record.id} className="flex items-start gap-4 p-4 hover:bg-muted/40">
                    <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-xs font-bold text-muted-foreground">
                      {book?.title?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {book?.title || "Unknown Title"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {book?.author || "Unknown Author"}
                          </p>
                        </div>
                        <div className="shrink-0">{getStatusBadge(overdue ? "OVERDUE" : record.status)}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} />
                          Borrowed: {formatDate(record.borrowed_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          Due: {formatDate(record.due_date)}
                        </span>
                        {record.returned_at && (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 size={12} />
                            Returned: {formatDate(record.returned_at)}
                          </span>
                        )}
                        {record.renewal_count > 0 && (
                          <span className="text-blue-600">
                            Renewed {record.renewal_count}x
                          </span>
                        )}
                        {overdue && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <AlertCircle size={12} />
                            Overdue
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} total records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
