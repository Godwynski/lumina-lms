import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProtectedNavClient } from "@/components/protected-nav-client";
import { AuthButton } from "@/components/auth-button";
import { Suspense } from "react";
import { getUserRole } from "@/lib/auth-helpers";
import { HeartbeatBanner } from "@/components/HeartbeatBanner";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";

export const dynamic = "force-dynamic";

type Role = "admin" | "librarian" | "staff" | "student" | null;

async function NavWithRole() {
  const role = (await getUserRole()) as Role;
  return (
    <ProtectedNavClient
      role={role}
      authNode={
        <Suspense fallback={<div className="h-9 w-full rounded-xl bg-muted animate-pulse" />}>
          <AuthButton />
        </Suspense>
      }
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
          <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4 md:hidden">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <BreadcrumbNav />
          </header>
          <div className="mx-auto mt-10 w-full max-w-7xl p-4 md:mt-0 md:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
