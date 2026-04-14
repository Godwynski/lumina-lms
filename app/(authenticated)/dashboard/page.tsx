import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardContent } from "../DashboardContent";
import DashboardLoading from "./loading";

export const metadata = {
  title: "Dashboard | Lumina LMS",
};

export default async function ProtectedPage() {
  const supabase = await createClient();

  // 1. Get user and role concurrently. 
  // This is minimal blocking needed for the shell.
  const [userResult, role] = await Promise.all([
    supabase.auth.getUser(),
    getUserRole()
  ]);

  const user = userResult.data?.user;

  if (!user) {
    return redirect("/login");
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-4 border-b border-border/50 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">

          <p className="text-sm text-muted-foreground">
            {role === 'student' 
              ? `Welcome back. Here's your library at a glance.`
              : 'Core actions, queue visibility, and recent activity.'}
          </p>
        </div>
        <DashboardSearch role={role} />
      </header>

      {/* 
        This is the key to instant navigation: 
        The server sends the header above immediately, 
        and the content below streams in via Suspense. 
      */}
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent user={user} role={role} />
      </Suspense>
    </div>
  );
}
