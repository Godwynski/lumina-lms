import { createClient } from "@/lib/supabase/server";
import { PoliciesSection } from "@/components/settings/sections/PoliciesSection";
import { redirect } from "next/navigation";

export default async function PoliciesPage() {
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

