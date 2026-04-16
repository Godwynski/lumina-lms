import { getMe } from "@/lib/auth-helpers";
import { UserNav } from "@/components/layout/UserNav";

export async function StreamedUserNav() {
  const me = await getMe();
  if (!me) return null;

  return (
    <UserNav 
      user={me.user} 
      profile={me.profile} 
      role={me.role} 
    />
  );
}
