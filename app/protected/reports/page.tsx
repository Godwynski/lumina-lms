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
import { Activity, BookCheck, ClipboardList, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Analytics | Lumina LMS",
};

function buildReportsHref(params: { range: number; categories?: "all"; titles?: "all" }) {
  const qp = new URLSearchParams();
  qp.set("range", String(params.range));
  return `/protected/reports?${qp.toString()}`;
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
    redirect("/protected");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const rangeDays = Number(resolvedSearchParams.range) || 180;
  const showAllCategories = resolvedSearchParams.categories === "all";

  const now = new Date();
  const rangeStartDate = new Date(now);
  rangeStartDate.setDate(rangeStartDate.getDate() - rangeDays + 1);

  // Quick stats can stay on server for instant view
  const [activeLoans, overdueLoans, pendingCards, suspendedCards] = await Promise.all([
    supabase.from("borrowing_records").select("id", { count: "exact", head: true }).in("status", ["active", "ACTIVE"]),
    supabase.from("borrowing_records").select("id", { count: "exact", head: true }).in("status", ["active", "ACTIVE"]).lt("due_date", now.toISOString()),
    supabase.from("library_cards").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("library_cards").select("id", { count: "exact", head: true }).eq("status", "suspended"),
  ]);

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

      <section className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Active Loans", value: activeLoans.count ?? 0, icon: ClipboardList, color: "bg-indigo-500/10 text-indigo-500", href: "/protected/history" },
          { label: "Overdue", value: overdueLoans.count ?? 0, icon: Activity, color: "bg-rose-500/10 text-rose-500", href: "/protected/history" },
          { label: "Circulation", value: "Live", icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-500", href: "/protected/history" },
          { label: "Pending", value: pendingCards.count ?? 0, icon: BookCheck, color: "bg-amber-500/10 text-amber-500", href: "/protected/admin/approvals" },
          { label: "Suspended", value: suspendedCards.count ?? 0, icon: Activity, color: "bg-muted text-muted-foreground", href: "/protected/admin/approvals" },
        ].map((stat, idx) => (
          <Link key={idx} href={stat.href} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-border hover:shadow-md active:scale-95">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.color} transition-transform group-hover:scale-110`}><stat.icon className="h-5 w-5" /></div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-black text-foreground">{stat.value}</p>
          </Link>
        ))}
      </section>

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

