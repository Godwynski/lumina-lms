import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { 
  CirculationVelocitySection, 
  UtilizationSection, 
  PulseFeedSection 
} from "@/components/analytics/DashboardSections";
import { 
  ChartSkeleton, 
  PulseFeedSkeleton 
} from "@/components/analytics/AnalyticsSkeletons";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { QuickStats, QuickStatsSkeleton } from "./QuickStats";

export const metadata = {
  title: "Analytics | Lumina LMS",
};

function buildReportsHref(params: { range: number; categories?: "all"; titles?: "all" }) {
  const qp = new URLSearchParams();
  qp.set("range", String(params.range));
  return `/reports?${qp.toString()}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; categories?: string; titles?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const role = await getUserRole();
  if (role !== "admin" && role !== "librarian" && role !== "staff") {
    redirect("/dashboard");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const rangeDays = Number(resolvedSearchParams.range) || 180;
  const showAllCategories = resolvedSearchParams.categories === "all";

  const now = new Date();
  const rangeStartDate = new Date(now);
  rangeStartDate.setDate(rangeStartDate.getDate() - rangeDays + 1);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 animate-in fade-in duration-700">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Intelligence Dashboard</h1>
          <p className="mt-1 text-muted-foreground font-medium tracking-tight">Real-time circulation trends and inventory health.</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl ring-1 ring-border/50">
          {[30, 90, 180].map((d) => (
            <Button key={d} asChild size="sm" variant={rangeDays === d ? "secondary" : "ghost"} className={`h-8 px-4 text-xs font-bold rounded-lg transition-all ${rangeDays === d ? 'shadow-sm bg-background hover:bg-background' : ''}`}>
              <Link href={buildReportsHref({ range: d })}>{d} Days</Link>
            </Button>
          ))}
        </div>
      </section>

      <Suspense fallback={<QuickStatsSkeleton />}>
        <QuickStats />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Suspense fallback={<ChartSkeleton />}>
            <CirculationVelocitySection rangeDays={rangeDays} rangeStartDate={rangeStartDate} />
          </Suspense>

          <div className="grid gap-6 md:grid-cols-2">
            <Suspense fallback={<ChartSkeleton />}>
              <UtilizationSection showAllCategories={showAllCategories} rangeDays={rangeDays} />
            </Suspense>

            <Card className="rounded-2xl border-border/60 shadow-sm border-none bg-card ring-1 ring-border/60">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
                <TrendingUp className="h-8 w-8 text-primary mb-2 opacity-50" />
                <p className="text-sm font-bold text-foreground">Advanced Insights</p>
                <p className="text-xs text-muted-foreground mt-1">Detailed title-level analytics are calculating...</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-4">
          <Card className="rounded-2xl border-none bg-muted/40 border-border/60 shadow-sm h-full max-h-[600px] overflow-y-auto">
             <CardContent className="p-4">
                <Suspense fallback={<PulseFeedSkeleton />}>
                  <PulseFeedSection />
                </Suspense>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

