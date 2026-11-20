"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { Section } from "@/components/settings/SettingsShared";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { getUserBorrowingHistory, type BorrowingRecord } from "@/lib/actions/history";

export interface UserBorrowingHistoryData {
  records: BorrowingRecord[];
  totalCount: number;
}

const PAGE_SIZE = 10;

function formatHistoryDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isRecordOverdue(record: BorrowingRecord): boolean {
  if (record.status === "OVERDUE") return true;
  return record.status === "ACTIVE" && !record.returned_at && new Date(record.due_date) < new Date();
}

function FineResolutionCell({ record }: { record: BorrowingRecord }) {
  const fine = Number(record.fine_amount ?? 0);
  if (fine <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const label = record.fine_settled_at
    ? record.fine_resolution === "CONDONED"
      ? "Condoned"
      : "Paid"
    : "Receivable";

  const badgeTone = !record.fine_settled_at
    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
    : record.fine_resolution === "CONDONED"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold tabular-nums text-foreground">₱{fine.toFixed(2)}</span>
      <Badge variant="outline" className={`whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>
        {label}
      </Badge>
    </div>
  );
}

export function UserBorrowingHistorySection({
  userId,
  initialHistory,
}: {
  userId: string;
  initialHistory?: UserBorrowingHistoryData;
}) {
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<BorrowingRecord[]>(initialHistory?.records ?? []);
  const [totalCount, setTotalCount] = useState<number>(initialHistory?.totalCount ?? 0);
  const [isLoading, setIsLoading] = useState(!initialHistory);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const skipInitialFetchRef = useRef(Boolean(initialHistory));

  useEffect(() => {
    setPage(1);
    if (initialHistory) {
      setRecords(initialHistory.records);
      setTotalCount(initialHistory.totalCount);
      setIsLoading(false);
      setError(null);
      skipInitialFetchRef.current = true;
    } else {
      skipInitialFetchRef.current = false;
    }
  }, [userId, initialHistory]);

  useEffect(() => {
    if (skipInitialFetchRef.current && page === 1) {
      skipInitialFetchRef.current = false;
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    void getUserBorrowingHistory({ userId, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (requestId !== requestIdRef.current) return;
        if (res.success) {
          setRecords(res.data.records);
          setTotalCount(res.data.totalCount);
        } else {
          setError(res.error || "Unable to load borrowing history.");
        }
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError("Unable to load borrowing history.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      });
  }, [userId, page]);

  const columns: LuminaColumn<BorrowingRecord>[] = [
    {
      header: "Title",
      mobileMain: true,
      accessor: (record) => (
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground truncate max-w-[240px]">
            {record.books?.title || "Unknown Title"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
            {record.books?.author || "Unknown Author"}
          </p>
        </div>
      ),
    },
    {
      header: "Borrowed",
      accessor: (record) => (
        <span className="text-xs text-foreground whitespace-nowrap">{formatHistoryDate(record.borrowed_at)}</span>
      ),
    },
    {
      header: "Due",
      accessor: (record) => (
        <span className="text-xs text-foreground whitespace-nowrap">{formatHistoryDate(record.due_date)}</span>
      ),
    },
    {
      header: "Returned",
      accessor: (record) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatHistoryDate(record.returned_at)}</span>
      ),
    },
    {
      header: "Status",
      accessor: (record) => (
        <StatusBadge status={isRecordOverdue(record) ? "OVERDUE" : record.status} />
      ),
    },
    {
      header: "Fine / Resolution",
      accessor: (record) => <FineResolutionCell record={record} />,
    },
  ];

  return (
    <Section title="Borrowing History" icon={BookOpen}>
      {error && (
        <p role="alert" className="mb-3 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <LuminaTable
        data={records}
        columns={columns}
        isLoading={isLoading}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyState={{
          icon: BookOpen,
          title: "No borrowing history",
          description: "This patron has no recorded book loans.",
        }}
      />
    </Section>
  );
}
