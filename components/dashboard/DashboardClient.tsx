'use client';

import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, BookMarked, CheckCircle2, Library, BookOpen, ShieldCheck, History, HelpCircle, Zap, AlertCircle, Users, BarChart2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import MyCardContainer from '@/components/library/MyCardContainer';

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
    status: "active" | "pending" | "suspended" | "expired";
    expiryDate: string;
    avatarUrl: string | null;
    qrUrl: string | null;
    address?: string;
    phone?: string;
  } | null;
  studentFaqs?: {
    question: string;
    answer: string;
  }[];
}

export function DashboardClient({ role, stats, studentCard, studentFaqs = [] }: DashboardProps) {
  // NOTE: The useState(mounted)+useEffect hydration fence has been intentionally removed.
  // All data is passed as props from the RSC page — there are no client-only APIs (window,
  // localStorage) accessed at render time. The 'use client' boundary is kept only because
  // <Collapsible> requires client-side event handling.

  const isStudent = role === 'student';
  const canReviewApprovals = role === 'admin' || role === 'librarian';

  const operationsGroups = isStudent ? [
    {
      title: 'Library Ops',
      items: [
        { title: 'Book Catalog', href: '/protected/student-catalog', icon: Library },
        { title: 'Digital Assets', href: '/protected/resources', icon: BookOpen },
      ]
    },
    {
      title: 'Account',
      items: [
        { title: 'Borrow History', href: '/protected/history', icon: History },
      ]
    }
  ] : [
    {
      title: 'Library Ops',
      items: [
        { title: 'Inventory', href: '/protected/catalog', icon: Library },
        { title: 'Digital Assets', href: '/protected/resources', icon: BookOpen },
      ]
    },
    {
      title: 'Management',
      items: [
        { title: 'Users & Roles', href: '/protected/users', icon: Users },
        ...(canReviewApprovals ? [{ title: 'Card Approvals', href: '/protected/admin/approvals', icon: ShieldCheck }] : []),
        { title: 'Analytics', href: '/protected/reports', icon: BarChart2 },
      ]
    }
  ];

  const queueItems = [
    {
      label: isStudent ? 'My Active Borrows' : 'Active Borrows Now',
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
      <div className="space-y-4 pb-10 overflow-x-hidden">
        <section className="grid gap-6 md:grid-cols-12 items-start">
          {/* Main Hero: The Digital Card */}
          <Card className="md:col-span-8 border-none bg-gradient-to-br from-primary/10 via-background to-primary/5 shadow-md overflow-hidden relative group p-6">
            {studentCard ? (
              <MyCardContainer initialData={studentCard} variant="dashboard" />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Library size={48} className="text-muted-foreground/20 mb-4" />
                <h2 className="text-xl font-bold text-muted-foreground/40">No Digital Card Available</h2>
                <p className="text-sm text-muted-foreground/40 mt-1">Please contact the librarian if you believe this is an error.</p>
              </div>
            )}
          </Card>

          {/* Stats & Quick Actions Sidebar */}
          <div className="md:col-span-4 space-y-4 h-full">
            <Card className="border-border bg-card shadow-sm border-border/70 h-full">
              <CardContent className="p-4 flex flex-col justify-between h-full gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Active Borrows</p>
                      <p className="text-3xl font-black text-primary">{stats.myActiveLoans}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" className="h-12 flex-col gap-1 rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/20 transition-all font-bold">
                      <Link href="/protected/history">
                        <History size={16} className="text-primary/60" />
                        <span className="text-[9px] uppercase tracking-wider">History</span>
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-12 flex-col gap-1 rounded-xl border-border/60 hover:bg-primary/5 hover:border-primary/20 transition-all font-bold">
                      <Link href="/protected/student-catalog">
                        <Library size={16} className="text-primary/60" />
                        <span className="text-[9px] uppercase tracking-wider">Catalog</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                <Button asChild className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95">
                  <Link href="/protected/my-card">Manual & Tips</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Discovery & New Arrivals - Horizontal Scroll */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
              Recommended & Recent
            </h2>
            <Link href="/protected/student-catalog" className="text-[10px] font-bold text-primary hover:underline">Explore All</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x px-0.5">
            {stats.recentBooks.map((book) => (
              <Link key={book.id} href={`/protected/student-catalog/${book.id}`} className="flex-none w-[140px] snap-start group bg-card border border-border/60 rounded-xl overflow-hidden hover:border-primary/30 transition-all shadow-sm">
                <div className="aspect-[3/4] bg-muted/30 flex flex-col items-center justify-center relative overflow-hidden">
                  <BookMarked size={28} className="text-muted-foreground/20 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="p-2.5 bg-card">
                  <p className="truncate text-[11px] font-bold text-foreground/90 leading-tight">{book.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground/60 mt-0.5">{book.author}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQs */}
        {studentFaqs && studentFaqs.length > 0 && (
          <section className="space-y-3 pt-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <HelpCircle className="h-3 w-3 text-primary" />
              Frequently Asked Questions
            </h2>
            <div className="grid gap-2">
              {studentFaqs.map((faq, index) => (
                <Collapsible key={index} className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left font-semibold text-sm hover:bg-muted/50 transition-colors">
                    {faq.question}
                    <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 text-sm text-muted-foreground border-t border-border/40 pt-2">
                    {faq.answer}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </section>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Sticky Core Actions Hub */}
      <section className="sticky top-0 z-20 -mx-1 rounded-xl border border-border/60 bg-background/90 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 overflow-x-hidden shadow-sm">
        <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Operations hub</h2>
        <div className="mt-2.5 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
          {operationsGroups.map(group => (
            <div key={group.title} className="flex min-w-max flex-col gap-1.5 border-l border-border/40 pl-3 first:border-0 first:pl-0">
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">{group.title}</span>
              <div className="flex gap-2">
                {group.items.map(action => (
                  <Button
                    key={action.title}
                    asChild
                    variant="outline"
                    className="h-9 min-w-[110px] justify-start gap-2 rounded-md border-border/60 bg-card px-2.5 shadow-none text-left text-foreground hover:bg-muted/80 transition-all active:scale-[0.98]"
                  >
                    <Link href={action.href} aria-label={action.title} title={action.title}>
                      <action.icon size={14} className="shrink-0 text-primary" />
                      <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">{action.title}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Needs attention</h2>
        {attentionItems.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {attentionItems.map((item) => (
              <Link key={item.label} href={item.href}>
                <Card className="border-border/60 bg-card shadow-none transition-all hover:bg-muted/40 hover:border-primary/20">
                  <CardContent className="flex items-center justify-between p-2.5">
                    <div>
                      <CardDescription className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">{item.label}</CardDescription>
                      <CardTitle className="mt-0 text-xl font-bold text-foreground">{item.value}</CardTitle>
                    </div>
                    <div className="rounded-full bg-muted/50 p-1">
                      <ArrowUpRight className="text-muted-foreground/70" size={14} />
                    </div>
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

        <div className="grid gap-1.5">
          {stats.recentBooks.length > 0 ? (
            stats.recentBooks.slice(0, 3).map((book) => (
              <Link key={book.id} href={`/protected/catalog/${book.id}`}>
                <Card className="border-border/50 bg-card/50 shadow-none transition-all hover:bg-muted/40">
                  <CardContent className="flex items-center justify-between gap-3 p-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-6 shrink-0 items-center justify-center rounded border border-border/60 bg-muted/40 text-[10px] font-bold text-foreground/80">
                        {book.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground/90">{book.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground/70">{book.author}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant="secondary" className="h-5 px-1.5 text-[9px] font-medium bg-muted/50 border-none text-muted-foreground/80">Catalog</Badge>
                      <div className="w-16 text-right">
                        <p className="text-[10px] font-bold text-foreground/70">{new Date(book.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</p>
                      </div>
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

      <section className="pt-2">
        <Card className="border-border/40 bg-muted/20 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-around gap-6 p-2">
            <StatusIndicator icon={Zap} label="Performance" value="Optimal" color="text-emerald-600" />
            <div className="h-6 w-px bg-border/40 hidden sm:block" />
            <StatusIndicator icon={ShieldCheck} label="Security" value="Protected" color="text-blue-600" />
            <div className="h-6 w-px bg-border/40 hidden sm:block" />
            <StatusIndicator icon={AlertCircle} label="Storage" value="94% Free" color="text-muted-foreground" />
          </CardContent>
        </Card>
      </section>

    </div>
  );
}

function StatusIndicator({ icon: Icon, label, value, color }: { icon: React.ElementType, label: string, value: string, color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className={cn("shrink-0", color)} />
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">{label}:</span>
      <span className={cn("text-[11px] font-bold", color)}>{value}</span>
    </div>
  );
}
