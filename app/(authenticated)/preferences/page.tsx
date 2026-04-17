import { PreferencesSection } from "@/components/settings/sections/PreferencesSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";


async function PreferencesPageContent() {
  const me = await getMe();

  if (!me) {
    redirect("/login");
  }

  return <PreferencesSection role={me.role} />;
}

export default function PreferencesPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
      <PreferencesPageContent />
    </Suspense>
  );
}

