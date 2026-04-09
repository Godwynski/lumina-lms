export default function DashboardLoading() {
  return (
    <div className="space-y-4 pb-6 md:space-y-5">
      {/* Header skeleton */}
      <div className="border-b border-border pb-4">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Actions bar skeleton */}
      <div className="rounded-xl border border-border/60 bg-background/90 px-1 py-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-10 animate-pulse rounded-md bg-muted sm:w-[132px]" />
          ))}
        </div>
      </div>

      {/* Attention cards skeleton */}
      <div className="space-y-2.5">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>

      {/* Recent books skeleton */}
      <div className="space-y-2.5">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="grid gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
