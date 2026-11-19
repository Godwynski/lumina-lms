import { getMe } from "@/lib/auth-helpers";
import { PoliciesSection } from "@/components/settings/sections/PoliciesSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PoliciesLoading from "./loading";

export const metadata = { title: "System Policies" };

async function PoliciesPageContent() {
  const me = await getMe();

  if (!me) {
    redirect("/");
  }

  if (me.role !== 'super_admin' && me.role !== 'librarian') {
    redirect("/dashboard");
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
      role={profile?.role || "patron"} 
      settingsPromise={settingsPromise} 
      categoriesPromise={categoriesPromise}
    />
  );
}

export default function PoliciesPage() {
  return (
    <Suspense fallback={<PoliciesLoading />}>
      <PoliciesPageContent />
    </Suspense>
  );
}
