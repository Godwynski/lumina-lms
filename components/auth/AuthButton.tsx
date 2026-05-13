import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { UserNav } from "@/components/layout/UserNav";

/**
 * Server component that fetches authentication state and user profile
 * to render the UserNav component.
 */
export async function AuthButton() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch role and profile in parallel for better performance
  const [role, { data: profile }] = await Promise.all([
    getUserRole(),
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
  ]);

  return <UserNav user={user} profile={profile} role={role} />;
}
