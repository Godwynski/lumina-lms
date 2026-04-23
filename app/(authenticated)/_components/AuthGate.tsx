import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export async function AuthGate({ children }: { children: ReactNode }) {
  const me = await getMe();

  if (!me) {
    redirect("/login");
  }

  // Casing and status checks are now handled at the layout level
  // to ensure a clean UI for blocked users.
  
  return <>{children}</>;
}
