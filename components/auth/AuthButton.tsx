import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { UserNav } from "@/components/layout/UserNav";

export async function AuthButton() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  const role = user ? await getUserRole() : null;

  let profile = null;
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = profileData;
  }

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-full px-5 text-xs font-semibold">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return <UserNav user={user} profile={profile} role={role} />;
}
