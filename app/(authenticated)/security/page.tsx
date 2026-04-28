import { getMe } from "@/lib/auth-helpers";
import { SecuritySection } from "@/components/settings/sections/SecuritySection";
import { redirect } from "next/navigation";
import { Suspense } from "react";

// getMe() is cache()-memoized — reuses auth already fetched by the layout
async function SecurityPageContent() {
  const me = await getMe();
  if (!me) redirect("/login");

  return <SecuritySection role={me.profile?.role || "student"} />;
}

export default function SecurityPage() {
  return (
    <div className="space-y-6 w-full">
      <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
        <SecurityPageContent />
      </Suspense>
    </div>
  );
}
