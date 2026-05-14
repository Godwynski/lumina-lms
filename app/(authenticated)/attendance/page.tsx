import { Suspense } from "react";
import { getMe, getPreferences } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AttendanceClient } from "./AttendanceClient";
import { getAttendanceHistory } from "@/lib/actions/attendance";

export default async function AttendancePage() {
  const [me, preferences] = await Promise.all([getMe(), getPreferences()]);
  if (!me) redirect("/");

  const preferredView = preferences.preferred_dashboard_view;

  const isStaffRole = me.role === 'admin' || 
                      me.role === 'librarian' || 
                      (me.role === 'student_assistant' && 
                       me.profile?.status?.toUpperCase() === 'ACTIVE' && 
                       me.profile.permissions?.manage_attendance);

  // If staff is in student view, treat them as a student
  const isStaff = isStaffRole && preferredView !== 'student';
  
  // If in student view, fetch specific history for the user
  const historyPromise = isStaff ? getAttendanceHistory() : getAttendanceHistory(me.user.id);

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
