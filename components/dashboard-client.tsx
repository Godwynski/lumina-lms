'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, BookMarked, CheckCircle2, Clock, Loader2, RotateCcw, Library, BookOpen, ShieldCheck, History, CreditCard, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DigitalCard from '@/components/library/DigitalCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  studentCard?: {
    fullName: string;
    studentId: string;
    cardNumber: string;
    department: string;
    status: 'active' | 'pending' | 'suspended' | 'expired';
    expiryDate: string;
    avatarUrl: string | null;
    qrUrl: string | null;
  } | null;
  studentFaqs?: {
    question: string;
    answer: string;
  }[];
}

export function DashboardClient({ role, stats, studentCard, studentFaqs = [] }: DashboardProps) {
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
        { title: 'Circulation Desk', href: '/protected/circulation', icon: RotateCcw },
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

  const attentionItems = queueItems.filter((item) => item.value > 0);

  if (isStudent) {
    return (
      <div className="space-y-3 overflow-x-hidden pb-6">
        <section className="border-b border-border pb-3">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Student Dashboard</h1>
              <p className="text-sm text-muted-foreground">Quick access to your catalog, card, and loan activity.</p>
            </div>
            <Badge variant="outline" className="h-6 border-border bg-muted px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              student
            </Badge>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="space-y-3 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {actions.map((action) => (
                  <Button
                    key={action.title}
                    asChild
                    variant="outline"
                    className="h-9 justify-start gap-1.5 rounded-md border-border px-2.5 text-left text-xs"
                  >
                    <Link href={action.href}>
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted">
                        <action.icon size={12} className="text-foreground" />
                      </span>
                      <span className="min-w-0 truncate leading-tight">{action.title}</span>
                    </Link>
                  </Button>
                ))}
              </div>

              <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">My active loans</p>
                  <p className="text-lg font-bold text-foreground">{stats.myActiveLoans}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.myActiveLoans > 0 ? 'Check due dates in Loan History.' : 'No active borrowing right now.'}
                </p>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Suggested reads</p>
                {stats.recentBooks.length > 0 ? (
                  <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {stats.recentBooks.slice(0, 6).map((book) => (
                      <Link
                        key={book.id}
                        href={`/protected/student-catalog/${book.id}`}
                        className="min-w-[156px] snap-start rounded-md border border-border bg-card px-2.5 py-2 hover:bg-muted/50 sm:min-w-[190px]"
                      >
                        <p className="truncate text-xs font-medium text-foreground">{book.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{book.author}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                    Suggested reads will appear here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <BookMarked className="h-3.5 w-3.5" />
                  Recent catalog activity
                </h2>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Link href="/protected/student-catalog">Open catalog</Link>
                </Button>
              </div>

              {stats.recentBooks.length > 0 ? (
                <div className="space-y-1.5">
                  {stats.recentBooks.slice(0, 3).map((book) => (
                    <Link key={book.id} href={`/protected/student-catalog/${book.id}`}>
                      <div className="flex items-center justify-between rounded-md border border-border px-2.5 py-2 hover:bg-muted/50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{book.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No recent catalog activity.
                </div>
              )}

              <Button asChild variant="outline" className="h-8 w-full justify-between rounded-md border-border px-2 text-xs">
                <Link href="/protected/history">
                  <span className="truncate">Loan history</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <HelpCircle className="h-3.5 w-3.5" />
                  FAQs
                </h2>
                <span className="text-[10px] text-muted-foreground">Tap to expand</span>
              </div>
              <div className="space-y-1.5">
                {studentFaqs.map((item) => (
                  <Collapsible key={item.question} className="rounded-md border border-border">
                    <CollapsibleTrigger className="w-full px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/60">
                      {item.question}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-border px-2.5 py-2 text-xs leading-relaxed text-foreground/85">
                      {item.answer}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  Library card
                </h2>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Link href="/protected/my-card">Open</Link>
                </Button>
              </div>

              <div className="grid gap-1.5 rounded-md border border-border bg-muted/40 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    studentCard?.status === 'active' ? 'status-success' :
                    studentCard?.status === 'pending' ? 'status-warning' :
                    studentCard?.status === 'suspended' ? 'status-danger' : 'status-neutral'
                  }`}>
                    {studentCard?.status ?? 'pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Card number</span>
                  <span className="max-w-[65%] truncate font-mono text-foreground">{studentCard?.cardNumber ?? 'Pending assignment'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Student ID</span>
                  <span className="font-medium text-foreground">{studentCard?.studentId ?? 'N/A'}</span>
                </div>
              </div>

              <Collapsible>
                <CollapsibleTrigger className="w-full rounded-md border border-border px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/60">
                  Show visual card preview
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  {studentCard ? (
                    <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                      <DigitalCard
                        fullName={studentCard.fullName}
                        studentId={studentCard.studentId}
                        cardNumber={studentCard.cardNumber}
                        department={studentCard.department}
                        status={studentCard.status}
                        expiryDate={studentCard.expiryDate}
                        avatarUrl={studentCard.avatarUrl}
                        qrUrl={studentCard.qrUrl}
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                      Card details are still syncing. Open My Card to refresh.
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6 md:space-y-5">
      <section className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operations Dashboard</h1>
            <p className="text-sm text-muted-foreground">Core actions, queue visibility, and recent activity.</p>
          </div>
          <Badge variant="outline" className="w-fit border-border bg-muted text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {role ?? 'member'}
          </Badge>
        </div>
      </section>

      <section className="sticky top-3 z-20 -mx-1 rounded-xl border border-border/60 bg-background/90 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:top-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Core actions</h2>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {actions.map((action) => (
            <Button
              key={action.title}
              asChild
              variant="outline"
              className="h-10 min-w-10 justify-center gap-1.5 rounded-md border-border bg-card px-2 text-left text-foreground hover:bg-muted sm:min-w-[132px] sm:justify-start sm:px-2.5"
            >
              <Link href={action.href} aria-label={action.title} title={action.title}>
                <action.icon size={14} className="shrink-0 text-muted-foreground" />
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] sm:inline">{action.title}</span>
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Needs attention</h2>
        {attentionItems.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {attentionItems.map((item) => (
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
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">All caught up</p>
                <p className="text-xs text-emerald-700">No pending queue items need attention right now.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground md:text-lg">
            <BookMarked size={16} className="text-muted-foreground" />
            Recent catalog activity
          </h2>
          <Button asChild variant="ghost" size="sm" className="h-8 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Link href={isStudent ? '/protected/student-catalog' : '/protected/catalog'}>
              Open catalog <ArrowUpRight size={14} className="ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-2">
          {stats.recentBooks.length > 0 ? (
            stats.recentBooks.slice(0, 4).map((book) => (
              <Link key={book.id} href={`/protected/catalog/${book.id}`}>
                <Card className="border-border bg-card shadow-sm transition-colors hover:bg-muted">
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted text-xs font-bold text-foreground">
                        {book.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{book.title}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">Catalog</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Added</p>
                      <p className="mt-0.5 text-xs font-medium text-foreground">{new Date(book.created_at).toLocaleDateString()}</p>
                      <p className="mt-0.5 inline-flex items-center justify-end gap-1 text-[11px] text-muted-foreground"><Clock size={12} /> Recent</p>
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
