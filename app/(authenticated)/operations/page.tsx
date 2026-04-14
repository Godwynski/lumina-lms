import { createClient } from "@/lib/supabase/server";
import { OperationsSection } from "@/components/settings/sections/OperationsSection";
import { redirect } from "next/navigation";

export default async function OperationsPage() {
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

  return <OperationsSection role={profile?.role || "student"} />;
}
