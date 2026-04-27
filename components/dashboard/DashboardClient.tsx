'use client';

import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import Image from 'next/image';
import { Library, BookOpen, History, HelpCircle, ChevronDown, Bookmark, XCircle, Clock, Ticket, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { useTransition, useMemo, useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import dynamic from 'next/dynamic';
import { resolveStudentId, getDeterministicQrUrl } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
import { createClient } from '@/lib/supabase/client';
import { Reservation, ProfileData, Book, Category } from '@/lib/types';
import type { BorrowingRecord } from '@/lib/actions/history';
import { LiveActivityTicker } from './LiveActivityTicker';
import { DashboardSearch } from './DashboardSearch';

const ModernInventoryClient = dynamic(() => import('@/components/inventory/ModernInventoryClient').then(mod => mod.ModernInventoryClient), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full animate-pulse rounded-xl bg-muted" />
});

const MyCardContainer = dynamic(() => import('@/components/library/MyCardContainer'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted" />
});

type CardData = { card_number: string; status: string; expires_at: string } | null;
type FaqRow = { key: string; value: string | null };

type DashboardStats = {
  activeLoans: number;
  pendingApprovals: number;
  myActiveLoans: number;
  recentBooks: { id: string; title: string; author: string; cover_url: string | null; created_at: string }[];
  activeLoansList?: BorrowingRecord[];
};

interface DashboardProps {
  user: User;
  role: string | null;
  statsPromise: Promise<DashboardStats>;
  profilePromise: Promise<{ data: ProfileData | null }>;
  cardPromise: Promise<{ data: CardData }>;
  faqPromise: Promise<{ data: FaqRow[] | null }>;
  reservationsPromise: Promise<Reservation[]>;
  inventoryBooksPromise: Promise<{ data: Book[]; count: number }>;
  inventoryCategoriesPromise: Promise<Category[]>;
}

export function DashboardClient({ 
  user, 
  role, 
  statsPromise, 
  profilePromise, 
  cardPromise, 
  faqPromise, 
  reservationsPromise,
  inventoryBooksPromise,
  inventoryCategoriesPromise
}: DashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  // Unwrap promises using 'use' hook
  const stats = use(statsPromise);
  const profileResult = use(profilePromise);
  const cardResult = use(cardPromise);
  const faqResult = use(faqPromise);
  const reservations = use(reservationsPromise);
  const inventoryData = use(inventoryBooksPromise);
  const inventoryCategories = use(inventoryCategoriesPromise);

  const profileData = profileResult.data;
  const activeLoansList = stats.activeLoansList || [];

  // Real-time synchronization
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrowing_records' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_cards' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

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

      const expiresAt = studentCardData?.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();
      const expiryYear = new Date(expiresAt).getUTCFullYear();
      const ayString = `${expiryYear - 1} - ${expiryYear}`;

      card = {
        fullName: profileData.full_name || "Student",
        studentId: resolvedStudentId || profileData.student_id || "N/A",
        cardNumber: studentCardData?.card_number || "Pending assignment",
        department: profileData.department || "General",
        status: (studentCardData?.status as "active" | "pending" | "suspended" | "expired") || "pending",
        expiryDate: expiresAt,
        academicYear: ayString,
        avatarUrl: profileData.avatar_url,
        qrUrl: resolvedStudentId ? getDeterministicQrUrl(resolvedStudentId) : null,
        address: profileData.address || undefined,
        phone: profileData.phone || undefined,
      };

      if (faqRows && faqRows.length > 0) {
        const listRow = faqRows.find(row => row.key === "student_faq_list");
        if (listRow?.value) {
          try {
            faqs = JSON.parse(listRow.value);
          } catch (e) {
            console.error("Failed to parse FAQs", e);
          }
        }
      }
    }
    return { studentCard: card, studentFaqs: faqs };
  }, [role, profileData, cardResult, faqResult, user]);

  const handleCancelReservation = (id: string, title: string) => {
    startTransition(async () => {
      try {
        const res = await cancelReservation(id);
        if (res.success) {
          toast.success(`Reservation for "${title}" cancelled.`);
          router.refresh();
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Cancellation failed");
      }
    });
  };

  const isStudent = role === 'student';

  if (isStudent) {
    return (
      <div className="space-y-6 pb-14 overflow-x-hidden relative">
        <LiveActivityTicker />
        <section className="grid gap-6 md:grid-cols-12 items-start">
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

          <div className="md:col-span-4 space-y-5">
            {stats.myActiveLoans > 0 && (
              <Card className="border-border/40 bg-card/20 shadow-none p-4 backdrop-blur-sm">
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

        <div className="grid gap-6 md:grid-cols-2">
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
                     <Card key={loan.id} className="border-border/40 bg-card/20 shadow-none transition-all hover:bg-muted/30 hover:border-primary/20 backdrop-blur-sm">
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
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
              <Ticket className="h-3 w-3" />
              My Reservations & Holds
            </h2>
            {reservations.length > 0 && (
              <span className="text-[9px] font-bold text-muted-foreground/60">
                {reservations.length} active
              </span>
            )}
          </div>

          {reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/10 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-muted/20">
                <Bookmark className="h-5 w-5 text-muted-foreground/20" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground/50">No active reservations</p>
                <p className="mt-0.5 text-xs text-muted-foreground/40">Reserve a book from the catalog and it will appear here.</p>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-1 h-8 px-4 text-xs rounded-xl">
                <Link href="/student-catalog">
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Browse Catalog
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reservations.map((res) => {
                const isReady = res.status === 'READY';
                const deadline = res.hold_expires_at
                  ? new Date(res.hold_expires_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                  : null;

                return (
                  <Card key={res.id} className={`relative overflow-hidden border shadow-none transition-all ${isReady ? 'border-emerald-300/40 bg-gradient-to-br from-emerald-50/40 to-transparent' : 'border-border/40 bg-card/20 backdrop-blur-sm'}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isReady ? 'bg-emerald-500' : 'bg-primary/30'}`} />
                    <CardContent className="pl-4 pr-3 py-3 flex gap-3 items-start">
                      <Link href={`/student-catalog/${res.books?.id ?? ''}`} className="shrink-0 group">
                        <div className="relative h-14 w-10 rounded-lg border border-border/60 bg-muted/20 overflow-hidden shadow-sm">
                          {res.books?.cover_url ? (
                            <Image src={res.books.cover_url} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Library size={14} className="text-muted-foreground/20" />
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/student-catalog/${res.books?.id ?? ''}`}>
                          <p className="truncate text-xs font-black text-foreground/90 leading-snug">
                            {res.books?.title || 'Unknown Book'}
                          </p>
                        </Link>
                        {isReady ? (
                          <div className="mt-1 space-y-0.5 text-emerald-600 font-bold text-[10px]">
                            <p className="flex items-center gap-1"><Sparkles size={12} /> Ready for Pickup!</p>
                            {deadline && <p>Claim by {deadline}</p>}
                          </div>
                        ) : (
                          <p className="mt-1 text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                            <Clock size={12} /> Queue position #{res.queue_position}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge variant={isReady ? 'default' : 'outline'} className={`text-[9px] px-1.5 py-0 h-5 ${isReady ? 'bg-emerald-500' : ''}`}>
                          {isReady ? 'READY' : 'IN QUEUE'}
                        </Badge>
                        <button onClick={() => handleCancelReservation(res.id, res.books?.title || 'Unknown Book')} disabled={isPending} className="text-[9px] font-bold text-muted-foreground/50 hover:text-destructive flex items-center gap-1 disabled:opacity-30">
                          <XCircle size={14} /> Cancel
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>



        {studentFaqs?.length > 0 && (
          <section className="pt-2">
            <Collapsible className="bg-card/20 border border-border/40 rounded-xl overflow-hidden shadow-none backdrop-blur-sm">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/30 transition-colors text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                <div className="flex items-center gap-2"><HelpCircle size={14} className="text-primary" /> Support & FAQs</div>
                <ChevronDown size={14} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-2 border-t border-border/20 pt-3">
                {studentFaqs.map((faq, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-xs font-bold text-foreground/90">{faq.question}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{faq.answer}</p>
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
    <div className="w-full relative min-h-[600px]">
      <div className="flex items-center justify-between px-1 mb-4">
        <div className="w-full max-w-md">
          <DashboardSearch role={role || null} />
        </div>
      </div>

      <div className="w-full">
        <ModernInventoryClient 
          books={inventoryData.data || []} 
          totalItems={inventoryData.count || 0} 
          categories={inventoryCategories}
        />
      </div>
    </div>
  );
}
