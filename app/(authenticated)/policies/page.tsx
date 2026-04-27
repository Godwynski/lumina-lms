import { getMe } from "@/lib/auth-helpers";
import { PoliciesSection } from "@/components/settings/sections/PoliciesSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function PoliciesPageContent() {
  const me = await getMe();

  if (!me) {
    redirect("/login");
  }

  const { supabase, profile } = me;

  // Both queries fire in parallel — authed client handles RLS for categories too
  const settingsPromise = supabase
    .from("system_settings")
    .select("*")
    .order("key")
    .then(res => res.data || []);

  const categoriesPromise = supabase
    .from("categories")
    .select("id, name, slug, description, is_active, created_at")
    .order("name")
    .then(res => res.data || []);

  return (
    <PoliciesSection 
      role={profile?.role || "student"} 
      settingsPromise={settingsPromise} 
      categoriesPromise={categoriesPromise}
    />
  );
}

export default function PoliciesPage() {
  return (
    <div className="w-full">
      <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
        <PoliciesPageContent />
      </Suspense>
    </div>
  );
}
