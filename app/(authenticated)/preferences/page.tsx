import { createClient } from "@/lib/supabase/server";
import { PreferencesSection } from "@/components/settings/sections/PreferencesSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function PreferencesPageContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return <PreferencesSection role={profile?.role || "student"} />;
}

export default function PreferencesPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
      <PreferencesPageContent />
    </Suspense>
  );
}

