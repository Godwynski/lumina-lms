import { createClient } from "@/lib/supabase/server";
import { PoliciesSection } from "@/components/settings/sections/PoliciesSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function PoliciesPageContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profilePromise = supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
    .then(res => res.data);

  const settingsPromise = supabase
    .from("system_settings")
    .select("*")
    .order("key")
    .then(res => res.data || []);

  const profile = await profilePromise;

  return (
    <PoliciesSection 
      role={profile?.role || "student"} 
      settingsPromise={settingsPromise} 
    />
  );
}

export default function PoliciesPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
      <PoliciesPageContent />
    </Suspense>
  );
}

