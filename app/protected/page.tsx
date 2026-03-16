import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/dashboard-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | Lumina LMS",
};

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const role = await getUserRole();
  const stats = await getDashboardStats();

  return (
    <DashboardClient 
      user={user} 
      role={role} 
      stats={stats} 
    />
  );
}
