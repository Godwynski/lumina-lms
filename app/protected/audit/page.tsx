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
        <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
          <span className="p-2 bg-slate-900 text-white rounded-xl shadow-lg ring-1 ring-slate-900/5 rotate-3">
            📜
          </span>
          Audit Trail
        </h1>
        <p className="text-slate-500 font-medium font-serif italic">
          Comprehensive ledger of all administrative system changes and actions.
        </p>
      </div>

      <Suspense fallback={<AuditSkeleton />}>
        <div className="bg-white/40 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
          <AuditLogClient />
        </div>
      </Suspense>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
      <div className="h-[400px] w-full bg-slate-50 rounded-xl border-2 border-slate-100 animate-pulse" />
    </div>
  );
}
