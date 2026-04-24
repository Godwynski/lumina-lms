export default function DashboardLoading() {
  return (
    <div className="space-y-6 pb-6 lg:space-y-8">


      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
            <div className="h-3 w-20 rounded bg-muted/40" />
            <div className="h-8 w-12 rounded bg-muted/60" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Feed Skeleton */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted/50" />
          <div className="space-y-3">
             {[1, 2, 3, 4].map((i) => (
               <div key={i} className="h-20 animate-pulse rounded-xl border border-border/40 bg-muted/5" />
             ))}
          </div>
        </div>

        {/* Sidebar/Recent Books Skeleton */}
        <div className="space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted/50" />
          <div className="space-y-3 rounded-2xl border border-border/40 p-4">
             {[1, 2, 3].map((i) => (
               <div key={i} className="flex gap-3">
                  <div className="h-16 w-12 animate-pulse rounded bg-muted/40" />
                  <div className="flex-1 space-y-2 py-1">
                     <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
                     <div className="h-3 w-1/2 animate-pulse rounded bg-muted/20" />
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
