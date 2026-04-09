import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Suspense } from "react";
import { getUserRole } from "@/lib/auth-helpers";
import { HeartbeatBanner } from "@/components/layout/HeartbeatBanner";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { UserNav } from "@/components/layout/UserNav";
import { ProtectedNav } from "@/components/layout/ProtectedNav";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { cookies } from "next/headers";

type Role = "admin" | "librarian" | "staff" | "student" | null;

// This internal component handles the profile and role data fetching.
// Wrapping it in Suspense allows the main layout shell to render instantly.
async function NavAndProfileWrapper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [roleResult, profileResult] = await Promise.all([
    getUserRole() as Promise<Role>,
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
  ]);

  const role = roleResult;
  const profile = profileResult.data;

  return (
    <>
      <ProtectedNav role={role} user={user} profile={profile} />
      {/* Mobile Header UserNav (only visible on mobile) */}
      <div className="md:hidden flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <BreadcrumbNav />
          </div>
          <UserNav user={user} profile={profile} role={role} />
      </div>
    </>
  );
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // We MUST check auth at the very top to prevent unauthenticated flashes
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <PreferencesProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-accent">
          <HeartbeatBanner />

          {/* 
            NAVIGATION STREAMING:
            We render the SidebarProvider and main layout immediately.
            The navigation items and user profile details stream in via Suspense.
          */}
          <Suspense fallback={<div className="w-64 border-r bg-sidebar animate-pulse" />}>
            <NavAndProfileWrapper />
          </Suspense>

          <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
            {/* Desktop Header Content (Breadcrumbs) */}
            <header className="hidden md:flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 transition-[width,height] ease-linear">
              <SidebarTrigger className="-ml-1" />
              <BreadcrumbNav />
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
