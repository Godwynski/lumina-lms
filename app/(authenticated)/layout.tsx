import { Suspense } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { MainHeader } from "@/components/layout/MainHeader";
import { AuthGate } from "./_components/AuthGate";
import { StreamedNav } from "./_components/StreamedNav";
import { StreamedUserNav } from "./_components/StreamedUserNav";
import { NavSkeleton } from "./_components/Skeletons";
import { getMe, getPreferences } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AccountPendingScreen } from "@/components/auth/AccountPendingScreen";
import NavAnimatePresence from "./NavAnimatePresence";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ─── Parallelize: fire both requests at the same time ────────────────────
  // getPreferences() internally calls getMe() which is cache()-memoized,
  // so there is no double network round-trip. Calling them together means
  // both DB queries are in-flight simultaneously instead of waterfall.
  const [me, preferencesPromise] = [await getMe(), getPreferences()];

  // ─── Auth guard: redirect before touching any UI ──────────────────────────
  if (!me) {
    redirect("/login");
  }

  const { profile, role } = me;

  const isStudent = role === "student";
  const isPrivileged = role === "admin" || role === "librarian";

  // ─── Access restriction: render a blocking screen (no shell needed) ───────
  const isAccessBlocked =
    profile?.status === "PENDING" ||
    profile?.status === "SUSPENDED" ||
    profile?.status === "INACTIVE";

  if (isAccessBlocked && !isPrivileged) {
    return <AccountPendingScreen profile={profile} isStudent={isStudent} />;
  }

  // ─── Shell returns immediately — streamed children fill in behind it ──────
  return (
    <PreferencesProvider initialPreferences={preferencesPromise}>
      <SidebarProvider defaultOpen={true}>
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
            <div className="ml-2 shrink-0">
              <StreamedUserNav />
            </div>
          </div>

          {/* Desktop header */}
          <Suspense fallback={<div className="h-16 border-b border-border/40 bg-background/60 animate-pulse hidden md:block" />}>
            <MainHeader />
          </Suspense>

          {/* Page content */}
          <div className="mx-auto mt-4 w-full max-w-[1450px] p-4 md:mt-0 md:pt-2 md:px-6 md:pb-6">
              <AuthGate>
                <NavAnimatePresence>
                  {children}
                </NavAnimatePresence>
              </AuthGate>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </PreferencesProvider>
  );
}
