import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * /protected/admin/settings  →  merged into /protected/settings
 *
 * Any deep-links with ?tab= still work because the unified settings page
 * honours the `tab` search param.
 */
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

  if (profile?.role !== "admin") redirect("/protected/dashboard");

  const params = await searchParams;
  const tab = params?.tab;
  redirect(`/protected/settings${tab ? `?tab=${tab}` : ""}`);
}
