import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6 animate-pulse">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md opacity-40" />
      </div>

      <div className="h-12 w-full border-b border-border/50 flex gap-4 mb-4">
        <Skeleton className="h-8 w-20 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>

      <div className="grid gap-6">
        <div className="rounded-2xl border border-border/40 p-6 space-y-4">
          <Skeleton className="h-6 w-32 rounded" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
