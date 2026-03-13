import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { getUserRole } from "@/lib/auth-helpers";

export async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await getUserRole() : null;

  if (!user) {
    return (
      <div className="flex gap-2 w-full">
        <Button asChild size="sm" variant="outline" className="flex-1">
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  // Derive initials from email
  const initials = (user.email ?? "U")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 w-full min-w-0">
      {/* Avatar */}
      <div className="h-8 w-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-indigo-700">{initials}</span>
      </div>

      {/* Email + role */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium text-zinc-900 truncate leading-tight">
          {user.email}
        </span>
        {role && (
          <span className="text-[11px] text-zinc-400 capitalize leading-tight">
            {role}
          </span>
        )}
      </div>

      {/* Logout */}
      <LogoutButton />
    </div>
  );
}
