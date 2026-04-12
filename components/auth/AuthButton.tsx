import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { UserNav } from "@/components/layout/UserNav";

export async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
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
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  return <UserNav user={user} profile={profile} role={role} />;
}
