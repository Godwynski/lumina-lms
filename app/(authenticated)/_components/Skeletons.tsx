import { Skeleton } from "@/components/ui/skeleton";

export function NavSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-6 w-24" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="flex h-14 items-center justify-between px-6 border-b">
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}
