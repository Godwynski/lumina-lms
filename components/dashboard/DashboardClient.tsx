'use client';

import type { User } from '@supabase/supabase-js';
import { 
  Library, 
  Users, 
  ScrollText, 
  Settings, 
  RefreshCw, 
  BookOpen, 
  UserCheck, 
  History, 
  BarChart3, 
  AlertTriangle, 
  ArrowRight, 
  BookMarked, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { useTransition, useMemo, useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { resolveStudentId, getDeterministicQrUrl } from "@/lib/library-card-assets";
import { DEFAULT_STUDENT_FAQS } from "@/lib/actions/policy-constants";
import { createClient } from '@/lib/supabase/client';
import { Reservation, ProfileData, Book, Category } from '@/lib/types';
import type { BorrowingRecord } from '@/lib/actions/history';

import { LiveActivityTicker } from './LiveActivityTicker';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
import { ActivitySection } from './ActivitySection';
import { SupportSection } from './SupportSection';

const MyCardContainer = dynamic(() => import('@/components/library/MyCardContainer'), {
  ssr: false,
  loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted" />
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
  preferredView?: string;
  activeAttendance?: { id: string; check_in_at: string } | null;
  attendanceLogs: { id: string; check_in_at: string; check_out_at: string | null }[];
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
  activeAttendance,
  attendanceLogs
}: DashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 500);
  }, [router]);
  
  // Unwrap promises using 'use' hook
  const stats = use(statsPromise);
  const profileResult = use(profilePromise);
  const cardResult = use(cardPromise);
  const faqResult = use(faqPromise);
  const reservations = use(reservationsPromise);
  const inventoryData = use(inventoryBooksPromise);
  use(inventoryCategoriesPromise);
  
  const profileData = profileResult.data;
  const activeBorrowsList = useMemo(() => stats.activeBorrowsList || [], [stats.activeBorrowsList]);

  useEffect(() => {
    // Unique channel name to avoid collisions
    const channelName = `dashboard-${user.id}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      // Student-specific data with filters for efficiency
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'borrowing_records',
        filter: `user_id=eq.${user.id}`
      }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reservations',
        filter: `user_id=eq.${user.id}`
      }, () => {
        debouncedRefresh();
      })
      // General data that affects the dashboard
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_cards' }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance',
        filter: `user_id=eq.${user.id}`
      }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        debouncedRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase, debouncedRefresh, user.id]);

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
        role: role,
      });

      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const startYear = now.getUTCMonth() >= 5 ? currentYear : currentYear - 1;
      const ayString = `${startYear} - ${startYear + 1}`;
      
      const expiresAt = studentCardData?.expires_at || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

      card = {
        fullName: profileData.full_name || "Student",
        studentId: resolvedStudentId || profileData.student_id || "N/A",
        cardNumber: studentCardData?.card_number || "Pending assignment",
        department: profileData.department || "General",
        status: ((studentCardData?.status?.toLowerCase() || profileData.status?.toLowerCase()) as "active" | "pending" | "suspended" | "expired") || "pending",
        expiryDate: expiresAt,
        academicYear: ayString,
        avatarUrl: profileData.avatar_url,
        qrUrl: resolvedStudentId ? getDeterministicQrUrl(resolvedStudentId) : null,
        address: profileData.address || undefined,
        phone: profileData.phone || undefined,
        roleLabel: role ? role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "Student",
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
  }, [profileData, cardResult, faqResult, user, role]);

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
    const resBook = reservations.find(r => r.books?.id === selectedBookId)?.books;
    if (resBook) return resBook as Book;
    const borrowBook = activeBorrowsList.find(b => b.books?.id === selectedBookId)?.books;
    if (borrowBook) return borrowBook as Book;
    return inventoryData.data?.find(b => b.id === selectedBookId);
  }, [selectedBookId, reservations, activeBorrowsList, inventoryData.data]);

  // Determine current mode centrally
  const isDeactivatedSA = role === "student_assistant" && profileData?.status?.toUpperCase() !== "ACTIVE";
  const hasAnyPermission = role === "student_assistant"
    ? !!(profileData?.permissions?.manage_circulation || profileData?.permissions?.manage_attendance || profileData?.permissions?.view_admin_dashboard)
    : true;

  const currentMode: "staff" | "student" = (isDeactivatedSA || (role === "student_assistant" && !hasAnyPermission))
    ? "student" 
    : (role === "admin" || role === "librarian" || role === "student_assistant")
      ? "staff"
      : "student";

  // CASE 1: ADMINISTRATOR VIEW
  if (role === "super_admin") {
    return (
      <div className="space-y-6 pb-14 overflow-x-hidden relative">
        <LiveActivityTicker />

        {/* Flat Minimalist Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            role="button"
            onClick={() => router.push('/attendance')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <UserCheck size={12} className="text-primary" /> Today&apos;s Visitors
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.attendanceToday}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/users')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <Users size={12} className="text-primary" /> Total Users
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.totalUsers}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/inventory')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <BookMarked size={12} className="text-primary" /> Catalog Assets
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.totalBooks}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/circulation')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <RefreshCw size={12} className="text-primary" /> Active Loans
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.activeBorrows}
            </div>
          </Card>
        </section>

        {/* Quick Launch Panel */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
            System Shortcuts
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card 
              role="button"
              onClick={() => router.push('/users')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-primary/10 text-primary">
                <Users size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">User Directory</p>
                <p className="text-[9px] text-muted-foreground truncate">Manage student profiles</p>
              </div>
            </Card>

            <Card 
              role="button"
              onClick={() => router.push('/audit')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-amber-500/10 text-amber-600">
                <ScrollText size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">Audit Logs</p>
                <p className="text-[9px] text-muted-foreground truncate">Track changes & security</p>
              </div>
            </Card>

            <Card 
              role="button"
              onClick={() => router.push('/policies')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-green-500/10 text-green-600">
                <Settings size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">Settings & Policies</p>
                <p className="text-[9px] text-muted-foreground truncate">Adjust parameters & rules</p>
              </div>
            </Card>

            <Card 
              role="button"
              onClick={() => router.push('/analytics')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-blue-500/10 text-blue-600">
                <BarChart3 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">System Analytics</p>
                <p className="text-[9px] text-muted-foreground truncate">View usage statistics</p>
              </div>
            </Card>
          </div>
        </section>

        {/* Recently Cataloged Books */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <BookMarked size={12} className="text-primary" /> Recently Cataloged Books
            </h2>
          </div>
          <div className="border border-border/10 bg-card/5 rounded-xl p-3">
            {stats.recentBooks.length === 0 ? (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4 text-center">No recent additions</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {stats.recentBooks.map((book) => (
                  <Card 
                    key={book.id}
                    role="button"
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setModalOpen(true);
                    }}
                    className="border border-border/10 bg-card/5 shadow-none transition-all hover:bg-muted/10 hover:border-primary/10 cursor-pointer group flex items-center gap-3 p-2 rounded-xl"
                  >
                    <div className="relative h-10 w-7 shrink-0 rounded bg-muted/20 overflow-hidden shadow-sm ring-1 ring-border/5 group-hover:ring-primary/20 transition-all">
                      <Image 
                        src={book.cover_url || "/images/default-book-cover.png"} 
                        alt="" 
                        fill 
                        className="object-cover" 
                        unoptimized 
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors">
                        {book.title}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {book.author}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

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

  // CASE 2: LIBRARIAN VIEW
  if (role === "librarian") {
    return (
      <div className="space-y-6 pb-14 overflow-x-hidden relative">
        <LiveActivityTicker />

        {/* Card approvals warning banner */}
        {stats.pendingApprovals > 0 && (
          <div 
            role="button"
            onClick={() => router.push('/users')}
            className="flex items-center justify-between p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-700 uppercase tracking-widest">
              <AlertTriangle size={14} className="text-amber-600 animate-pulse" />
              {stats.pendingApprovals} Pending Card Applications Need Review
            </div>
            <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1">
              Approve Cards <ArrowRight size={10} />
            </span>
          </div>
        )}

        {/* Flat Minimalist Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            role="button"
            onClick={() => router.push('/circulation')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <RefreshCw size={12} className="text-primary" /> Active Loans
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.activeBorrows}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/users')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-primary" /> Pending Cards
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.pendingApprovals}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/attendance')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <UserCheck size={12} className="text-primary" /> Today&apos;s Visitors
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.attendanceToday}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/inventory')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <BookMarked size={12} className="text-primary" /> Catalog Books
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.totalBooks}
            </div>
          </Card>
        </section>

        {/* Quick Launch Panel */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
            Librarian Tools
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card 
              role="button"
              onClick={() => router.push('/circulation')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-primary/10 text-primary">
                <RefreshCw size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">Circulation Desk</p>
                <p className="text-[9px] text-muted-foreground truncate">Checkout & return books</p>
              </div>
            </Card>

            <Card 
              role="button"
              onClick={() => router.push('/inventory')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-amber-500/10 text-amber-600">
                <BookMarked size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">Catalog Assets</p>
                <p className="text-[9px] text-muted-foreground truncate">Manage book collections</p>
              </div>
            </Card>

            <Card 
              role="button"
              onClick={() => router.push('/users')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-green-500/10 text-green-600">
                <Users size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">User Directory</p>
                <p className="text-[9px] text-muted-foreground truncate">Approve cards & students</p>
              </div>
            </Card>

            <Card 
              role="button"
              onClick={() => router.push('/policies')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-blue-500/10 text-blue-600">
                <Settings size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">Settings & Policies</p>
                <p className="text-[9px] text-muted-foreground truncate">Configure rules & terms</p>
              </div>
            </Card>
          </div>
        </section>

        {/* Recently Cataloged Books */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <BookMarked size={12} className="text-primary" /> Recently Cataloged Books
            </h2>
          </div>
          <div className="border border-border/10 bg-card/5 rounded-xl p-3">
            {stats.recentBooks.length === 0 ? (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4 text-center">No recent additions</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {stats.recentBooks.map((book) => (
                  <Card 
                    key={book.id}
                    role="button"
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setModalOpen(true);
                    }}
                    className="border border-border/10 bg-card/5 shadow-none transition-all hover:bg-muted/10 hover:border-primary/10 cursor-pointer group flex items-center gap-3 p-2 rounded-xl"
                  >
                    <div className="relative h-10 w-7 shrink-0 rounded bg-muted/20 overflow-hidden shadow-sm ring-1 ring-border/5 group-hover:ring-primary/20 transition-all">
                      <Image 
                        src={book.cover_url || "/images/default-book-cover.png"} 
                        alt="" 
                        fill 
                        className="object-cover" 
                        unoptimized 
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors">
                        {book.title}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {book.author}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

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

  // CASE 3: ACTIVE STUDENT ASSISTANT VIEW
  if (currentMode === "staff" && role === "student_assistant") {
    const hasCirculationPerm = !!profileData?.permissions?.manage_circulation;
    const hasAttendancePerm = !!profileData?.permissions?.manage_attendance;

    return (
      <div className="space-y-6 pb-14 overflow-x-hidden relative">
        <LiveActivityTicker />

        {/* Collapsible Digital Library Card */}
        <section className="border border-border/10 bg-card/5 rounded-xl overflow-hidden">
          <button 
            onClick={() => setCardExpanded(!cardExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/5 transition-all text-left"
          >
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
              <Library size={12} className="text-primary" /> My Digital Library Card
            </div>
            {cardExpanded ? <ChevronUp size={14} className="text-muted-foreground/80" /> : <ChevronDown size={14} className="text-muted-foreground/80" />}
          </button>
          {cardExpanded && (
            <div className="p-4 border-t border-border/10 bg-gradient-to-br from-primary/5 via-background to-primary/5">
              {studentCard ? (
                <div className="space-y-4">
                  <MyCardContainer initialData={studentCard} variant="dashboard" />
                  {activeAttendance && (
                    <div className="flex items-center justify-between px-2 py-2 bg-green-500/10 rounded-xl border border-green-500/20 animate-in fade-in slide-in-from-top-2 duration-500">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Currently Timed In</span>
                      </div>
                      <span className="text-[10px] font-medium text-green-600/70">
                        Since {new Date(activeAttendance.check_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-center py-6">Digital card not found</p>
              )}
            </div>
          )}
        </section>

        {/* Active Timed In Alert (if collapsed but timed in) */}
        {!cardExpanded && activeAttendance && (
          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-xl border border-green-500/20">
            <div className="flex items-center gap-2 text-[10px] font-bold text-green-700 uppercase tracking-widest">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Active Check-In Session
            </div>
            <span className="text-[9px] font-bold text-green-600/70">
              Started {new Date(activeAttendance.check_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          </div>
        )}

        {/* Flat Minimalist Stats Grid */}
        <section className="grid grid-cols-2 gap-4">
          <Card 
            role="button"
            onClick={() => {
              if (hasAttendancePerm) router.push('/attendance');
            }}
            className={`border border-border/10 bg-card/5 shadow-none p-4 flex flex-col justify-between rounded-xl ${hasAttendancePerm ? 'hover:bg-muted/10 transition-all cursor-pointer' : ''}`}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <UserCheck size={12} className="text-primary" /> Today&apos;s Visitors
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.attendanceToday}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/history')}
            className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex flex-col justify-between rounded-xl"
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
              <History size={12} className="text-primary" /> My Active Borrows
            </div>
            <div className="text-2xl font-black text-foreground/90 mt-2">
              {stats.myActiveBorrows}
            </div>
          </Card>
        </section>

        {/* Quick Launch Panel */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
            Assistant Desk Shortcuts
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {hasCirculationPerm && (
              <Card 
                role="button"
                onClick={() => router.push('/circulation')}
                className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
              >
                <div className="p-2 rounded bg-primary/10 text-primary">
                  <RefreshCw size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground/90 truncate">Circulation Desk</p>
                  <p className="text-[9px] text-muted-foreground truncate">Checkout/Return actions</p>
                </div>
              </Card>
            )}

            {hasAttendancePerm && (
              <Card 
                role="button"
                onClick={() => router.push('/attendance')}
                className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
              >
                <div className="p-2 rounded bg-green-500/10 text-green-600">
                  <UserCheck size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground/90 truncate">Attendance Logs</p>
                  <p className="text-[9px] text-muted-foreground truncate">Scanner & visitor logs</p>
                </div>
              </Card>
            )}

            <Card 
              role="button"
              onClick={() => router.push('/student-catalog')}
              className="border border-border/10 bg-card/5 shadow-none hover:bg-muted/10 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl"
            >
              <div className="p-2 rounded bg-blue-500/10 text-blue-600">
                <BookOpen size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground/90 truncate">Book Catalog</p>
                <p className="text-[9px] text-muted-foreground truncate">Search & explore books</p>
              </div>
            </Card>
          </div>
        </section>

        {/* Personal Activity Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
            My Personal Activity
          </h2>
          <ActivitySection 
            activeBorrows={activeBorrowsList}
            reservations={reservations}
            attendanceLogs={attendanceLogs}
            onOpenBook={(id) => {
              setSelectedBookId(id);
              setModalOpen(true);
            }}
            onCancelReservation={handleCancelReservation}
            isPending={isPending}
            mounted={mounted}
          />
        </section>

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

  // CASE 4: REGULAR STUDENT / DEACTIVATED STUDENT ASSISTANT VIEW
  return (
    <div className="space-y-6 pb-14 overflow-x-hidden relative">
      <LiveActivityTicker />

      {/* Hero Section: Library Card */}
      <section className="grid gap-6 items-start">
        <Card className="border-none bg-gradient-to-br from-primary/10 via-background to-primary/5 shadow-none overflow-hidden relative p-5 sm:p-7">
          {studentCard ? (
            <div className="space-y-4">
              <MyCardContainer initialData={studentCard} variant="dashboard" />
              {activeAttendance && (
                <div className="flex items-center justify-between px-2 py-2 bg-green-500/10 rounded-xl border border-green-500/20 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Currently Timed In</span>
                  </div>
                  <span className="text-[10px] font-medium text-green-600/70">
                    Since {new Date(activeAttendance.check_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Library size={42} className="text-muted-foreground/20 mb-3" />
              <h2 className="text-lg font-bold text-muted-foreground/40">No Digital Card Available</h2>
              <p className="text-xs text-muted-foreground/40 mt-1">Please contact the librarian if you believe this is an error.</p>
            </div>
          )}
        </Card>
      </section>

      {/* Main Content Area: Personal Activity */}
      <ActivitySection 
        activeBorrows={activeBorrowsList}
        reservations={reservations}
        attendanceLogs={attendanceLogs}
        onOpenBook={(id) => {
          setSelectedBookId(id);
          setModalOpen(true);
        }}
        onCancelReservation={handleCancelReservation}
        isPending={isPending}
        mounted={mounted}
      />

      {/* Support Section */}
      <SupportSection faqs={studentFaqs} />

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
