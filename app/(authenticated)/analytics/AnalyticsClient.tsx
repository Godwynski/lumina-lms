'use client';

import { use, useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { Clock, BookOpen, Library, UserCircle2, Sparkles } from 'lucide-react';
import { TrendChart, StatusPieChart, ChartSkeleton } from './AnalyticsCharts';
import { getAnalyticsSummary, type AnalyticsSummary, type AnalyticsRange } from '@/lib/actions/analytics';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
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
  const stats = use(statsPromise);
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getAnalyticsSummary(range);
      setSummary(data);
    } catch {
      toast.error("Failed to load analytics data");
    }
  }, [range]);

  useEffect(() => {
    startTransition(() => {
      loadSummary();
    });
  }, [loadSummary]);

  // Real-time Subscriptions
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('analytics-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        loadSummary();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrowing_records' }, () => {
        loadSummary();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSummary]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-end px-1">
        <div className="flex bg-muted/40 p-1 rounded-xl border border-border/60">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                range === r.value 
                  ? "bg-foreground text-background shadow-lg scale-[1.02]" 
                  : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/70"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

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
            <div className="absolute top-4 right-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 mb-4">{stat.label}</p>
            <div className="flex flex-col gap-0.5">
              <p className="text-3xl font-black text-foreground tracking-tighter">{stat.value}</p>
              <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-tight">{stat.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Primary Visualizations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative overflow-hidden">
          {!summary ? (
            <ChartSkeleton title="Traffic Distribution" />
          ) : (
            <TrendChart 
              data={summary.attendanceTrends} 
              title="Traffic Distribution" 
              color="hsl(var(--primary))" 
              href="/attendance"
            />
          )}
          {isPending && summary && (
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
              href="/history"
            />
          )}
          {isPending && summary && (
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
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/90">Asset Allocation</p>
            <Sparkles size={14} className="text-primary/30" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            {summary ? (
              <StatusPieChart data={summary.statusDistribution} href="/history" />
            ) : (
              <div className="h-[240px] w-full flex flex-col items-center justify-center gap-4 animate-pulse">
                <div className="w-32 h-32 rounded-full border-[12px] border-muted/10" />
                <div className="w-24 h-2 bg-muted/10 rounded" />
              </div>
            )}
          </div>
        </div>

        {/* Popular List */}
        <div className="lg:col-span-7 bg-muted/5 border border-border/40 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-border/5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/90">High Demand Catalog</p>
            <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Top Performance</span>
          </div>
          
          <div className="flex-1">
            {summary ? (
              <div className="divide-y divide-border/5">
                {summary.popularBooks.length > 0 ? summary.popularBooks.map((book, i) => (
                  <button 
                    key={i} 
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setModalOpen(true);
                    }}
                    className="w-full text-left flex items-center justify-between py-5 px-6 hover:bg-primary/[0.04] transition-colors group focus:outline-none focus:bg-primary/[0.04]"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-[10px] font-black text-muted-foreground/20 w-4 group-hover:text-primary/40 transition-colors">0{i + 1}</span>
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{book.title}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-12 bg-muted/20 rounded-full overflow-hidden hidden sm:block">
                        <div 
                          className="h-full bg-primary/40 rounded-full" 
                          style={{ width: `${(book.count / (summary.popularBooks[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-baseline gap-1 text-foreground">
                        <span className="font-black text-sm">{book.count}</span>
                        <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-tight">borrows</span>
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="flex items-center justify-center py-20">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/30 italic">No circulation data recorded</p>
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
