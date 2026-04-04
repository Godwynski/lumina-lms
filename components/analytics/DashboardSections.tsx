import { createClient } from "@/lib/supabase/server";
import { InteractivePulseChart } from "./InteractivePulseChart";
import { UtilizationChart } from "./UtilizationChart";
import { OperationalPulseFeed, type ActivityEvent } from "./OperationalPulseFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

export async function CirculationVelocitySection({ rangeDays, rangeStartDate }: { rangeDays: number; rangeStartDate: Date }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("borrowing_records")
    .select("borrowed_at")
    .gte("borrowed_at", rangeStartDate.toISOString())
    .order("borrowed_at", { ascending: true });

  const monthlyRows = data ?? [];
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const bucketCount = 6;
  const bucketSpanDays = Math.max(1, Math.ceil(rangeDays / bucketCount));

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

  return (
    <Card className="rounded-2xl border-none bg-muted/40 shadow-sm overflow-hidden border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Circulation Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <InteractivePulseChart buckets={monthBuckets} peakValue={peakMonth} />
      </CardContent>
    </Card>
  );
}

export async function UtilizationSection({ showAllCategories, rangeDays }: { showAllCategories: boolean; rangeDays: number }) {
  const supabase = await createClient();
  const { data: categoryBooks } = await supabase
    .from("books")
    .select("total_copies, available_copies, categories(name)")
    .eq("is_active", true);

  const categoryMap = new Map<string, { name: string; total: number; borrowed: number }>();
  for (const book of (categoryBooks ?? [])) {
    const category = Array.isArray(book.categories) ? book.categories[0] : book.categories;
    const name = category?.name?.trim() || "Uncategorized";
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
    .sort((a, b) => b.borrowed - a.borrowed);

  const displayedCategories = showAllCategories ? topCategories : topCategories.slice(0, 4);

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm border-none bg-card ring-1 ring-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Utilization by Category</CardTitle>
        {/* Simplified header link, in real app would need to preserve other params */}
        <div className="flex gap-1.5">
           <Button asChild variant="outline" size="sm" className="h-6 px-2 text-[10px] font-bold">
            <Link href={`/api/admin/analytics-export?type=categories&range=${rangeDays}`}>CSV</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <UtilizationChart categories={displayedCategories} />
      </CardContent>
    </Card>
  );
}

export async function PulseFeedSection() {
  const supabase = await createClient();
  const { data: activityRows } = await supabase
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
    .limit(5);

  const activities: ActivityEvent[] = (activityRows ?? []).map(row => {
    const book_copy = Array.isArray(row.book_copies) ? row.book_copies[0] : row.book_copies;
    const book = book_copy && typeof book_copy === 'object' && 'books' in book_copy 
        ? (Array.isArray(book_copy.books) ? book_copy.books[0] : book_copy.books) 
        : null;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    
    return {
      id: row.id,
      type: row.status.toLowerCase() === 'returned' ? 'return' : 'checkout',
      bookTitle: (book as { title?: string })?.title || "Unknown Book",
      userName: (profile as { full_name?: string })?.full_name || "Unknown User",
      timestamp: row.borrowed_at,
    };
  });

  return <OperationalPulseFeed activities={activities} />;
}
