import { getMe, getPreferences } from "@/lib/auth-helpers";
import { ProtectedNav } from "@/components/layout/ProtectedNav";

export async function StreamedNav() {
  const [me, preferences] = await Promise.all([
    getMe(),
    getPreferences()
  ]);
  
  // If no user, AuthGate will handle redirect.
  if (!me) return null;

  return (
    <ProtectedNav 
      role={me.role} 
      user={me.user} 
      profile={me.profile} 
      preferences={preferences}
    />
  );
}
