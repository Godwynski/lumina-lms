import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ChartSkeleton() {
  return (
    <Card className="rounded-2xl border-none bg-muted/40 shadow-sm overflow-hidden animate-pulse">
      <CardHeader className="pb-2">
        <div className="h-4 w-32 bg-muted-foreground/20 rounded mb-2" />
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full bg-muted-foreground/10 rounded-xl" />
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm animate-pulse">
      <div className="mb-3 h-10 w-10 rounded-xl bg-muted" />
      <div className="h-3 w-20 bg-muted rounded mb-2" />
      <div className="h-6 w-12 bg-muted rounded" />
    </div>
  );
}

export function PulseFeedSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-4" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-3/4 bg-muted rounded" />
            <div className="h-2 w-1/2 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
