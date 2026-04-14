'use client';

import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import Image from 'next/image';
import { ArrowUpRight, BookMarked, CheckCircle2, Library, BookOpen, History, HelpCircle, Zap, ChevronDown, ShieldAlert, Users, Bookmark, XCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { useTransition } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import dynamic from 'next/dynamic';

const MyCardContainer = dynamic(() => import('@/components/library/MyCardContainer'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted" />
});
import { useMemo, useState, useEffect, use } from 'react';
import { resolveStudentId, getDeterministicQrUrl } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
import type { ViolationWithProfile } from '@/lib/actions/violations';
import type { BorrowingRecord } from '@/lib/actions/history';

type ProfileData = {
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  avatar_url: string | null;
  address: string | null;
  phone: string | null;
};

type CardData = { card_number: string; status: string; expires_at: string } | null;

type FaqRow = { key: string; value: string | null };

interface Reservation {
  id: string;
  status: string;
  queue_position: number;
  books: {
    title: string;
    cover_url: string | null;
  } | null;
}

type DashboardStats = {
  activeLoans: number;
  pendingApprovals: number;
  myActiveLoans: number;
  recentBooks: { id: string; title: string; author: string; cover_url?: string | null; created_at: string }[];
  activeLoansList?: BorrowingRecord[];
  violationsList?: ViolationWithProfile[];
  totalPoints?: number;
};

interface DashboardProps {
  user: User;
  role: string | null;
  statsPromise: Promise<DashboardStats>;
  profilePromise: Promise<{ data: ProfileData | null }>;
  cardPromise: Promise<{ data: CardData }>;
  faqPromise: Promise<{ data: FaqRow[] | null }>;
  reservationsPromise: Promise<Reservation[]>;
}

export function DashboardClient({ user, role, statsPromise, profilePromise, cardPromise, faqPromise, reservationsPromise }: DashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  // Unwrap promises using the 'use' hook
  const stats = use(statsPromise);
  const profileResult = use(profilePromise);
  const cardResult = use(cardPromise);
  const faqResult = use(faqPromise);
  const reservations = use(reservationsPromise);

  const profileData = profileResult.data;
  const activeLoansList = stats.activeLoansList || [];
  const violationsList = stats.violationsList || [];

  // Data resolution logic (moved from server to allow granular streaming if needed)
  const { studentCard, studentFaqs } = useMemo(() => {
    let card = null;
    let faqs = [...DEFAULT_STUDENT_FAQS];

    if (role === "student" && profileData) {
      const studentCardData = cardResult.data;
      const faqRows = faqResult.data;

      const resolvedStudentId = resolveStudentId({
        studentId: profileData.student_id,
        fallbackEmail: user.email,
        userId: user.id,
      });

      card = {
        fullName: profileData.full_name || "Student",
        studentId: resolvedStudentId || profileData.student_id || "N/A",
        cardNumber: studentCardData?.card_number || "Pending assignment",
        department: profileData.department || "General",
        status: (studentCardData?.status as "active" | "pending" | "suspended" | "expired") || "pending",
        expiryDate: studentCardData?.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
        avatarUrl: profileData.avatar_url,
        qrUrl: resolvedStudentId ? getDeterministicQrUrl(resolvedStudentId) : null,
        address: profileData.address || undefined,
        phone: profileData.phone || undefined,
      };

      if (faqRows && faqRows.length > 0) {
        const byKey = new Map(faqRows.map((row: FaqRow) => [String(row.key), String(row.value ?? "")]));
        const pairs = [];
        for (let i = 1; i <= 4; i += 1) {
          const question = byKey.get(`faq_student_q${i}`) || DEFAULT_STUDENT_FAQS[i - 1]?.question || "";
          const answer = byKey.get(`faq_student_a${i}`) || DEFAULT_STUDENT_FAQS[i - 1]?.answer || "";
          if (question.trim() && answer.trim()) pairs.push({ question, answer });
        }
        if (pairs.length > 0) faqs = pairs;
      }
    }
    return { studentCard: card, studentFaqs: faqs };
  }, [role, profileData, cardResult, faqResult, user]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isStudent = role === 'student';

  const handleCancelReservation = (id: string, title: string) => {
    if (!confirm(`Cancel reservation for "${title}"?`)) return;
    startTransition(async () => {
      try {
        const res = await cancelReservation(id);
        if (res.success) toast.success("Reservation cancelled.");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Cancellation failed");
      }
    });
  };

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

          {/* My Pending Reservations */}
          {reservations.length > 0 && (
            <section className="space-y-3">
               <div className="flex items-center justify-between px-1 text-primary">
                  <h2 className="text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2">
                     <Bookmark className="h-3 w-3" />
                     Reservations & Holds
                  </h2>
               </div>
               <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                 {reservations.map((res) => (
                   <Card key={res.id} className={`border-border/60 shadow-none transition-all ${res.status === 'READY' ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-card/30'}`}>
                      <CardContent className="flex items-center justify-between gap-4 p-3">
                         <div className="flex min-w-0 items-center gap-3">
                           <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20 overflow-hidden relative shadow-sm">
                              {res.books?.cover_url ? (
                                 <Image src={res.books.cover_url} alt="" fill className="object-cover" sizes="30px" />
                              ) : (
                                 <Library size={12} className="text-muted-foreground/30" />
                              )}
                           </div>
                           <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground/90">{res.books?.title || 'Unknown Book'}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                 {res.status === 'READY' ? (
                                   <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                                      <Zap size={10} className="fill-primary" />
                                      Ready for Pickup
                                   </p>
                                 ) : (
                                   <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                      <Clock size={10} />
                                      Position: {res.queue_position}
                                   </p>
                                 )}
                              </div>
                           </div>
                         </div>
                         <div className="flex items-center gap-2">
                           <Badge variant={res.status === 'READY' ? 'default' : 'outline'} className="text-[9px] px-1.5 py-0 h-5">
                              {res.status}
                           </Badge>
                           <button 
                             onClick={() => handleCancelReservation(res.id, res.books?.title || "Unknown Book")}
                             disabled={isPending}
                             className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                             title="Cancel Reservation"
                           >
                             <XCircle size={14} />
                           </button>
                         </div>
                      </CardContent>
                   </Card>
                 ))}
               </div>
            </section>
          )}

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


  // STAFF / ADMIN DASHBOARD
  return (
    <div className="space-y-4 pb-14 w-full min-w-0 flex flex-col overflow-hidden">

      <div className="grid gap-8 md:grid-cols-2 items-start w-full min-w-0">
        {/* LEFT COLUMN: ACTION REQUIRED */}
        <div className="space-y-6 min-w-0 w-full overflow-hidden">
           <div className="flex items-center justify-between px-1">
             <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                Action Required
             </h2>
           </div>
           
           <div className="grid gap-3">
              {/* Only show pending approvals explicitly in the urgent feed here, 
                  plus any overdue/flagged items if we add them to 'violationsList' or similar in the future */}
              {stats.pendingApprovals > 0 ? (
                 <Link href="/admin/approvals">
                   <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm hover:bg-amber-500/10 transition-colors p-4 rounded-2xl group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 rotate-12 transiton-transform group-hover:scale-[1.7]">
                       <Users size={64} className="text-amber-500" />
                     </div>
                     <div className="flex items-start gap-4">
                        <div className="bg-amber-500/20 p-2 rounded-lg text-amber-600">
                           <Users size={20} />
                        </div>
                        <div>
                           <p className="font-bold text-amber-700">Account Approvals</p>
                           <p className="text-xs font-medium text-amber-700/70 mt-1">
                              You have {stats.pendingApprovals} new library card applications waiting for validation.
                           </p>
                        </div>
                     </div>
                   </Card>
                 </Link>
              ) : (
                <div className="rounded-[2rem] border-2 border-dashed border-border/60 bg-muted/10 p-8 text-center flex flex-col items-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 text-emerald-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">All Clear</h3>
                  <p className="text-xs text-muted-foreground mt-1">No urgent issues or pending requests.</p>
                </div>
              )}
           </div>
        </div>

        {/* RIGHT COLUMN: RECENT ADDITIONS */}
        <div className="space-y-6 min-w-0 w-full overflow-hidden">
           <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                 <Zap className="h-3.5 w-3.5 text-primary" />
                 Recent Catalog Activity
              </h2>
              <Link href="/catalog" className="text-[10px] font-bold text-primary hover:tracking-widest transition-all">View All</Link>
           </div>

           <div className="grid gap-2">
              {stats.recentBooks.length > 0 ? (
                stats.recentBooks.slice(0, 5).map((book) => (
                  <Link key={book.id} href={`/catalog/${book.id}`}>
                    <Card className="border-border/60 bg-card/40 shadow-none transition-all hover:bg-muted/40 hover:border-primary/30 rounded-[1rem] group/item py-2 px-3 w-full min-w-0">
                      <CardContent className="flex items-center justify-between gap-4 p-0 w-full min-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded border border-border bg-muted/30 overflow-hidden relative group-hover/item:shadow-sm transition-transform">
                            {book.cover_url ? (
                              <Image src={book.cover_url} alt={book.title} fill sizes="40px" className="object-cover" unoptimized={book.cover_url.startsWith('http')} />
                            ) : (
                              <BookMarked size={14} className="text-muted-foreground/30" />
                            )}
                          </div>
                           <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-foreground group-hover/item:text-primary transition-colors">{book.title}</p>
                            <p className="truncate text-[11px] font-bold text-muted-foreground/60">{book.author}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="hidden sm:block text-right">
                            <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-tight">Added</p>
                            <p className="text-[11px] font-bold text-foreground/80" suppressHydrationWarning>
                               {new Date(book.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <ArrowUpRight size={16} className="text-muted-foreground/30 group-hover/item:text-primary group-hover/item:translate-x-1 group-hover/item:-translate-y-1 transition-all" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="rounded-[2rem] border border-dashed border-border p-10 text-center bg-muted/10">
                  <p className="text-xs font-bold text-muted-foreground uppercase opacity-40">The inventory is quiet.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
