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
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {isStaff ? "Library Access Management" : "My Attendance History"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isStaff 
            ? "Manage library entries and exits via card scanning." 
            : "Log your daily library visits and view your attendance history."}
        </p>
      </div>

      <Suspense fallback={<AttendanceSkeleton />}>
        <AttendanceClient 
          historyPromise={historyPromise} 
          isStaff={isStaff}
        />
      </Suspense>
    </div>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-32 w-full bg-muted rounded-xl" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-muted/40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
