import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-8 animate-pulse">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg opacity-50" />
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl border border-border/50" />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl border border-border/50" />
          <Skeleton className="h-64 rounded-2xl border border-border/50" />
        </div>
      </div>
    </div>
  );
}
