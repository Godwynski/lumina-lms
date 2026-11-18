import type { Metadata } from "next";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { MainHeader } from "@/components/layout/MainHeader";
import { ProtectedNav } from "@/components/layout/ProtectedNav";
import { getMe, getPreferences } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AccountPendingScreen } from "@/components/auth/AccountPendingScreen";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { SWRProvider } from "./_components/SWRProvider";
import { BatchTaskProvider } from "@/components/providers/BatchTaskProvider";
import { cookies } from "next/headers";
import { isAccessBlocked as checkAccessBlocked, needsOnboarding, type Profile } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

  const isStudent = role === "patron";

  // ─── Access restriction: render a blocking screen (no shell needed) ───────
  const isAccessBlocked = checkAccessBlocked(profile as Profile);

  if (isAccessBlocked) {
    return <AccountPendingScreen profile={profile} status={profile?.status} isStudent={isStudent} />;
  }

  // An approved patron who skipped the profile form completes it before seeing the dashboard.
  if (needsOnboarding(role, profile as Profile)) {
    return <AccountPendingScreen profile={profile} status={profile?.status} isStudent={isStudent} />;
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
        <BatchTaskProvider>
          <NotificationsProvider>
            <SidebarProvider defaultOpen={defaultOpen}>
            {/* First tab stop: lets keyboard users jump past the navigation. */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Skip to main content
            </a>
            <ProtectedNav user={me.user} />

            <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
              <MainHeader />

              {/* Page content */}
              <div
                id="main-content"
                tabIndex={-1}
                className="mx-auto mt-2 w-full max-w-7xl px-3 py-3 md:mt-0 md:pt-2 md:px-6 md:pb-6 outline-none"
              >
                {children}
              </div>
            </SidebarInset>
            </SidebarProvider>
          </NotificationsProvider>
        </BatchTaskProvider>
      </SWRProvider>
    </PreferencesProvider>
  );
}
