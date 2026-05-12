'use client';

import type { User } from '@supabase/supabase-js';
import Image from 'next/image';
import { Library, BookOpen, History, HelpCircle, Bookmark, XCircle, Ticket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { useTransition, useMemo, useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import dynamic from 'next/dynamic';
import { resolveStudentId, getDeterministicQrUrl } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
import { createClient } from '@/lib/supabase/client';
import { Reservation, ProfileData, Book, Category, UserRole } from '@/lib/types';
import type { BorrowingRecord } from '@/lib/actions/history';
import { LiveActivityTicker } from './LiveActivityTicker';
import { DashboardSearch } from './DashboardSearch';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';



const MyCardContainer = dynamic(() => import('@/components/library/MyCardContainer'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted" />
});

const ModernInventoryClient = dynamic(() => import('@/components/inventory/ModernInventoryClient').then(mod => mod.ModernInventoryClient), {
  ssr: false,
  loading: () => <div className="w-full space-y-4 animate-pulse"><div className="h-16 w-full bg-muted rounded-xl" /><div className="h-64 w-full bg-muted rounded-xl" /></div>
});

type CardData = { card_number: string; status: string; expires_at: string } | null;
type FaqRow = { key: string; value: string | null };

type DashboardStats = {
  activeBorrows: number;
  pendingApprovals: number;
  myActiveBorrows: number;
  recentBooks: { id: string; title: string; author: string; cover_url: string | null; created_at: string }[];
  activeBorrowsList?: BorrowingRecord[];
  attendanceToday: number;
  totalBooks: number;
  totalUsers: number;
};

interface AttendanceLog {
  id: string;
  check_in_at: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
  };
}

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
  attendancePromise: Promise<{ data: AttendanceLog[] | null; error: Error | null }>;
  preferredView?: string;
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
  inventoryCategoriesPromise,
  attendancePromise,
  preferredView
}: DashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  const openBookModal = (id: string) => {
    setSelectedBookId(id);
    setModalOpen(true);
  };
  
  // Debounced router.refresh to prevent cascade re-renders
  // when multiple realtime subscriptions fire simultaneously
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 2000);
  }, [router]);
  
  // Unwrap promises using 'use' hook
  const stats = use(statsPromise);
  const profileResult = use(profilePromise);
  const cardResult = use(cardPromise);
  const faqResult = use(faqPromise);
  const reservations = use(reservationsPromise);
  const inventoryData = use(inventoryBooksPromise);
  const categories = use(inventoryCategoriesPromise);
  const attendanceData = use(attendancePromise);

  const profileData = profileResult.data;
  const activeBorrowsList = useMemo(() => stats.activeBorrowsList || [], [stats.activeBorrowsList]);

  // Real-time synchronization — uses debounced refresh to batch
  // concurrent changes from multiple table subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrowing_records' }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_cards' }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        debouncedRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase, debouncedRefresh]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { studentCard, studentFaqs } = useMemo(() => {
    let card = null;
    let faqs = [...DEFAULT_STUDENT_FAQS];

    if (profileData) {
      const studentCardData = cardResult.data;
      const faqRows = faqResult.data;


      const resolvedStudentId = resolveStudentId({
        studentId: profileData.student_id,
        fallbackEmail: user.email,
        userId: user.id,
      });

      const now = new Date();
      const currentYear = now.getUTCFullYear();
      // If it's June or later, we're in the next academic year (e.g., 2026-2027)
      // Otherwise, we're still in the previous one (e.g., 2025-2026)
      const startYear = now.getUTCMonth() >= 5 ? currentYear : currentYear - 1;
      const ayString = `${startYear} - ${startYear + 1}`;
      
      const expiresAt = studentCardData?.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

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
  }, [profileData, cardResult, faqResult, user]);

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



  const initialData = useMemo(() => {
    if (!selectedBookId) return undefined;
    // Check reservations first
    const resBook = reservations.find(r => r.books?.id === selectedBookId)?.books;
    if (resBook) return resBook as Book;
    // Then borrows
    const borrowBook = activeBorrowsList.find(b => b.books?.id === selectedBookId)?.books;
    if (borrowBook) return borrowBook as Book;
    // Then inventory
    return inventoryData.data?.find(b => b.id === selectedBookId);
  }, [selectedBookId, reservations, activeBorrowsList, inventoryData.data]);
  const normalizedRole = role?.trim().toLowerCase() as UserRole | null;
  const isActuallyStaff = normalizedRole === "admin" || normalizedRole === "librarian";
  const isStaffMode = isActuallyStaff && preferredView !== "student";

  if (isStaffMode) {
    return (
      <div className="space-y-3 pb-14 overflow-x-hidden relative">
        <LiveActivityTicker />
        <ModernInventoryClient 
          books={inventoryData?.data || []} 
          totalItems={inventoryData?.count || 0} 
          categories={categories || []}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-14 overflow-x-hidden relative">
      <LiveActivityTicker />



      {/* Hero Section: Library Card & Quick Stats */}
      <section className="grid gap-6 items-start">
        <Card className="border-none bg-gradient-to-br from-primary/10 via-background to-primary/5 shadow-md overflow-hidden relative p-5 sm:p-7">
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

        <div className="grid gap-4 sm:grid-cols-2">
          {stats.myActiveBorrows > 0 && (
            <Card className="border-border/20 bg-card/20 shadow-none p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">My Borrowed Books</p>
                  <p className="text-2xl font-black text-primary">{stats.myActiveBorrows}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <History size={18} />
                </div>
              </div>
            </Card>
          )}

          {attendanceData?.data && attendanceData.data.length > 0 && (
            <Card className="border-border/20 bg-card/20 shadow-none p-4 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">My Recent Attendance</p>
              <div className="space-y-2">
                {attendanceData.data.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground/70">
                      {new Date(log.check_in_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(log.check_in_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Catalog Search - Premium Integration */}
      <div className="flex items-center justify-between px-1">
        <div className="w-full">
          <DashboardSearch role={role || null} />
        </div>
      </div>

      {/* Main Content Area: Personal Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Active Borrows */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-3 w-3 text-primary" />
              Current Loans
            </h2>
          </div>
          {activeBorrowsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/20 rounded-2xl bg-muted/5 opacity-50">
               <BookOpen size={24} className="mb-2" />
               <p className="text-[10px] font-bold uppercase tracking-widest">No active loans</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {activeBorrowsList.map((borrow) => (
                <Card 
                  key={borrow.id} 
                  role="button"
                  onClick={() => openBookModal(borrow.books?.id || '')}
                  className="border-border/20 bg-card/10 shadow-none transition-all hover:bg-muted/20 hover:border-primary/10 backdrop-blur-sm cursor-pointer group"
                >
                  <CardContent className="flex items-center justify-between gap-4 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md bg-muted/20 overflow-hidden relative shadow-sm ring-1 ring-border/5 group-hover:ring-primary/20 transition-all">
                        {borrow.books?.cover_url ? (
                          <Image src={borrow.books.cover_url} alt="" fill className="object-cover" unoptimized />
                        ) : (
                          <Library size={12} className="text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors">{borrow.books?.title || 'Unknown Book'}</p>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-tight" suppressHydrationWarning>
                          Due {mounted ? new Date(borrow.due_date).toLocaleDateString() : '...'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={borrow.status === 'OVERDUE' || (mounted && new Date(borrow.due_date) < new Date()) ? 'destructive' : 'outline'} className="text-[9px] px-1.5 py-0">
                      {borrow.status === 'OVERDUE' || (mounted && new Date(borrow.due_date) < new Date()) ? 'Overdue' : 'Active'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* My Reservations & Holds */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
              <Ticket className="h-3 w-3" />
              Reservations
            </h2>
          </div>

          {reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/20 rounded-2xl bg-muted/5 opacity-50">
              <Bookmark className="h-5 w-5 text-muted-foreground/20 mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest">No active reservations</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {reservations.map((res) => {
                const isReady = res.status === 'READY';
                return (
                  <Card key={res.id} className={`relative overflow-hidden border shadow-none transition-all ${isReady ? 'border-emerald-500/20 bg-emerald-50/5' : 'border-border/20 bg-card/10 backdrop-blur-sm'}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isReady ? 'bg-emerald-500' : 'bg-primary/30'}`} />
                    <CardContent className="pl-4 pr-3 py-3 flex gap-3 items-center">
                      <div 
                        role="button"
                        onClick={() => openBookModal(res.books?.id ?? '')}
                        className="shrink-0 group cursor-pointer"
                      >
                        <div className="relative h-10 w-7 rounded bg-muted/20 overflow-hidden shadow-sm ring-1 ring-border/10 group-hover:ring-primary/30 transition-all">
                          {res.books?.cover_url ? (
                            <Image src={res.books.cover_url} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Library size={12} className="text-muted-foreground/20" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-black text-foreground/90 leading-tight">
                          {res.books?.title || 'Unknown Book'}
                        </p>
                        <p className={`text-[9px] font-bold uppercase ${isReady ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {isReady ? 'Ready for Pickup' : `Queue Position #${res.queue_position}`}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button onClick={() => handleCancelReservation(res.id, res.books?.title || 'Unknown Book')} disabled={isPending} className="text-[9px] font-bold text-muted-foreground/50 hover:text-destructive flex items-center gap-1 disabled:opacity-30">
                          <XCircle size={12} /> Cancel
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Support Section */}
      {studentFaqs?.length > 0 && (
        <section className="pt-2">
          <div className="bg-card/10 border border-border/20 rounded-xl overflow-hidden shadow-none backdrop-blur-sm">
            <div className="flex items-center gap-2 p-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 border-b border-border/20">
              <HelpCircle size={14} className="text-primary" /> Support & FAQs
            </div>
            <div className="p-3 grid gap-4 md:grid-cols-2">
              {studentFaqs.map((faq, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-xs font-bold text-foreground/90">{faq.question}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <BookDetailModal
        bookId={selectedBookId || ''}
        open={modalOpen}
        onOpenChange={setModalOpen}
        variant="student"
        initialData={initialData}
      />
    </div>
  );
}
