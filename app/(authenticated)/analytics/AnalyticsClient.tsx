'use client';

import { use, useState, useEffect, useTransition, useCallback } from 'react';
import { Clock, BookOpen, Library, UserCircle2, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { TrendChart, StatusPieChart } from './AnalyticsCharts';
import { getAnalyticsSummary, type AnalyticsSummary, type AnalyticsRange } from '@/lib/actions/analytics';
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
}

const RANGES: { label: string; value: AnalyticsRange }[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '1 Year', value: '1y' },
];

export function AnalyticsClient({ statsPromise }: AnalyticsProps) {
  const stats = use(statsPromise);
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isPending, startTransition] = useTransition();

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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-primary" />
            <h1 className="text-2xl font-black tracking-tight text-foreground">System Insights</h1>
          </div>
          <p className="text-sm font-medium text-muted-foreground/60 max-w-md">
            Real-time visualization of library traffic, circulation patterns, and collection health.
          </p>
        </div>

        <div className="flex bg-muted/40 p-1 rounded-xl border border-border/20 self-start md:self-auto">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                range === r.value 
                  ? "bg-foreground text-background shadow-lg scale-[1.02]" 
                  : "text-muted-foreground/50 hover:text-foreground/80 hover:bg-muted/50"
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
            desc: "Check-ins today" 
          },
          { 
            label: "Active Borrows", 
            value: stats.activeBorrows, 
            icon: BookOpen, 
            desc: "Currently out" 
          },
          { 
            label: "Inventory", 
            value: stats.totalBooks, 
            icon: Library, 
            desc: "Total volumes" 
          },
          { 
            label: "Members", 
            value: stats.totalUsers, 
            icon: UserCircle2, 
            desc: "Registered users" 
          },
        ].map((stat, i) => (
          <div key={i} className="relative group bg-muted/5 border border-border/10 p-6 rounded-2xl hover:bg-muted/10 hover:border-primary/20 transition-all duration-300">
            <div className="absolute top-4 right-4 text-muted-foreground/10 group-hover:text-primary/10 transition-colors">
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4">{stat.label}</p>
            <div className="flex flex-col gap-0.5">
              <p className="text-3xl font-black text-foreground tracking-tighter">{stat.value}</p>
              <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tight">{stat.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Primary Visualizations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-muted/5 border border-border/10 rounded-2xl p-6 relative overflow-hidden">
          {isPending && !summary && (
            <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] z-20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
            </div>
          )}
          {summary ? (
            <TrendChart 
              data={summary.attendanceTrends} 
              title="Traffic Distribution" 
              color="hsl(var(--primary))" 
            />
          ) : (
            <div className="h-[280px] flex items-center justify-center bg-muted/5 rounded-xl border border-dashed border-border/20">
              <Loader2 className="h-6 w-6 animate-spin text-muted/20" />
            </div>
          )}
        </div>

        <div className="bg-muted/5 border border-border/10 rounded-2xl p-6 relative overflow-hidden">
          {isPending && !summary && (
            <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] z-20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
            </div>
          )}
          {summary ? (
            <TrendChart 
              data={summary.borrowingTrends} 
              title="Circulation Trends" 
              color="hsl(var(--primary))" 
            />
          ) : (
            <div className="h-[280px] flex items-center justify-center bg-muted/5 rounded-xl border border-dashed border-border/20">
              <Loader2 className="h-6 w-6 animate-spin text-muted/20" />
            </div>
          )}
        </div>
      </section>

      {/* Deep Insights */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pie Chart */}
        <div className="lg:col-span-5 bg-muted/5 border border-border/10 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Asset Allocation</p>
            <Sparkles size={14} className="text-primary/30" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            {summary ? (
              <StatusPieChart data={summary.statusDistribution} />
            ) : (
              <div className="h-[240px] w-full bg-muted/5 rounded-xl border border-dashed border-border/20 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted/20" />
              </div>
            )}
          </div>
        </div>

        {/* Popular List */}
        <div className="lg:col-span-7 bg-muted/5 border border-border/10 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-border/5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">High Demand Catalog</p>
            <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">Top Performance</span>
          </div>
          
          <div className="flex-1">
            {summary ? (
              <div className="divide-y divide-border/5">
                {summary.popularBooks.length > 0 ? summary.popularBooks.map((book, i) => (
                  <div key={i} className="flex items-center justify-between py-5 px-6 hover:bg-primary/[0.02] transition-colors group">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-[10px] font-black text-muted-foreground/20 w-4 group-hover:text-primary/40 transition-colors">0{i + 1}</span>
                      <p className="text-sm font-bold text-foreground truncate">{book.title}</p>
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
                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tight">borrows</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                    <Sparkles className="text-muted-foreground/10" size={32} />
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/30">Quiet Period Observed</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted/5" />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}