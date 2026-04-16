import { Skeleton } from "@/components/ui/skeleton";

export default function GlobalAuthenticatedLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md opacity-40" />
      </div>

      {/* Main Content Area Skeleton */}
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl border" />
          <Skeleton className="h-32 rounded-xl border" />
          <Skeleton className="h-32 rounded-xl border" />
        </div>
        
        <Skeleton className="h-[400px] w-full rounded-xl border" />
      </div>
    </div>
  );
}
