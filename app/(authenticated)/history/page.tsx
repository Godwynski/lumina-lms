import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMe, getPreferences } from "@/lib/auth-helpers";
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
  return Promise.all([getMe(), getPreferences()]).then(async ([me, preferences]) => {
    if (!me) redirect("/");
    
    const preferredView = preferences.preferred_dashboard_view;
    
    // Admin, Librarian and active SA can see all records, others see only their own.
    const isStaffRole = me.role === "admin" || 
                        me.role === "librarian" || 
                        (me.role === "student_assistant" && me.profile?.status?.toUpperCase() === 'ACTIVE');
    
    const isStaff = isStaffRole && preferredView !== 'student';
    const userId = isStaff ? null : me.user.id;
    
    return getBorrowingHistory(userId, page, 10, status, q);
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

  // Get current user to determine role
  const me = await getMe();
  if (!me) redirect("/");

  const preferences = await getPreferences();
  const preferredView = preferences.preferred_dashboard_view;
  const isStaff = (me.role === 'admin' || me.role === 'librarian' || (me.role === 'student_assistant' && me.profile?.status?.toUpperCase() === 'ACTIVE')) && preferredView !== 'student';

  // Fire the DB promise immediately — no await, passed straight to HistoryContent
  const historyPromise = buildHistoryPromise(page, status, q);

  return (
    <HistoryContent
      historyPromise={historyPromise}
      page={page}
      statusFilter={status}
      searchQuery={q}
      userRole={isStaff ? me.role : 'student'}
    />
  );
}
