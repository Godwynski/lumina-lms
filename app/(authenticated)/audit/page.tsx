import { Suspense } from "react";
import { getUserRole } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AuditLogClient } from "@/components/admin/AuditLogClient";

export const metadata = {
  title: "Audit Logs | Lumina LMS",
};

// Synchronous page shell — responds immediately.
export default function AuditPage() {
  return (
    <div className="space-y-6 w-full">
      <Suspense fallback={<AuditSkeleton />}>
        <AuditAuthGate />
      </Suspense>
    </div>
  );
}

// Only awaits getUserRole() — a cache()-memoized call that reuses the
// auth already fetched by the layout. No extra round-trip.
async function AuditAuthGate() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/dashboard?error=unauthorized");
  }

  return (
    <div className="w-full">
      <AuditLogClient />
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-full bg-muted rounded-lg animate-pulse" />
      <div className="h-[400px] w-full bg-muted/50 rounded-xl border-2 border-border animate-pulse" />
    </div>
  );
}
