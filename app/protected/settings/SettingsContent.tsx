import { createClient } from "@/lib/supabase/server";
import SettingsPageClient from "./page-client";
import type { User } from "@supabase/supabase-js";

type PolicySetting = { id: string; key: string; value: string; description?: string };
type Category = { id: string; name: string; slug: string; description?: string; is_active: boolean };
interface Profile {
  role: string | null;
  full_name: string | null;
  avatar_url: string | null;
  address: string | null;
  phone: string | null;
}

interface SettingsContentProps {
  user: User;
}

export async function SettingsContent({ user }: SettingsContentProps) {
  const supabase = await createClient();

  // Initiate all fetches concurrently so they run in parallel
  // We pass these promises to the client component, which will use(promise) 
  // to stream the data into the UI without blocking the initial shell render.
  
  const profilePromise = supabase
    .from("profiles")
    .select("role, full_name, avatar_url, address, phone")
    .eq("id", user.id)
    .single()
    .then(res => res.data);

  const settingsPromise = supabase
    .from("system_settings")
    .select("*")
    .order("key")
    .then(res => res.data || []);

  const categoriesPromise = supabase
    .from("categories")
    .select("*")
    .order("name")
    .then(res => res.data || []);

  return (
    <SettingsPageClient
      user={user}
      profilePromise={profilePromise as Promise<Profile | null>}
      settingsPromise={settingsPromise as Promise<PolicySetting[]>}
      categoriesPromise={categoriesPromise as Promise<Category[]>}
    />
  );
}
