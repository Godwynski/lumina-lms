import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { InteractivePulseChart } from "@/components/analytics/InteractivePulseChart";
import { UtilizationChart } from "@/components/analytics/UtilizationChart";
import { OperationalPulseFeed, type ActivityEvent } from "@/components/analytics/OperationalPulseFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, BookCheck, ClipboardList, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Analytics | Lumina LMS",
};

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  total_copies: number | null;
  available_copies: number | null;
  categories?: { name?: string | null } | null;
};

type BorrowRow = {
  borrowed_at: string | null;
};

type ActivityRow = {
  id: string;
  status: string;
  borrowed_at: string;
  returned_at: string | null;
  profiles: { full_name: string | null } | null;
  book_copies: {
    books: {
      title: string;
    } | null;
  } | null;
};

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function clampRangeDays(value: string | undefined) {
  if (value === "30" || value === "90" || value === "180") return Number(value) as 30 | 90 | 180;
  return 180;
}

function buildReportsHref(params: { range: number; categories?: "all"; titles?: "all" }) {
  const qp = new URLSearchParams();
  qp.set("range", String(params.range));
  if (params.categories === "all") qp.set("categories", "all");
  if (params.titles === "all") qp.set("titles", "all");
  return `/protected/reports?${qp.toString()}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; categories?: string; titles?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const role = await getUserRole();
  const canViewAnalytics = role === "admin" || role === "librarian" || role === "staff";

  if (!canViewAnalytics) {
    redirect("/protected");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const rangeDays = clampRangeDays(resolvedSearchParams.range);
  const showAllCategories = resolvedSearchParams.categories === "all";
  const showAllTitles = resolvedSearchParams.titles === "all";

  const now = new Date();
  const rangeStartDate = new Date(now);
  rangeStartDate.setDate(rangeStartDate.getDate() - rangeDays + 1);
  const rangeStartIso = rangeStartDate.toISOString();

  // Multi-query data fetching
  const [
    activeLoansResult,
    overdueLoansResult,
    monthlyLoansResult,
    pendingCardsResult,
    suspendedCardsResult,
    booksResult,
    recentActivityData,
  ] = await Promise.all([
    supabase
      .from("borrowing_records")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "ACTIVE"]),
    supabase
      .from("borrowing_records")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "ACTIVE"])
      .lt("due_date", now.toISOString()),
    supabase
      .from("borrowing_records")
      .select("borrowed_at")
      .gte("borrowed_at", rangeStartIso)
      .order("borrowed_at", { ascending: true }),
    supabase
      .from("library_cards")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("library_cards")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
    supabase
      .from("books")
      .select("id, title, author, total_copies, available_copies, categories(name)")
      .eq("is_active", true)
      .limit(400),
    supabase
      .from("borrowing_records")
      .select(`
        id, 
        status, 
        borrowed_at, 
        returned_at,
        profiles!borrowing_records_user_id_fkey(full_name),
        book_copies(
          books(title)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activeLoans = activeLoansResult.count ?? 0;
  const overdueLoans = overdueLoansResult.count ?? 0;
  const pendingCards = pendingCardsResult.count ?? 0;
  const suspendedCards = suspendedCardsResult.count ?? 0;

  const monthlyRows = (monthlyLoansResult.data ?? []) as BorrowRow[];
  const books = (booksResult.data ?? []) as BookRow[];
  const activityRows = (recentActivityData.data ?? []) as unknown as ActivityRow[];

  // Map activities to UI events
  const activities: ActivityEvent[] = activityRows.map(row => ({
    id: row.id,
    type: row.status.toLowerCase() === 'returned' ? 'return' : 
          (new Date() > new Date(row.borrowed_at) && row.status.toLowerCase() === 'active') ? 'checkout' : 'checkout',
    bookTitle: row.book_copies?.books?.title || "Unknown Book",
    userName: row.profiles?.full_name || "Unknown User",
    timestamp: row.borrowed_at,
  }));

  // Trend Bucket Math
  const bucketCount = 6;
  const bucketSpanDays = Math.max(1, Math.ceil(rangeDays / bucketCount));
  const dayMs = 24 * 60 * 60 * 1000;

  const monthBuckets = Array.from({ length: bucketCount }).map((_, idx) => {
    const startMs = rangeStartDate.getTime() + idx * bucketSpanDays * dayMs;
    const endMs = Math.min(now.getTime(), startMs + bucketSpanDays * dayMs - 1);
    const endDate = new Date(endMs);
    return {
      key: String(idx),
      label: rangeDays === 180 ? monthLabel(endDate) : endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: 0,
      startMs,
      endMs,
    };
  });

  for (const row of monthlyRows) {
    if (!row.borrowed_at) continue;
    const borrowedMs = new Date(row.borrowed_at).getTime();
    const idx = monthBuckets.findIndex((bucket) => borrowedMs >= bucket.startMs && borrowedMs <= bucket.endMs);
    if (idx >= 0) monthBuckets[idx].value += 1;
  }

  const peakMonth = Math.max(1, ...monthBuckets.map((m) => m.value));
  const loansThisMonth = monthBuckets[monthBuckets.length - 1]?.value ?? 0;

  // Category Utilization Math
  const categoryMap = new Map<string, { name: string; total: number; borrowed: number }>();
  for (const book of books) {
    const name = book.categories?.name?.trim() || "Uncategorized";
    const total = Math.max(0, Number(book.total_copies ?? 0));
    const available = Math.max(0, Number(book.available_copies ?? 0));
    const borrowed = Math.max(0, total - available);
    const prev = categoryMap.get(name) ?? { name, total: 0, borrowed: 0 };
    prev.total += total;
    prev.borrowed += borrowed;
    categoryMap.set(name, prev);
  }

  const topCategories = Array.from(categoryMap.values())
    .map((c) => ({
      ...c,
      utilization: c.total > 0 ? Math.round((c.borrowed / c.total) * 100) : 0,
    }))
    .sort((a, b) => b.borrowed - a.borrowed)
    .slice(0, 5);

  const displayedCategories = showAllCategories ? topCategories : topCategories.slice(0, 4);

  const topBooks = books
    .map((book) => {
      const total = Math.max(0, Number(book.total_copies ?? 0));
      const available = Math.max(0, Number(book.available_copies ?? 0));
      const borrowed = Math.max(0, total - available);
      return {
        id: book.id,
        title: book.title,
        author: book.author || "Unknown",
        borrowed,
        total,
        utilization: total > 0 ? Math.round((borrowed / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 6);

  const displayedTitles = showAllTitles ? topBooks : topBooks.slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 animate-in fade-in duration-700">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Intelligence Dashboard</h1>
          <p className="mt-1 text-muted-foreground font-medium tracking-tight">Real-time circulation trends and inventory health.</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl ring-1 ring-border/50">
          {[
            { days: 30, label: "30 Days" },
            { days: 90, label: "90 Days" },
            { days: 180, label: "180 Days" },
          ].map((opt) => (
            <Button key={opt.days} asChild size="sm" variant={rangeDays === opt.days ? "secondary" : "ghost"} className={`h-8 px-4 text-xs font-bold rounded-lg transition-all ${rangeDays === opt.days ? 'shadow-sm bg-background hover:bg-background' : ''}`}>
              <Link href={buildReportsHref({ range: opt.days, categories: showAllCategories ? "all" : undefined, titles: showAllTitles ? "all" : undefined })}>
                {opt.label}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Active Loans", value: activeLoans, icon: ClipboardList, color: "bg-indigo-500/10 text-indigo-500", href: "/protected/history" },
          { label: "Overdue", value: overdueLoans, icon: Activity, color: "bg-rose-500/10 text-rose-500", href: "/protected/history" },
          { label: "Monthly Circulation", value: loansThisMonth, icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-500", href: "/protected/history" },
          { label: "Pending Cards", value: pendingCards, icon: BookCheck, color: "bg-amber-500/10 text-amber-500", href: "/protected/admin/approvals" },
          { label: "Suspended", value: suspendedCards, icon: Activity, color: "bg-muted text-muted-foreground", href: "/protected/admin/approvals" },
        ].map((stat, idx) => (
          <Link key={idx} href={stat.href} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-border hover:shadow-md active:scale-95">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{stat.label}</p>
            <p className="mt-1 text-2xl font-black text-foreground group-hover:text-primary transition-colors">{stat.value}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Main Charts Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden border-none bg-muted/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Circulation Velocity</CardTitle>
            </CardHeader>
            <CardContent>
              <InteractivePulseChart buckets={monthBuckets} peakValue={peakMonth} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-2xl border-border/60 shadow-sm border-none bg-card ring-1 ring-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Utilization by Category</CardTitle>
                <div className="flex gap-1.5">
                  <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold text-muted-foreground">
                    <Link href={buildReportsHref({ range: rangeDays, categories: showAllCategories ? undefined : "all", titles: showAllTitles ? "all" : undefined })}>
                      {showAllCategories ? "Collapse" : "Expand"}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-6 px-2 text-[10px] font-bold">
                    <Link href={`/api/admin/analytics-export?type=categories&range=${rangeDays}`}>CSV</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <UtilizationChart categories={displayedCategories} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-sm border-none bg-card ring-1 ring-border/60">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">High Demand Titles</CardTitle>
                <div className="flex gap-1.5">
                  <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold text-muted-foreground">
                    <Link href={buildReportsHref({ range: rangeDays, categories: showAllCategories ? "all" : undefined, titles: showAllTitles ? undefined : "all" })}>
                      {showAllTitles ? "Collapse" : "Expand"}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-6 px-2 text-[10px] font-bold">
                    <Link href={`/api/admin/analytics-export?type=titles&range=${rangeDays}`}>CSV</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {displayedTitles.map((book) => (
                  <Link key={book.id} href={`/protected/catalog/${book.id}`} className="group block rounded-xl border border-border/50 p-3 transition-all hover:bg-muted/50 hover:border-border">
                    <p className="truncate text-xs font-heavy text-foreground group-hover:text-primary transition-colors">{book.title}</p>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                      <span>{book.borrowed} / {book.total} loans</span>
                      <span className={book.utilization > 50 ? "text-amber-500" : "text-muted-foreground/50"}>{book.utilization}%</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar Pulse Feed */}
        <div className="lg:col-span-4 h-full">
          <Card className="rounded-2xl border-none h-full bg-muted/40 border-border/60 shadow-sm overflow-hidden">
             <CardContent className="p-4">
                <OperationalPulseFeed activities={activities} />
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
