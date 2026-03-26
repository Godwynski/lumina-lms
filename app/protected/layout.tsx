import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProtectedNavClient } from "@/components/layout/ProtectedNavClient";
import { AuthButton } from "@/components/auth/AuthButton";
import { Suspense } from "react";
import { getUserRole } from "@/lib/auth-helpers";
import { HeartbeatBanner } from "@/components/layout/HeartbeatBanner";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { UserNav } from "@/components/layout/UserNav";

export const dynamic = "force-dynamic";

type Role = "admin" | "librarian" | "staff" | "student" | null;

async function NavWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = (await getUserRole()) as Role;

  let profile = null;
  if (user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = profileData;
  }

  return (
    <ProtectedNavClient
      role={role}
      user={user}
      profile={profile}
    />
  );
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  const role = (await getUserRole()) as Role;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-accent">
        {/* Server-status banner (fixed, client-side) */}
        <HeartbeatBanner />

        {/* Navigation: renders mobile sticky header + desktop fixed sidebar */}
        <Suspense fallback={null}>
          <NavWithRole />
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
  );
}
