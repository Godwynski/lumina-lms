import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Guard: must still be admin to hit this.
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.user.id)
    .single();

  if (profile?.role !== "admin") redirect("/protected");

  const params = await searchParams;
  const tab = params?.tab;
  redirect(`/protected/settings${tab ? `?tab=${tab}` : ""}`);
}
