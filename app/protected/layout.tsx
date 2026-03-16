import { ProtectedNavClient } from "@/components/protected-nav-client";
import { AuthButton } from "@/components/auth-button";
import { Suspense } from "react";
import { getUserRole } from "@/lib/auth-helpers";
import { OfflineBanner } from "@/components/OfflineBanner";
import { HeartbeatBanner } from "@/components/HeartbeatBanner";

type Role = "admin" | "librarian" | "staff" | "student" | null;

async function NavWithRole() {
  const role = (await getUserRole()) as Role;
  return (
    <ProtectedNavClient
      role={role}
      authNode={
        <Suspense fallback={<div className="h-9 w-full bg-zinc-100 rounded-xl animate-pulse" />}>
          <AuthButton />
        </Suspense>
      }
    />
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 selection:bg-indigo-500/30">
      {/* Offline & server-status banners (fixed, client-side) */}
      <OfflineBanner />
      <HeartbeatBanner />

      {/* Navigation: renders mobile sticky header + desktop fixed sidebar */}
      <Suspense fallback={null}>
        <NavWithRole />
      </Suspense>

      {/* Main content: offset left for desktop sidebar, top for mobile header */}
      <main className="min-h-screen pt-16 md:pt-0 md:pl-64 lg:pl-72 relative z-0">
        <div className="w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
