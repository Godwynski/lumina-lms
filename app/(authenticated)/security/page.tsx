import { createClient } from "@/lib/supabase/server";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { redirect } from "next/navigation";

export default async function SecurityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return <SettingsContent user={user} activeTab="security" />;
}
