import { Suspense } from "react";
import { getBorrowingHistory } from "@/lib/actions/history";
import HistoryContent, { HistorySkeleton } from "./HistoryContent";
import { createClient } from "@/lib/supabase/server";
import { type BorrowingRecord } from "@/lib/actions/history";

export type BorrowingHistoryResult = { records: BorrowingRecord[]; totalCount: number };

export const metadata = {
  title: "Borrow History | Lumina LMS",
  description: "Track your library borrowing timeline and returns.",
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status || "all";
  const q = params.q || "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-center border-2 border-dashed rounded-xl border-border/50 text-muted-foreground font-semibold">
        Please sign in to view your history.
      </div>
    );
  }

  // Initiate fetch but do NOT await it here
  const historyPromise = getBorrowingHistory(
    user.id,
    page,
    10,
    status,
    q
  );

  return (
    <div className="space-y-4 w-full">
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryContent
          historyPromise={historyPromise as Promise<BorrowingHistoryResult>}
          page={page}
          statusFilter={status}
          searchQuery={q}
        />
      </Suspense>
    </div>
  );
}
