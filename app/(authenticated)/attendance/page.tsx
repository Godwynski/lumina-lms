import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AttendanceClient } from "./AttendanceClient";
import { getAttendanceHistory } from "@/lib/actions/attendance";

export default async function AttendancePage() {
  const me = await getMe();
  if (!me) redirect("/");

  const historyPromise = getAttendanceHistory();
  const isStaff = ['admin', 'librarian', 'student_assistant'].includes(me.role);

  return (
    <Suspense fallback={<AttendanceSkeleton />}>
      <AttendanceClient 
        historyPromise={historyPromise} 
        isStaff={isStaff}
      />
    </Suspense>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6 animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-64 bg-muted/50 rounded-lg" />
      </div>
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
