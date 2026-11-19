"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { Section } from "@/components/settings/SettingsShared";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { TableSortSelect, type TableSortDirection } from "@/components/common/TableSort";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { getUserBorrowingHistory, type BorrowingRecord } from "@/lib/actions/history";

export interface UserBorrowingHistoryData {
  records: BorrowingRecord[];
  totalCount: number;
}

const PAGE_SIZE = 10;
const SORT_OPTIONS = [
  { value: "borrowed_desc", label: "Borrowed · Newest" },
  { value: "borrowed_asc", label: "Borrowed · Oldest" },
  { value: "due_asc", label: "Due · Earliest" },
  { value: "due_desc", label: "Due · Latest" },
  { value: "title_asc", label: "Title · A–Z" },
  { value: "title_desc", label: "Title · Z–A" },
] as const;
type BorrowerSort = typeof SORT_OPTIONS[number]["value"];

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
  const [sort, setSort] = useState<BorrowerSort>("borrowed_desc");
  const [records, setRecords] = useState<BorrowingRecord[]>(initialHistory?.records ?? []);
  const [totalCount, setTotalCount] = useState<number>(initialHistory?.totalCount ?? 0);
  const [isLoading, setIsLoading] = useState(!initialHistory);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (initialHistory && page === 1 && sort === "borrowed_desc") {
      setRecords(initialHistory.records);
      setTotalCount(initialHistory.totalCount);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    void getUserBorrowingHistory({ userId, page, pageSize: PAGE_SIZE, ...(sort === "borrowed_desc" ? {} : { sort }) })
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
  }, [userId, page, sort, initialHistory]);

  function changeSort(next: string) {
    const option = SORT_OPTIONS.find((item) => item.value === next);
    if (!option || option.value === sort) return;
    setSort(option.value);
    setPage(1);
  }

  function columnSort(key: "title" | "borrowed" | "due") {
    const direction: TableSortDirection | undefined = sort === `${key}_asc` ? "asc" : sort === `${key}_desc` ? "desc" : undefined;
    return { direction, onToggle: () => changeSort(`${key}_${direction === "asc" ? "desc" : "asc"}`) };
  }

  const columns: LuminaColumn<BorrowingRecord>[] = [
    {
      header: "Title",
      sort: columnSort("title"),
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
      sort: columnSort("borrowed"),
      accessor: (record) => (
        <span className="text-xs text-foreground whitespace-nowrap">{formatHistoryDate(record.borrowed_at)}</span>
      ),
    },
    {
      header: "Due",
      sort: columnSort("due"),
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
      <TableSortSelect value={sort} onChange={changeSort} options={[...SORT_OPTIONS]} className="mb-2 md:hidden" />
      <div aria-busy={isLoading}>
        <LuminaTable
          data={records}
          columns={columns}
          isLoading={isLoading && records.length === 0}
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
      </div>
    </Section>
  );
}
