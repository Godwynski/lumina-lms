'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, BookMarked, Clock, Loader2, ScanLine, RotateCcw, Library, BookOpen, ShieldCheck, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type RecentBook = {
  id: string;
  title: string;
  author: string;
  created_at: string;
};

interface DashboardProps {
  user: User;
  role: string | null;
  stats: {
    activeLoans: number;
    pendingApprovals: number;
    myActiveLoans: number;
    recentBooks: RecentBook[];
  };
}

export function DashboardClient({ role, stats }: DashboardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isStudent = role === 'student';
  const canReviewApprovals = role === 'admin' || role === 'librarian';

  const actions = isStudent
    ? [
        { title: 'Book Catalog', href: '/protected/student-catalog', icon: Library },
        { title: 'Digital Assets', href: '/protected/resources', icon: BookOpen },
        { title: 'Loan History', href: '/protected/history', icon: History },
      ]
    : [
        { title: 'Checkout', href: '/protected/borrow', icon: ScanLine },
        { title: 'Return', href: '/protected/return', icon: RotateCcw },
        { title: 'Inventory', href: '/protected/catalog', icon: Library },
        { title: 'Digital Assets', href: '/protected/resources', icon: BookOpen },
        ...(canReviewApprovals ? [{ title: 'Card Approvals', href: '/protected/admin/approvals', icon: ShieldCheck }] : []),
      ];

  const queueItems = [
    {
      label: isStudent ? 'My Active Loans' : 'Active Loans Now',
      value: isStudent ? stats.myActiveLoans : stats.activeLoans,
      href: '/protected/history',
    },
    {
      label: 'Pending Card Approvals',
      value: stats.pendingApprovals,
      href: '/protected/admin/approvals',
      show: canReviewApprovals,
    },
  ].filter((item) => item.show !== false);

  return (
    <div className="space-y-4 pb-6 md:space-y-5">
      <section className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm md:px-5 md:py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Operations Dashboard</h1>
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">Core actions and live queue only.</p>
          </div>
          <Badge variant="outline" className="w-fit border-border bg-muted text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {role ?? 'member'}
          </Badge>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Core Actions</h2>
        <div className={`grid grid-cols-2 gap-2 ${actions.length > 4 ? 'md:grid-cols-3 xl:grid-cols-5' : 'md:grid-cols-4'}`}>
          {actions.map((action) => (
            <Button
              key={action.title}
              asChild
              variant="outline"
              className="h-auto min-h-16 flex-col items-start gap-1.5 rounded-lg border-border bg-card px-3 py-2.5 text-left hover:bg-muted"
            >
              <Link href={action.href}>
                <action.icon size={15} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{action.title}</span>
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Needs Attention</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {queueItems.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="border-border bg-card shadow-sm transition-colors hover:bg-muted">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</CardDescription>
                    <CardTitle className="mt-0.5 text-2xl font-bold text-foreground">{item.value}</CardTitle>
                  </div>
                  <ArrowUpRight className="text-muted-foreground" size={16} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground md:text-lg">
            <BookMarked size={16} className="text-muted-foreground" />
            Recent Catalog Activity
          </h2>
          <Button asChild variant="ghost" size="sm" className="h-8 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Link href={isStudent ? '/protected/student-catalog' : '/protected/catalog'}>
              Open Catalog <ArrowUpRight size={14} className="ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-2">
          {stats.recentBooks.length > 0 ? (
            stats.recentBooks.slice(0, 4).map((book) => (
              <Link key={book.id} href={`/protected/catalog/${book.id}`}>
                <Card className="border-border bg-card shadow-sm transition-colors hover:bg-muted">
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock size={13} />
                      {new Date(book.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">No recent activity available.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
