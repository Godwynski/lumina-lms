import { createClient } from "@/lib/supabase/server";
import { SecuritySection } from "@/components/settings/sections/SecuritySection";
import { redirect } from "next/navigation";

export default async function SecurityPage() {
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

  return <SecuritySection role={profile?.role || "student"} />;
}

