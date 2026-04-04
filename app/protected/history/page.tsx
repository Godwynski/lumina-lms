import { Suspense } from "react";
import { getBorrowingHistory } from "@/lib/actions/history";
import HistoryContent, { HistorySkeleton } from "./HistoryContent";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Borrow History | Lumina LMS",
  description: "Track your library borrowing timeline and returns.",
};

// Enable Partial Prerendering for this route

async function HistoryDataSelector({
  page,
  status,
  q,
}: {
  page: number;
  status: string;
  q: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-center border-2 border-dashed rounded-xl border-border/50 text-muted-foreground font-semibold">
        Please sign in to view your history.
      </div>
    );
  }

  const { records, totalCount } = await getBorrowingHistory(
    user.id,
    page,
    10,
    status,
    q
  );

  return (
    <HistoryContent
      initialRecords={records}
      totalCount={totalCount}
      page={page}
      statusFilter={status}
      searchQuery={q}
    />
  );
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status || "all";
  const q = params.q || "";

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Archives & Timeline</h1>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">
          Historical records of your library interactions and resource utilization.
        </p>
      </div>

      <Suspense fallback={<HistorySkeleton />}>
        <HistoryDataSelector page={page} status={status} q={q} />
      </Suspense>
    </div>
  );
}
