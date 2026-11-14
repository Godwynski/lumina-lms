'use client';

import { use, useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, BookOpen, Library, UserCircle2 } from 'lucide-react';
import { TrendChart, CategoryPieChart, PeakHoursBarChart, ChartSkeleton } from './AnalyticsCharts';
import { getAnalyticsSummary, type AnalyticsSummary, type AnalyticsRange, type AnalyticsSelection } from '@/lib/actions/analytics';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
import { analyticsDates, validateDates, type AnalyticsDates } from '@/lib/analytics-dates';
import { AnalyticsDetailModal } from './AnalyticsDetailModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type DashboardStats = {
  activeBorrows: number;
  pendingApprovals: number;
  myActiveBorrows: number;
  recentBooks: { id: string; title: string; author: string; cover_url: string | null; created_at: string }[];
  attendanceToday: number;
  totalBooks: number;
  totalUsers: number;
};

interface AnalyticsProps {
  statsPromise: Promise<DashboardStats>;
  role: 'super_admin' | 'librarian';
}

const RANGES: { label: string; value: AnalyticsRange }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '1 Year', value: '1y' },
];

export function AnalyticsClient({ statsPromise, role }: AnalyticsProps) {
  const router = useRouter();
  const stats = use(statsPromise);
  const [range, setRange] = useState<AnalyticsRange | 'custom'>('30d');
  const [dates, setDates] = useState<AnalyticsDates>(() => analyticsDates('30d'));
  const [loadedDates, setLoadedDates] = useState(dates);
  const [draft, setDraft] = useState(dates);
  const [dateError, setDateError] = useState('');
  const customRef = useRef<HTMLDetailsElement>(null);
  const [selection, setSelection] = useState<AnalyticsSelection | null>(null);
  const applyDates = (next: AnalyticsDates, preset: AnalyticsRange | 'custom') => {
    setDates(next); setRange(preset); setSelection(null);
  };
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const summaryRequestRef = useRef(0);

  const loadSummary = useCallback(async () => {
    // Only the newest request may update the charts (e.g. after fast range changes).
    const requestId = ++summaryRequestRef.current;
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await getAnalyticsSummary(range === 'custom' ? '30d' : range, dates);
      if (requestId !== summaryRequestRef.current) return;
      setSummary(data);
      setLoadedDates(dates);
    } catch {
      if (requestId !== summaryRequestRef.current) return;
      setSummaryError("Analytics data couldn't be loaded.");
      toast.error("Failed to load analytics data");
    } finally {
      if (requestId === summaryRequestRef.current) setIsLoadingSummary(false);
    }
  }, [range, dates]);

  useEffect(() => {
    startTransition(() => {
      loadSummary();
    });
  }, [loadSummary]);

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      loadSummary();
      startTransition(() => {
        router.refresh();
      });
    }, 500);
  }, [loadSummary, router, startTransition]);

  // Real-time Subscriptions
  useEffect(() => {
    const supabase = createClient();
    const channelName = `analytics-live-${Math.random().toString(36).slice(2, 7)}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrowing_records' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, debouncedRefresh)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [debouncedRefresh]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-end px-1">
        <div className="flex bg-muted/40 p-1 rounded-xl border border-border/60">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => applyDates(analyticsDates(r.value), r.value)}
              className={cn(
                "px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all",
                range === r.value 
                  ? "bg-foreground text-background shadow-lg scale-[1.02]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              )}
            >
              {r.label}
            </button>
          ))}
          <details ref={customRef} className="relative">
            <summary className={cn("list-none cursor-pointer rounded-lg px-4 py-1.5 text-[11px] font-bold", range === 'custom' ? 'bg-foreground text-background' : 'text-muted-foreground')}>Custom</summary>
            <form className="absolute right-0 top-full z-30 mt-2 w-64 space-y-3 rounded-xl border border-border bg-background p-4 shadow-lg"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const chosen = { from: String(form.get('from')), to: String(form.get('to')) };
                if (!validateDates(chosen)) { setDateError('Choose valid dates in order, within one year.'); return; }
                setDateError(''); setDraft(chosen); applyDates(chosen, 'custom'); if (customRef.current) customRef.current.open = false;
              }}>
              <label className="block text-xs">From<input type="date" name="from" required value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" /></label>
              <label className="block text-xs">To<input type="date" name="to" required min={draft.from} value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" /></label>
              {dateError && <p role="alert" className="text-xs text-destructive">{dateError}</p>}
              <button type="submit" className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Apply</button>
            </form>
          </details>
        </div>
      </div>
      {range === 'custom' && <div className="flex justify-end gap-3 text-xs text-muted-foreground">
        <span>{dates.from} – {dates.to}</span>
        <button type="button" className="underline underline-offset-4" onClick={() => applyDates(analyticsDates('30d'), '30d')}>Reset</button>
      </div>}

      {/* Main Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: "Daily Traffic", 
            value: stats.attendanceToday, 
            icon: Clock, 
            desc: "Check-ins today",
            href: "/attendance"
          },
          { 
            label: "Active Borrows", 
            value: stats.activeBorrows, 
            icon: BookOpen, 
            desc: "Currently out",
            href: "/history?status=ACTIVE"
          },
          { 
            label: "Inventory", 
            value: stats.totalBooks, 
            icon: Library, 
            desc: "Total volumes",
            href: "/inventory"
          },
          { 
            label: "Members", 
            value: stats.totalUsers, 
            icon: UserCircle2, 
            desc: "Registered users",
            href: "/users"
          },
        ].map((stat, i) => (
          <Link 
            key={i} 
            href={stat.href}
            className="relative group bg-muted/5 border border-border/40 p-6 rounded-2xl hover:bg-muted/10 hover:border-primary/20 transition-all duration-300 block cursor-pointer active:scale-[0.98]"
          >
            <div className="absolute top-4 right-4 text-muted-foreground group-hover:text-primary/60 transition-colors">
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">{stat.label}</p>
            <div className="flex flex-col gap-0.5">
              <p className="text-3xl font-black text-foreground tracking-tighter">{stat.value}</p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{stat.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {!summary && summaryError ? (
        <section role="alert" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">{summaryError}</p>
          <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={isLoadingSummary}
            className="mt-2 h-9 rounded-lg border border-border px-4 text-xs font-bold hover:bg-muted/40 disabled:opacity-50"
          >
            {isLoadingSummary ? "Retrying..." : "Retry"}
          </button>
        </section>
      ) : (
      <>
      {/* Primary Visualizations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative overflow-hidden">
          {!summary ? (
            <ChartSkeleton title="Peak Visiting Hours" />
          ) : (
            <PeakHoursBarChart 
              data={summary.peakHours} 
              title="Peak Visiting Hours"
              onSelect={(hour) => setSelection({ kind: 'hour', key: hour, title: `Visits at ${hour}`, ...loadedDates })}
              color="hsl(var(--primary))" 
            />
          )}
          {(isPending || isLoadingSummary) && summary && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20 overflow-hidden">
               <div className="h-full bg-primary animate-[shimmer_2s_infinite_linear]" style={{ width: '30%', background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)' }} />
            </div>
          )}
        </div>

        <div className="relative overflow-hidden">
          {!summary ? (
            <ChartSkeleton title="Circulation Trends" />
          ) : (
            <TrendChart 
              data={summary.borrowingTrends} 
              title="Circulation Trends" 
              color="hsl(var(--primary))" 
              onSelect={(point) => { if (point.from && point.to) setSelection({ kind: 'period', key: '', title: `Borrowings · ${point.label}`, from: point.from, to: point.to }); }}
            />
          )}
          {(isPending || isLoadingSummary) && summary && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20 overflow-hidden">
               <div className="h-full bg-primary animate-[shimmer_2s_infinite_linear]" style={{ width: '30%', background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)' }} />
            </div>
          )}
        </div>
      </section>

      {/* Deep Insights */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pie Chart */}
        <div className="lg:col-span-5 flex flex-col">
          {summary ? (
            <CategoryPieChart data={summary.categoryDistribution} title="Genre Popularity" onSelect={(name) => setSelection({ kind: 'genre', key: name, title: `${name} borrowings`, ...loadedDates })} />
          ) : (
            <div className="w-full h-[280px] flex flex-col animate-pulse border border-border/40 rounded-2xl p-4 bg-muted/[0.02]">
              <div className="w-24 h-3 bg-muted/20 rounded mb-8" />
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-32 h-32 rounded-full border-[12px] border-muted/10" />
                <div className="w-24 h-2 bg-muted/10 rounded" />
              </div>
            </div>
          )}
        </div>

        {/* Popular List */}
        <div className="lg:col-span-7 bg-muted/5 border border-border/40 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-border/5">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">High Demand Catalog</p>
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Top Performance</span>
          </div>
          
          <div className="flex-1">
            {summary ? (
              <div className="divide-y divide-border/5">
                {summary.popularBooks.length > 0 ? summary.popularBooks.map((book, i) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setModalOpen(true);
                    }}
                    className="w-full text-left flex items-center justify-between py-5 px-6 hover:bg-primary/[0.04] transition-colors group focus:outline-none focus:bg-primary/[0.04]"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-[11px] font-black text-muted-foreground w-4 group-hover:text-primary/40 transition-colors">0{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{book.title}</p>
                        {/* Author (and ISBN) tell apart books that share a title. */}
                        <p className="text-xs text-muted-foreground truncate">
                          {book.author ? `by ${book.author}` : 'Unknown author'}
                          {book.isbn && <span className="font-mono"> · ISBN {book.isbn}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="h-1 w-12 bg-muted/20 rounded-full overflow-hidden hidden sm:block">
                        <div 
                          className="h-full bg-primary/40 rounded-full" 
                          style={{ width: `${(book.count / (summary.popularBooks[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-baseline gap-1 text-foreground">
                        <span className="font-black text-sm">{book.count}</span>
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">borrows</span>
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="flex items-center justify-center py-20">
                    <p className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground italic">No circulation data recorded</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/5 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between py-5 px-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-4 h-2 bg-muted/20 rounded" />
                      <div className="w-1/2 h-3 bg-muted/10 rounded" />
                    </div>
                    <div className="w-12 h-3 bg-muted/10 rounded" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      </>
      )}
      {selection && <AnalyticsDetailModal key={JSON.stringify(selection)} selection={selection} onClose={() => setSelection(null)} />}
      {selectedBookId && (
        <BookDetailModal
          bookId={selectedBookId}
          open={modalOpen}
          onOpenChange={setModalOpen}
          variant="super_admin"
          canManage={role === 'super_admin'}
        />
      )}
    </div>
  );
}
