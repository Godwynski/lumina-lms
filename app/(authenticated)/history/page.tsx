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
  if (!me) return { title: "My Borrowing" };

  const params = await searchParams;
  const view = params.view || "";

  const isStaff = me.role === "super_admin" || me.role === "librarian";
  const hasCirculationPerm = me.role === "library_staff" && 
                             !!me.profile?.permissions?.manage_circulation && 
                             me.profile?.status?.toUpperCase() === 'ACTIVE';

  const showAllLogs = isStaff || (hasCirculationPerm && view === "logs");

  return {
    title: `${showAllLogs ? "Borrowing Logs" : "My Borrowing"}`,
    description: showAllLogs 
      ? "View and manage complete library transaction registers and audit trails."
      : "Track your library borrowing timeline and returns.",
  };
}

export default function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; resolution?: string; q?: string; view?: string }>;
}) {
  return (
    <div className="space-y-6 w-full">
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function HistoryPageContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; resolution?: string; q?: string; view?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort || "";
  const page = parseInt(params.page || "1", 10);
  const status = params.status || "all";
  const resolution = params.resolution || "all";
  const q = params.q || "";
  const view = params.view || "";

  const me = await getMe();
  if (!me) redirect("/");

  const isStaff = me.role === "super_admin" || me.role === "librarian";
  const hasCirculationPerm = me.role === "library_staff" && 
                             !!me.profile?.permissions?.manage_circulation && 
                             me.profile?.status?.toUpperCase() === 'ACTIVE';

  const showAllLogs = isStaff || (hasCirculationPerm && view === "logs");
  const userId = showAllLogs ? null : me.user.id;

  const historyPromise = getBorrowingHistory(userId, page, 10, status, q, undefined, resolution, sort);

  return (
    <HistoryContent
      historyPromise={historyPromise}
      page={page}
      statusFilter={status}
      resolutionFilter={resolution}
      searchQuery={q}
      userRole={me.role}
      userId={userId}
    />
  );
}
