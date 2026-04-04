import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>

      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 p-4 space-y-4">
            <div className="flex items-center gap-3">
               <Skeleton className="h-16 w-12 rounded-md" />
               <div className="flex-1 space-y-2">
                 <Skeleton className="h-4 w-3/4 rounded" />
                 <Skeleton className="h-3 w-1/2 rounded" />
               </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
