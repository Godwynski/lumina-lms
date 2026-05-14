import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export async function AuthGate({ children }: { children: ReactNode }) {
  const me = await getMe();

  if (!me) {
    redirect("/");
  }
  
  return <>{children}</>;
}
