'use client';

import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import Image from 'next/image';
import { ArrowUpRight, BookMarked, CheckCircle2, Library, BookOpen, ShieldCheck, History, HelpCircle, Zap, Users, BarChart2, ChevronDown, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import dynamic from 'next/dynamic';

const MyCardContainer = dynamic(() => import('@/components/library/MyCardContainer'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted" />
});
import { type ViolationWithProfile } from '@/lib/actions/violations';
import { type BorrowingRecord } from '@/lib/actions/history';

type RecentBook = {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
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
    totalPoints?: number;
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
  activeLoansList?: BorrowingRecord[];
  violationsList?: ViolationWithProfile[];
}

import { useMemo, useState, useEffect } from 'react';

export function DashboardClient({ role, stats, studentCard, studentFaqs = [], activeLoansList = [], violationsList = [] }: DashboardProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // NOTE: We use a 'mounted' state to avoid hydration mismatches 
  // caused by locale-dependent Date strings.

  const isStudent = role === 'student';
  const canReviewApprovals = role === 'admin' || role === 'librarian';

  const operationsGroups = useMemo(() => isStudent ? [
    {
      title: 'Library Ops',
      items: [
        { title: 'Book Catalog', href: '/student-catalog', icon: Library },
        { title: 'Digital Assets', href: '/resources', icon: BookOpen },
      ]
    },
    {
      title: 'Account',
      items: [
        { title: 'Borrow History', href: '/history', icon: History },
      ]
    }
  ] : [
    {
      title: 'Library Ops',
      items: [
        { title: 'Inventory', href: '/catalog', icon: Library },
        { title: 'Digital Assets', href: '/resources', icon: BookOpen },
      ]
    },
    {
      title: 'Management',
      items: [
        { title: 'Users & Roles', href: '/users', icon: Users },
        ...(canReviewApprovals ? [{ title: 'Card Approvals', href: '/admin/approvals', icon: ShieldCheck }] : []),
        { title: 'Analytics', href: '/reports', icon: BarChart2 },
      ]
    }
  ], [isStudent, canReviewApprovals]);

  const queueItems = useMemo(() => [
    {
      label: isStudent ? 'Borrowed Books' : 'Active Borrows Now',
      value: isStudent ? stats.myActiveLoans : stats.activeLoans,
      href: '/history',
    },
    {
      label: 'Pending Card Approvals',
      value: stats.pendingApprovals,
      href: '/admin/approvals',
      show: canReviewApprovals,
    },
  ].filter((item) => item.show !== false), [isStudent, stats.myActiveLoans, stats.activeLoans, stats.pendingApprovals, canReviewApprovals]);

  const attentionItems = useMemo(() => queueItems.filter((item) => item.value > 0), [queueItems]);

  if (isStudent) {
    return (
      <div className="space-y-6 pb-14 overflow-x-hidden">
        <section className="grid gap-6 md:grid-cols-12 items-start">
          {/* Main Hero: The Digital Card */}
          <Card className="md:col-span-8 border-none bg-gradient-to-br from-primary/10 via-background to-primary/5 shadow-md overflow-hidden relative p-5 sm:p-7">
            {studentCard ? (
              <MyCardContainer initialData={studentCard} variant="dashboard" />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Library size={42} className="text-muted-foreground/20 mb-3" />
                <h2 className="text-lg font-bold text-muted-foreground/40">No Digital Card Available</h2>
                <p className="text-xs text-muted-foreground/40 mt-1">Please contact the librarian if you believe this is an error.</p>
              </div>
            )}
          </Card>

            {/* Activity Summary */}
            <div className="md:col-span-4 space-y-5">
              {/* Demerit Points Widget */}
              {(stats.totalPoints || 0) > 0 && (
                <Card className="border-border bg-card/40 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Demerit Points</p>
                      <p className="text-2xl font-black text-amber-600">{stats.totalPoints}</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                       <ShieldAlert size={18} />
                    </div>
                  </div>
                </Card>
              )}

              {/* Active Loans Summary Info */}
              {stats.myActiveLoans > 0 && (
                <Card className="border-border bg-card/40 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Borrowed Books</p>
                      <p className="text-2xl font-black text-primary">{stats.myActiveLoans}</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                       <History size={18} />
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </section>

          {/* New Lists-Based Section */}
          <div className="grid gap-6 md:grid-cols-2">
             {/* My Active Borrows */}
             {activeLoansList.length > 0 && (
               <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                     <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <BookOpen className="h-3 w-3 text-primary" />
                        My Active Borrows
                     </h2>
                  </div>
                  <div className="grid gap-2">
                    {activeLoansList.map((loan) => (
                       <Card key={loan.id} className="border-border/60 bg-card/30 shadow-none transition-all hover:bg-muted/40 hover:border-primary/20">
                          <CardContent className="flex items-center justify-between gap-4 p-3">
                             <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20 overflow-hidden relative shadow-sm">
                                   <Library size={12} className="text-muted-foreground/30" />
                                </div>
                                <div className="min-w-0">
                                   <p className="truncate text-xs font-bold text-foreground/90">{loan.books?.title || 'Unknown Book'}</p>
                                   <p className="text-xs font-bold text-foreground/80 tracking-tight" suppressHydrationWarning>
                                      {mounted ? new Date(loan.due_date).toLocaleDateString() : '...'}
                                   </p>
                                </div>
                             </div>
                             <Badge variant={loan.status === 'OVERDUE' || (mounted && new Date(loan.due_date) < new Date()) ? 'destructive' : 'outline'} className="text-[9px] px-1.5 py-0">
                                {loan.status === 'OVERDUE' || (mounted && new Date(loan.due_date) < new Date()) ? 'Overdue' : 'Active'}
                             </Badge>
                          </CardContent>
                       </Card>
                    ))}
                  </div>
               </section>
             )}

             {/* Account Standing / Violations */}
             {violationsList.length > 0 && (
               <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                     <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <ShieldAlert className="h-3 w-3 text-amber-500" />
                        Account Standing
                     </h2>
                  </div>
                  <div className="grid gap-2">
                    {violationsList.slice(0, 3).map((violation) => (
                       <Card key={violation.id} className="border-border/60 bg-card/30 shadow-none">
                          <CardContent className="flex items-center justify-between gap-4 p-2.5">
                             <div className="min-w-0">
                                <p className="text-[10px] font-bold text-foreground/90 leading-tight truncate">{violation.violation_type.replace('_', ' ')}</p>
                                <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">{violation.severity} severity • {violation.points} pts</p>
                             </div>
                             <Badge variant="outline" className="text-[8px] border-amber-500/20 text-amber-600 bg-amber-50/50">
                                {violation.status}
                             </Badge>
                          </CardContent>
                       </Card>
                    ))}
                  </div>
               </section>
             )}
          </div>

        {/* Discovery & New Arrivals */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
              Latest In Library
            </h2>
            <Link href="/student-catalog" className="text-[10px] font-bold text-primary hover:underline transition-all">Full Catalog</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none snap-x px-0.5">
            {stats.recentBooks.map((book) => (
              <Link key={book.id} href={`/student-catalog/${book.id}`} className="flex-none w-[130px] snap-start group bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/40 transition-all shadow-sm">
                <div className="aspect-[3/4] bg-muted/20 flex flex-col items-center justify-center relative overflow-hidden">
                  {book.cover_url ? (
                    <Image 
                      src={book.cover_url} 
                      alt={book.title} 
                      fill 
                      sizes="130px" 
                      className="object-cover group-hover:scale-110 transition-transform duration-700" 
                      unoptimized={book.cover_url.startsWith('http')}
                    />
                  ) : (
                    <BookMarked size={24} className="text-muted-foreground/10 group-hover:scale-125 transition-transform duration-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-2.5 bg-card/80 backdrop-blur-sm">
                  <p className="truncate text-[10px] font-bold text-foreground leading-tight">{book.title}</p>
                  <p className="truncate text-[9px] text-muted-foreground/70 mt-0.5">{book.author}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Compressed FAQs / Help */}
        {studentFaqs && studentFaqs.length > 0 && (
          <section className="pt-2">
            <Collapsible className="bg-card/30 border border-border/40 rounded-xl overflow-hidden shadow-sm">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Support & FAQs</span>
                </div>
                <ChevronDown size={14} className="text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-2 border-t border-border/20 pt-3">
                {studentFaqs.map((faq, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-xs font-bold text-foreground/90">{faq.question}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{faq.answer}</p>
                    {index < studentFaqs.length - 1 && <div className="h-px w-full bg-border/10 my-2" />}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 overflow-x-hidden">
      <div className="grid gap-6 md:grid-cols-12 items-start">
        {/* Main Column: Tasks & Activity */}
        <div className="md:col-span-8 space-y-6">
          {/* Section: Needs Attention */}
          <section className="space-y-3">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                  Priority Queue
                </h2>
                <Badge variant="outline" className="text-[9px] font-medium border-border/60">Real-time alerts</Badge>
              </div>
            {attentionItems.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {attentionItems.map((item) => (
                  <Link key={item.label} href={item.href}>
                    <Card className="border-border bg-card/40 shadow-sm transition-all hover:bg-muted/50 hover:border-primary/30 group p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
                          <p className="mt-1 text-2xl font-black text-foreground">{item.value}</p>
                        </div>
                        <div className="rounded-xl bg-primary/10 p-2 text-primary group-hover:scale-110 transition-transform">
                          <ArrowUpRight size={18} />
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-emerald-100 p-2.5 shadow-sm">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900 leading-tight">Zero Backlog</h3>
                    <p className="text-xs text-emerald-700/80 mt-0.5">All administrative queues are currently clear.</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section: Recent Catalog Activity */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <History className="h-3 w-3 text-primary" />
                Latest In Catalog
              </h2>
              <Link href="/catalog" className="text-[10px] font-bold text-primary hover:underline">Full Inventory</Link>
            </div>

            <div className="grid gap-2">
              {stats.recentBooks.length > 0 ? (
                stats.recentBooks.slice(0, 4).map((book) => (
                  <Link key={book.id} href={`/catalog/${book.id}`}>
                    <Card className="border-border/60 bg-card/30 shadow-none transition-all hover:bg-muted/40 hover:border-primary/20">
                      <CardContent className="flex items-center justify-between gap-4 p-3">
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20 text-[10px] font-bold text-foreground/80 overflow-hidden relative shadow-sm">
                            {book.cover_url ? (
                              <Image src={book.cover_url} alt={book.title} fill sizes="30px" className="object-cover" unoptimized={book.cover_url.startsWith('http')} />
                            ) : (
                              <BookMarked size={14} className="text-muted-foreground/30" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground/90">{book.title}</p>
                            <p className="truncate text-xs text-muted-foreground/60">{book.author}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="hidden sm:block text-right">
                            <p className="text-[10px] font-bold text-foreground/60 tracking-wider" suppressHydrationWarning>
                               {new Date(book.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-[9px] text-muted-foreground/40 uppercase font-medium">Added on</p>
                          </div>
                          <div className="bg-muted p-1.5 rounded-lg">
                             <ArrowUpRight size={14} className="text-muted-foreground/40" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
                  <BookMarked size={32} className="mx-auto text-muted-foreground/10 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground/40">No recent catalog entries found.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Column: Actions & Infrastructure */}
        <aside className="md:col-span-4 space-y-6">
           {/* Section: Quick Actions */}
           <section className="space-y-3">
              <h2 className="px-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70">Terminal Commands</h2>
              <Card className="border-border bg-gradient-to-br from-primary/5 via-card to-background shadow-md shadow-primary/5 overflow-hidden">
                <div className="p-1 space-y-0.5">
                  {operationsGroups.flatMap(group => group.items).map(action => (
                    <Button
                      key={action.title}
                      asChild
                      variant="ghost"
                      className="w-full justify-between items-center h-11 px-3 hover:bg-primary/5 hover:text-primary group transition-all rounded-lg"
                    >
                      <Link href={action.href}>
                         <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-background border border-border p-1.5 group-hover:border-primary/30 transition-colors shadow-sm">
                               <action.icon size={14} className="text-muted-foreground/60 group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-xs font-bold tracking-tight">{action.title}</span>
                         </div>
                         <ArrowUpRight size={14} className="text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </Card>
           </section>

        </aside>
      </div>
    </div>
  );
}

