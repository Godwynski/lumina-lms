import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";

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

  const [
    activeLoansResult,
    overdueLoansResult,
    monthlyLoansResult,
    pendingCardsResult,
    suspendedCardsResult,
    booksResult,
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
  ]);

  const activeLoans = activeLoansResult.count ?? 0;
  const overdueLoans = overdueLoansResult.count ?? 0;
  const pendingCards = pendingCardsResult.count ?? 0;
  const suspendedCards = suspendedCardsResult.count ?? 0;

  const monthlyRows = (monthlyLoansResult.data ?? []) as BorrowRow[];
  const books = (booksResult.data ?? []) as BookRow[];

  const bucketCount = 6;
  const bucketSpanDays = Math.max(1, Math.ceil(rangeDays / bucketCount));
  const dayMs = 24 * 60 * 60 * 1000;

  const monthBuckets: { key: string; label: string; value: number; startMs: number; endMs: number }[] = Array.from({ length: bucketCount }).map((_, idx) => {
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
  const hasAnyQueue = activeLoans > 0 || overdueLoans > 0 || pendingCards > 0 || suspendedCards > 0;
  const trendPoints = monthBuckets
    .map((bucket, idx) => {
      const x = monthBuckets.length === 1 ? 50 : (idx / (monthBuckets.length - 1)) * 100;
      const y = 36 - (bucket.value / peakMonth) * 28;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
      <section className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Circulation, card pipeline, and catalog utilization.</p>
          </div>
          <div className="flex items-center gap-1">
            {[
              { days: 30, label: "30d" },
              { days: 90, label: "90d" },
              { days: 180, label: "180d" },
            ].map((opt) => (
              <Button key={opt.days} asChild size="sm" variant={rangeDays === opt.days ? "default" : "outline"} className="h-8 px-2.5 text-xs">
                <Link
                  href={buildReportsHref({
                    range: opt.days,
                    categories: showAllCategories ? "all" : undefined,
                    titles: showAllTitles ? "all" : undefined,
                  })}
                >
                  {opt.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Link href="/protected/history" className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/40">
          <p className="text-xs text-muted-foreground">Active loans</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{activeLoans}</p>
        </Link>
        <Link href="/protected/history" className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/40">
          <p className="text-xs text-muted-foreground">Overdue loans</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{overdueLoans}</p>
        </Link>
        <Link href="/protected/history" className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/40">
          <p className="text-xs text-muted-foreground">Loans this month</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{loansThisMonth}</p>
        </Link>
        <Link href="/protected/admin/approvals" className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/40">
          <p className="text-xs text-muted-foreground">Pending cards</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{pendingCards}</p>
        </Link>
        <Link href="/protected/admin/approvals" className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/40">
          <p className="text-xs text-muted-foreground">Suspended cards</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{suspendedCards}</p>
        </Link>
      </section>

      {!hasAnyQueue && (
        <section className="rounded-lg border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">
          <p>No active queue yet. Start a checkout to generate operational analytics.</p>
          <div className="mt-2 flex gap-2">
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Link href="/protected/circulation">Open circulation</Link>
            </Button>
          </div>
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Loan trend</p>
          <div className="rounded-md border border-border bg-muted/40 p-2">
            <svg viewBox="0 0 100 40" className="h-32 w-full">
              <polyline
                points={trendPoints}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-primary"
                vectorEffect="non-scaling-stroke"
              />
              {monthBuckets.map((bucket, idx) => {
                const x = monthBuckets.length === 1 ? 50 : (idx / (monthBuckets.length - 1)) * 100;
                const y = 36 - (bucket.value / peakMonth) * 28;
                return <circle key={bucket.key} cx={x} cy={y} r="1.4" className="fill-primary" />;
              })}
            </svg>
            <div className="mt-1 grid grid-cols-6 text-[10px] text-muted-foreground">
              {monthBuckets.map((m) => (
                <span key={m.key} className="text-center">{m.label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Most utilized titles</p>
            <div className="flex items-center gap-1">
              {topBooks.length > 4 && (
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                  <Link
                    href={buildReportsHref({
                      range: rangeDays,
                      categories: showAllCategories ? "all" : undefined,
                      titles: showAllTitles ? undefined : "all",
                    })}
                  >
                    {showAllTitles ? "View less" : "View all"}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                <Link href={`/api/admin/analytics-export?type=titles&range=${rangeDays}`}>Export</Link>
              </Button>
            </div>
          </div>
          {topBooks.length > 0 ? (
            <div className="space-y-2">
              {displayedTitles.map((book) => (
                <Link key={book.id} href={`/protected/catalog/${book.id}`} className="block rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/40">
                  <p className="truncate font-medium text-foreground">{book.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{book.borrowed}/{book.total} borrowed ({book.utilization}%)</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              No title utilization data yet. Process circulation to populate this list.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Top categories by circulation</p>
          <div className="flex items-center gap-1">
            {topCategories.length > 4 && (
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                <Link
                  href={buildReportsHref({
                    range: rangeDays,
                    categories: showAllCategories ? undefined : "all",
                    titles: showAllTitles ? "all" : undefined,
                  })}
                >
                  {showAllCategories ? "View less" : "View all"}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Link href={`/api/admin/analytics-export?type=categories&range=${rangeDays}`}>Export</Link>
            </Button>
          </div>
        </div>
        {topCategories.length > 0 ? (
          <div className="space-y-2">
            {displayedCategories.map((c) => (
              <Link key={c.name} href="/protected/catalog" className="block rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/40">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.utilization}% utilization</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                  <div
                    className={c.utilization > 0 ? "h-full rounded bg-primary" : "h-full rounded bg-transparent"}
                    style={{ width: `${Math.max(0, c.utilization)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.borrowed} borrowed of {c.total} copies</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            No category utilization data yet.
          </div>
        )}
      </section>
    </div>
  );
}
