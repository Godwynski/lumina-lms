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
    <header className="flex items-center justify-end border-b border-border/10 pb-2 sm:h-14">
      <DashboardSearch role={role} />
    </header>
  );
}

export default function ProtectedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string }>;
}) {
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
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
