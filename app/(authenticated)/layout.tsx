import { Suspense } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { MainHeader } from "@/components/layout/MainHeader";
import { StreamedNav } from "./_components/StreamedNav";
import { StreamedUserNav } from "./_components/StreamedUserNav";
import { NavSkeleton } from "./_components/Skeletons";
import { getMe, getPreferences } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AccountPendingScreen } from "@/components/auth/AccountPendingScreen";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import NavAnimatePresence from "./NavAnimatePresence";
import { SWRProvider } from "./_components/SWRProvider";
import { cookies } from "next/headers";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState === undefined ? true : sidebarState === "true";

  // ─── Parallelize: fire both requests at the same time ────────────────────
  // getPreferences() internally calls getMe() which is cache()-memoized,
  // so there is no double network round-trip.
  const [me, preferences] = await Promise.all([getMe(), getPreferences()]);

  // ─── Auth guard: redirect before touching any UI ──────────────────────────
  if (!me) {
    redirect("/");
  }

  const { profile, role } = me;

  const isStudent = role === "student";
  const isPrivileged = role === "super_admin" || role === "librarian";

  // ─── Access restriction: render a blocking screen (no shell needed) ───────
  if (profile?.status === "ARCHIVED" && !isPrivileged) {
    redirect("/error?error=archived_account");
  }

  const isAccessBlocked =
    profile?.status === "PENDING" ||
    profile?.status === "SUSPENDED" ||
    profile?.status === "INACTIVE";

  if (isAccessBlocked && !isPrivileged && role !== "student_assistant") {
    return <AccountPendingScreen profile={profile} isStudent={isStudent} />;
  }

  // ─── Shell returns immediately — streamed children fill in behind it ──────
  return (
    <PreferencesProvider 
      initialPreferences={preferences}
      initialRole={role}
      initialProfile={profile}
      user={me.user}
    >
      <SWRProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          {/* Nav streams in independently; skeleton perfectly mirrors real nav */}
          <Suspense fallback={<NavSkeleton />}>
            <StreamedNav />
          </Suspense>

          <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
            {/* Mobile header */}
            <div className="md:hidden sticky top-0 z-40 flex w-full h-[52px] shrink-0 items-center justify-between border-b border-border bg-background/90 backdrop-blur-md px-3.5 shadow-sm">
              <div className="flex flex-1 items-center gap-3 overflow-hidden">
                <SidebarTrigger className="shrink-0" />
                <div className="truncate text-sm font-semibold tracking-tight">
                  <Suspense fallback={<div className="h-4 w-24 animate-pulse bg-muted/20 rounded" />}>
                    <BreadcrumbNav />
                  </Suspense>
                </div>
              </div>
              <div className="ml-2 shrink-0 flex items-center gap-2">
                <NotificationBell />
                <StreamedUserNav />
              </div>
            </div>

            {/* Desktop header */}
            <Suspense fallback={<div className="h-16 border-b border-border/40 bg-background/60 animate-pulse hidden md:block" />}>
              <MainHeader />
            </Suspense>

            {/* Page content */}
            <div className="mx-auto mt-4 w-full max-w-[1450px] p-4 md:mt-0 md:pt-2 md:px-6 md:pb-6">
                <NavAnimatePresence>
                  {children}
                </NavAnimatePresence>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </SWRProvider>
    </PreferencesProvider>
  );
}
