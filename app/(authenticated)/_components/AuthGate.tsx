import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AccountPendingScreen } from "@/components/auth/AccountPendingScreen";
import { ReactNode } from "react";

export async function AuthGate({ children }: { children: ReactNode }) {
  const me = await getMe();

  if (!me) {
    redirect("/login");
  }

  const { profile, role } = me;

  const isAccessBlocked = 
    profile?.status === "PENDING" || 
    profile?.status === "SUSPENDED" || 
    profile?.status === "INACTIVE";

  const isPrivileged = role === "admin" || role === "librarian";

  if (isAccessBlocked && !isPrivileged) {
    return <AccountPendingScreen />;
  }

  return <>{children}</>;
}
