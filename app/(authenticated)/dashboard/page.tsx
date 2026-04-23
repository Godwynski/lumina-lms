import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import DashboardLoading from "./loading";

export const metadata = {
  title: "Dashboard | Lumina LMS",
};

export default function ProtectedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
