import { getUserRole } from "@/lib/auth-helpers";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import DashboardLoading from "./loading";

export const metadata = {
  title: "Dashboard | Lumina LMS",
};

async function DashboardHeader() {
  const role = await getUserRole();
  return (
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
  );
}

export default function ProtectedPage() {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<div className="h-16 w-full animate-pulse bg-muted rounded-lg" />}>
        <DashboardHeader />
      </Suspense>

      {/* 
        This is the key to instant navigation: 
        The server sends the header above immediately, 
        and the content below streams in via Suspense. 
      */}
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
