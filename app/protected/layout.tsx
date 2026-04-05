import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProtectedNav } from "@/components/layout/ProtectedNav";
import { Suspense } from "react";
import { getUserRole } from "@/lib/auth-helpers";
import { HeartbeatBanner } from "@/components/layout/HeartbeatBanner";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { UserNav } from "@/components/layout/UserNav";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { cookies } from "next/headers";

type Role = "admin" | "librarian" | "staff" | "student" | null;



export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [userResponse, roleResult] = await Promise.all([
    supabase.auth.getUser(),
    getUserRole() as Promise<Role>,
  ]);

  const {
    data: { user },
    error,
  } = userResponse;

  if (error || !user) {
    redirect("/auth/login");
  }

  // Parallelize profile fetch with role fetch already being done
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role = roleResult;

  // Read sidebar state from cookie for SSR consistency
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <PreferencesProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-accent">
          {/* Server-status banner (fixed, client-side) */}
          <HeartbeatBanner />

          {/* Navigation: renders mobile sticky header + desktop fixed sidebar */}
          <Suspense fallback={null}>
            <ProtectedNav role={role} user={user} profile={profile} />
          </Suspense>

          {/* Main content: offset left for desktop sidebar, top for mobile header */}
          <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:hidden">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <BreadcrumbNav />
              </div>
              <Suspense fallback={<div className="h-8 w-8 rounded-full bg-muted animate-pulse" />}>
                <UserNav user={user} profile={profile} role={role} />
              </Suspense>
            </header>
            <div className="mx-auto mt-10 w-full max-w-7xl p-4 md:mt-0 md:p-6 lg:p-8">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PreferencesProvider>
  );
}
