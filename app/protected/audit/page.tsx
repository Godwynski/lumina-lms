import { AuditLogClient } from "@/components/admin/AuditLogClient";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Audit Logs | Lumina LMS",
};

export default function AuditPage() {
  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
          <span className="p-2 bg-primary text-primary-foreground rounded-xl shadow-sm ring-1 ring-border rotate-3">
            📜
          </span>
          Audit Trail
        </h1>
        <p className="text-muted-foreground font-medium font-serif italic">
          Comprehensive ledger of all administrative system changes and actions.
        </p>
      </div>

      <Suspense fallback={<AuditSkeleton />}>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <AuditLogClient />
        </div>
      </Suspense>
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
