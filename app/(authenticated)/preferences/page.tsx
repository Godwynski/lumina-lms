import { createClient } from "@/lib/supabase/server";
import { PreferencesSection } from "@/components/settings/sections/PreferencesSection";
import { redirect } from "next/navigation";

export default async function PreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return <PreferencesSection role={profile?.role || "student"} />;
}

