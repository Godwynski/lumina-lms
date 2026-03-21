import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { UserNav } from "./user-nav";

export async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await getUserRole() : null;

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="ghost" className="text-slate-600 hover:bg-slate-200 hover:text-slate-900">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  return <UserNav user={user} role={role} />;
}
