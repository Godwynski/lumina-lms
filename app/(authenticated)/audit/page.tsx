import { Suspense } from "react";
import { AuditContentContainer } from "./AuditContentContainer";

export const metadata = {
  title: "Audit Logs | Lumina LMS",
};

export default function AuditPage() {
  return (
    <div className="space-y-6 w-full">

      <Suspense fallback={<AuditSkeleton />}>
        <AuditContentContainer />
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
