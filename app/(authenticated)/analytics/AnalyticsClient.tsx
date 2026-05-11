'use client';

import { use, useState, useEffect, useTransition, useCallback } from 'react';
import { Clock, BookOpen, Library, UserCircle2, Loader2 } from 'lucide-react';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
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
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '1Y', value: '1y' },
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
        loadSummary(); // Refresh without full loading state for real-time feel
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
    <AdminTableShell
      title={null}
      description={null}
      headerActions={
        <div className="flex items-center justify-between w-full">
          <div className="flex bg-muted/20 p-1 rounded-lg border border-border/10">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] rounded-md transition-all",
                  range === r.value 
                    ? "bg-foreground text-background shadow-sm" 
                    : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/30"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      }
      variant="ghost"
    >
      <div className="space-y-4">
        {/* Stats Overview - Compact */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Visits Today", value: stats.attendanceToday, icon: Clock },
            { label: "Books Borrowed", value: stats.activeBorrows, icon: BookOpen },
            { label: "Total Collection", value: stats.totalBooks, icon: Library },
            { label: "Library Users", value: stats.totalUsers, icon: UserCircle2 },
          ].map((stat, i) => (
            <div key={i} className="flex items-center justify-between border-l border-primary/20 bg-muted/5 p-3 px-4 transition-all">
              <div className="flex flex-col">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">{stat.label}</p>
                <p className="text-lg font-black text-foreground tracking-tight">{stat.value}</p>
              </div>
              <stat.icon size={14} className="text-muted-foreground/30" />
            </div>
          ))}
        </section>

        {/* Main Charts - High Density */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border-t border-border/5 bg-transparent p-4 relative overflow-hidden group">
            {isPending && !summary && (
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/10" />
              </div>
            )}
            {summary ? (
              <TrendChart 
                data={summary.attendanceTrends} 
                title="Daily Visits" 
                color="hsl(var(--primary))" 
              />
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted/5" />
              </div>
            )}
          </div>

          <div className="border-t border-border/5 bg-transparent p-4 relative overflow-hidden group">
            {isPending && !summary && (
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/10" />
              </div>
            )}
            {summary ? (
              <TrendChart 
                data={summary.borrowingTrends} 
                title="Book Loans" 
                color="hsl(var(--primary))" 
              />
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted/5" />
              </div>
            )}
          </div>
        </section>

        {/* Secondary Insights - Compact Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 border-t border-border/5 bg-transparent p-5">
             <div className="px-1 py-4 flex items-center justify-between">
               <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                 Book Availability
               </p>
             </div>
             {summary ? (
               <StatusPieChart data={summary.statusDistribution} />
             ) : (
               <div className="h-[220px] flex items-center justify-center">
                 <Loader2 className="h-6 w-6 animate-spin text-muted/5" />
               </div>
             )}
           </div>
 
          <div className="lg:col-span-2 border-t border-border/5 bg-transparent overflow-hidden flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border/10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Most Popular Books
              </p>
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Rank</span>
            </div>
            <div className="flex-1 p-0">
              {summary ? (
                <div className="divide-y divide-border/10">
                  {summary.popularBooks.length > 0 ? summary.popularBooks.map((book, i) => (
                    <div key={i} className="flex items-center justify-between py-3 px-5 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-muted-foreground/50 w-4 group-hover:text-foreground/70 transition-colors">{i + 1}</span>
                        <p className="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-none">{book.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground font-black text-sm">
                        {book.count}
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">units</span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-muted-foreground/40 text-[10px] uppercase tracking-widest font-black">No Data Recorded</div>
                  )}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted/10" />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminTableShell>
  );
}