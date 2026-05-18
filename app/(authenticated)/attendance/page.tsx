import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AttendanceClient } from "./AttendanceClient";
import { getAttendanceHistory } from "@/lib/actions/attendance";

export const metadata = {
  title: "Attendance Logs",
  description: "View and manage library attendance sessions.",
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const me = await getMe();
  if (!me) redirect("/");

  // Resolve searchParams since they are dynamic in Next.js 15
  const resolvedParams = await searchParams;
  const viewParam = typeof resolvedParams.view === 'string' ? resolvedParams.view : '';

  const hasAttendancePerm = me.hasPermission('manage_attendance') && !me.isDeactivatedSA;
  const showSystemLogs = hasAttendancePerm && viewParam === 'logs';

  const systemTodayPromise = showSystemLogs ? getAttendanceHistory(undefined) : undefined;
  const personalHistoryPromise = getAttendanceHistory(me.user.id);

  return (
    <Suspense fallback={<AttendanceSkeleton />}>
      <AttendanceClient 
        systemTodayPromise={systemTodayPromise}
        personalHistoryPromise={personalHistoryPromise}
        isStaff={showSystemLogs}
        userId={me.user.id}
      />
    </Suspense>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 animate-pulse">

      <div className="h-12 w-full bg-muted/30 rounded-2xl" />
      <div className="rounded-2xl border border-border/10 bg-card/50 overflow-hidden">
        <div className="h-10 w-full bg-muted/20 border-b border-border/10" />
        <div className="p-1 space-y-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 w-full bg-muted/5 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
