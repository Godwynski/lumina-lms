export default function PoliciesLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] w-full flex-col gap-6 overflow-hidden lg:flex-row">
      {/* Sidebar Skeleton */}
      <div className="w-full shrink-0 border-border/50 lg:w-64 lg:border-r lg:pr-6">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted/60" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      </div>

      {/* Main Panel Skeleton */}
      <div className="flex-1 space-y-8 lg:pl-2">
        {/* Header Block */}
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted/40" />
        </div>

        {/* Form Fields Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border/40 p-5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="h-10 w-full animate-pulse rounded-md bg-muted/30" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted/20" />
            </div>
          ))}
        </div>
      </div>

      {/* Simulation Panel Skeleton (Desktop only) */}
      <div className="hidden w-80 shrink-0 flex-col gap-4 xl:flex">
        <div className="h-10 w-full animate-pulse rounded-xl bg-muted/40" />
        <div className="flex-1 rounded-2xl border border-border/40 bg-muted/5 p-6 space-y-6">
           <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
           <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                   <div className="h-3 w-20 animate-pulse rounded bg-muted/40" />
                   <div className="h-12 w-full animate-pulse rounded bg-muted/20" />
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
