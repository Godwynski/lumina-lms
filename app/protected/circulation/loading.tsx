import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-lg opacity-40" />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="rounded-2xl border border-border/40 p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-12 w-32 rounded-lg" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32 rounded" />
            <Skeleton className="h-6 w-20 rounded" />
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center p-3 rounded-xl border border-border/20">
                <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded opacity-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
