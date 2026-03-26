import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsPageClient from "./page-client";

type Role = "admin" | "librarian" | "staff" | "student";

export const metadata = {
  title: "Settings | Lumina Library",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user?.user?.id) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url, address, phone")
    .eq("id", user.user.id)
    .single();

  const role = (profile?.role as Role) || "student";
  const canManageSystem = role === "admin" || role === "librarian";
  const isSuperAdmin = role === "admin";
  const profileName = typeof profile?.full_name === "string" ? profile.full_name : "";
  const avatarUrl = typeof profile?.avatar_url === "string" ? profile.avatar_url : "";
  const address = typeof profile?.address === "string" ? profile.address : "";
  const phone = typeof profile?.phone === "string" ? profile.phone : "";

  // Only fetch admin data if the user is an admin
  let settings: { id: string; key: string; value: string; description?: string }[] = [];
  let categories: { id: string; name: string; slug: string; description?: string; is_active: boolean }[] = [];

  if (canManageSystem) {
    const [{ data: settingsData }, { data: categoriesData }] = await Promise.all([
      supabase.from("system_settings").select("*").order("key"),
      supabase.from("categories").select("*").order("name"),
    ]);
    settings = settingsData ?? [];
    categories = categoriesData ?? [];
  }

  return (
    <SettingsPageClient
      canManageSystem={canManageSystem}
      isSuperAdmin={isSuperAdmin}
      role={role}
      profileName={profileName}
      avatarUrl={avatarUrl}
      address={address}
      phone={phone}
      settings={settings}
      categories={categories}
    />
  );
}
