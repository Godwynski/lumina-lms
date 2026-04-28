import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth-helpers";
import { getBorrowingHistory } from "@/lib/actions/history";
import HistoryContent, { HistorySkeleton } from "./HistoryContent";
import { type BorrowingRecord } from "@/lib/actions/history";

export type BorrowingHistoryResult = { records: BorrowingRecord[]; totalCount: number };

export const metadata = {
  title: "Borrow History | Lumina LMS",
  description: "Track your library borrowing timeline and returns.",
};

// getMe() is cache()-memoized — reuses the auth resolved by the layout.
// The .then() chain fires immediately without blocking the page shell.
function buildHistoryPromise(page: number, status: string, q: string) {
  return getMe().then(async (me) => {
    if (!me) redirect("/login");
    return getBorrowingHistory(me.user.id, page, 10, status, q);
  }) as Promise<BorrowingHistoryResult>;
}

// Synchronous page shell — no await here.
// searchParams is a Promise in Next.js 15; we use() it inside the client.
export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  return (
    <div className="space-y-6 w-full">
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// This async server component only awaits searchParams (URL params, no DB hit).
// The actual data query is kicked off as a non-blocking promise.
async function HistoryPageContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status || "all";
  const q = params.q || "";

  // Fire the DB promise immediately — no await, passed straight to HistoryContent
  const historyPromise = buildHistoryPromise(page, status, q);

  return (
    <HistoryContent
      historyPromise={historyPromise}
      page={page}
      statusFilter={status}
      searchQuery={q}
    />
  );
}
