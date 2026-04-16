import { getMe } from "@/lib/auth-helpers";
import { ProtectedNav } from "@/components/layout/ProtectedNav";

export async function StreamedNav() {
  const me = await getMe();
  
  // If no user, AuthGate will handle redirect.
  // We handle null here just in case.
  if (!me) return null;

  return (
    <ProtectedNav 
      role={me.role} 
      user={me.user} 
      profile={me.profile} 
    />
  );
}
