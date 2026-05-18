import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth-helpers";
import { getBorrowingHistory } from "@/lib/actions/history";
import HistoryContent, { HistorySkeleton } from "./HistoryContent";
import { type BorrowingRecord } from "@/lib/actions/history";

export type BorrowingHistoryResult = { records: BorrowingRecord[]; totalCount: number };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const me = await getMe();
  if (!me) return { title: "My Borrowing | Lumina LMS" };

  const params = await searchParams;
  const view = params.view || "";

  const isStaff = me.role === "super_admin" || me.role === "librarian";
  const hasCirculationPerm = me.role === "student_assistant" && 
                             !!me.profile?.permissions?.manage_circulation && 
                             me.profile?.status?.toUpperCase() === 'ACTIVE';

  const showAllLogs = isStaff || (hasCirculationPerm && view === "logs");

  return {
    title: `${showAllLogs ? "Borrowing Logs" : "My Borrowing"} | Lumina LMS`,
    description: showAllLogs 
      ? "View and manage complete library transaction registers and audit trails."
      : "Track your library borrowing timeline and returns.",
  };
}

// getMe() is cache()-memoized — reuses the auth resolved by the layout.
// The .then() chain fires immediately without blocking the page shell.
function buildHistoryPromise(page: number, status: string, q: string, view: string) {
  return getMe().then(async (me) => {
    if (!me) redirect("/");
    
    const isStaff = me.role === "super_admin" || me.role === "librarian";
    const hasCirculationPerm = me.role === "student_assistant" && 
                               !!me.profile?.permissions?.manage_circulation && 
                               me.profile?.status?.toUpperCase() === 'ACTIVE';

    const showAllLogs = isStaff || (hasCirculationPerm && view === "logs");
    
    const userId = showAllLogs ? null : me.user.id;
    
    return getBorrowingHistory(userId, page, 10, status, q);
  }) as Promise<BorrowingHistoryResult>;
}

// Synchronous page shell — no await here.
// searchParams is a Promise in Next.js 15; we use() it inside the client.
export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string; view?: string }>;
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
  searchParams: Promise<{ page?: string; status?: string; q?: string; view?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status || "all";
  const q = params.q || "";
  const view = params.view || "";

  const me = await getMe();
  if (!me) redirect("/");

  // Fire the DB promise immediately — no await, passed straight to HistoryContent
  const historyPromise = buildHistoryPromise(page, status, q, view);

  return (
    <HistoryContent
      historyPromise={historyPromise}
      page={page}
      statusFilter={status}
      searchQuery={q}
      userRole={me.role}
    />
  );
}
