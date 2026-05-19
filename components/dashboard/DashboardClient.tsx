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
  BarChart3, 
  AlertTriangle, 
  ArrowRight, 
  BookMarked
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
  overdueBorrows: number;
  readyHolds: number;
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

  const hasAnyPermission = role === "student_assistant"
    ? !!(profileData?.permissions?.manage_circulation || profileData?.permissions?.manage_attendance || profileData?.permissions?.view_admin_dashboard)
    : true;

  // =========================================================================
  // VIEW 1: UNIFIED STAFF DASHBOARD (ADMINISTRATORS & LIBRARIANS)
  // =========================================================================
  if (role === "super_admin" || role === "librarian") {
    const isOverdue = stats.overdueBorrows > 0;
    const isPendingApprovals = stats.pendingApprovals > 0;
    const isReadyHolds = stats.readyHolds > 0;
    const hasActions = isOverdue || isPendingApprovals || isReadyHolds;

    // Filter quick shortcuts dynamically based on role
    const quickShortcuts = [
      {
        title: "Circulation Desk",
        desc: "Checkout & return books",
        path: "/circulation",
        icon: RefreshCw,
        color: "group-hover:border-primary/30",
        iconBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        show: true,
      },
      {
        title: "Book Inventory",
        desc: "Manage book collections",
        path: "/inventory",
        icon: BookMarked,
        color: "group-hover:border-purple-500/30",
        iconBg: "bg-purple-500/10 text-purple-600 group-hover:bg-purple-500 group-hover:text-white",
        show: true,
      },
      {
        title: "User Directory",
        desc: "Approve cards & profiles",
        path: "/users",
        icon: Users,
        color: "group-hover:border-green-500/30",
        iconBg: "bg-green-500/10 text-green-600 group-hover:bg-green-500 group-hover:text-white",
        show: true,
      },
      {
        title: "Visitor Logs",
        desc: "Track library attendance",
        path: "/attendance",
        icon: UserCheck,
        color: "group-hover:border-amber-500/30",
        iconBg: "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
        show: true,
      },
      {
        title: "System Analytics",
        desc: "View usage statistics",
        path: "/analytics",
        icon: BarChart3,
        color: "group-hover:border-blue-500/30",
        iconBg: "bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white",
        show: true,
      },
      {
        title: "Audit Trail",
        desc: "Track database changes",
        path: "/audit",
        icon: ScrollText,
        color: "group-hover:border-red-500/30",
        iconBg: "bg-red-500/10 text-red-600 group-hover:bg-red-500 group-hover:text-white",
        show: role === 'super_admin',
      },
      {
        title: "Settings & Policies",
        desc: "Adjust system parameters",
        path: "/policies",
        icon: Settings,
        color: "group-hover:border-indigo-500/30",
        iconBg: "bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white",
        show: role === 'super_admin',
      },
    ].filter(item => item.show);

    return (
      <div className="space-y-6 pb-14 overflow-x-hidden relative">
        <LiveActivityTicker />

        {/* ==================== ACTION CENTER ==================== */}
        <section className="space-y-3">
          <div className="border border-border/20 bg-card/30 backdrop-blur-sm rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/10 pb-3">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${hasActions ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Action Center</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 font-medium">Pending Administrative Tasks</span>
            </div>

            {!hasActions ? (
              <div className="flex items-center gap-3 p-4 bg-primary/[0.03] rounded-xl border border-border/20">
                <div className="p-1.5 rounded-full bg-green-500/10 text-green-600 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground/80">
                  All caught up. No pending administrative actions.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {isPendingApprovals && (
                  <Card 
                    role="button"
                    onClick={() => router.push('/users')}
                    className="group border border-amber-500/20 bg-amber-500/[0.03] hover:bg-amber-500/10 hover:border-amber-500/35 transition-all cursor-pointer p-4 flex items-center justify-between rounded-xl shadow-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform shrink-0">
                        <Users size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-amber-900 truncate">Card Applications</p>
                        <p className="text-[10px] text-amber-600/90 mt-0.5 font-bold truncate">{stats.pendingApprovals} pending review</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                  </Card>
                )}

                {isOverdue && (
                  <Card 
                    role="button"
                    onClick={() => router.push('/circulation')}
                    className="group border border-red-500/20 bg-red-500/[0.03] hover:bg-red-500/10 hover:border-red-500/35 transition-all cursor-pointer p-4 flex items-center justify-between rounded-xl shadow-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-red-500/10 text-red-600 group-hover:scale-105 transition-transform shrink-0">
                        <AlertTriangle size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-red-900 truncate">Overdue Loans</p>
                        <p className="text-[10px] text-red-600/90 mt-0.5 font-bold truncate">{stats.overdueBorrows} books outstanding</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-red-500 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                  </Card>
                )}

                {isReadyHolds && (
                  <Card 
                    role="button"
                    onClick={() => router.push('/circulation')}
                    className="group border border-blue-500/20 bg-blue-500/[0.03] hover:bg-blue-500/10 hover:border-blue-500/35 transition-all cursor-pointer p-4 flex items-center justify-between rounded-xl shadow-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:scale-105 transition-transform shrink-0">
                        <BookMarked size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-blue-900 truncate">Holds Ready</p>
                        <p className="text-[10px] text-blue-600/90 mt-0.5 font-bold truncate">{stats.readyHolds} waiting for pickup</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-blue-500 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                  </Card>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ==================== SYSTEM METRICS GRID ==================== */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            role="button"
            onClick={() => router.push('/attendance')}
            className="border border-border/20 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer p-5 flex flex-col justify-between rounded-xl group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 group-hover:text-foreground transition-colors">
                Today&apos;s Visitors
              </div>
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <UserCheck size={16} />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tight">
              {stats.attendanceToday}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/circulation')}
            className="border border-border/20 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer p-5 flex flex-col justify-between rounded-xl group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 group-hover:text-foreground transition-colors">
                Active Loans
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:scale-105 transition-transform">
                <RefreshCw size={16} />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tight">
              {stats.activeBorrows}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/inventory')}
            className="border border-border/20 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer p-5 flex flex-col justify-between rounded-xl group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 group-hover:text-foreground transition-colors">
                Book Catalog
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 group-hover:scale-105 transition-transform">
                <BookMarked size={16} />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tight">
              {stats.totalBooks}
            </div>
          </Card>

          <Card 
            role="button"
            onClick={() => router.push('/users')}
            className="border border-border/20 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer p-5 flex flex-col justify-between rounded-xl group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 group-hover:text-foreground transition-colors">
                User Profiles
              </div>
              <div className="p-2 rounded-lg bg-green-500/10 text-green-600 group-hover:scale-105 transition-transform">
                <Users size={16} />
              </div>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tight">
              {stats.totalUsers}
            </div>
          </Card>
        </section>

        {/* ==================== SYSTEM SHORTCUTS GRID ==================== */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickShortcuts.map((shortcut) => (
            <Card 
              key={shortcut.path}
              role="button"
              onClick={() => router.push(shortcut.path)}
              className={`group border border-border/20 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all cursor-pointer p-4 flex items-center gap-4 rounded-xl ${shortcut.color}`}
            >
              <div className={`p-2.5 rounded-lg transition-all duration-300 shrink-0 ${shortcut.iconBg}`}>
                <shortcut.icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground/90 truncate">{shortcut.title}</p>
                <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">{shortcut.desc}</p>
              </div>
            </Card>
          ))}
        </section>

        {/* ==================== RECENTLY CATALOGED BOOKS ==================== */}
        <section className="space-y-3">
          <div className="border border-border/20 bg-card/30 backdrop-blur-sm rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-border/10 pb-3 mb-4">
              <BookOpen size={12} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Recently Cataloged Books</span>
            </div>
            {stats.recentBooks.length === 0 ? (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest py-4 text-center">No recent additions</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {stats.recentBooks.map((book) => (
                  <Card 
                    key={book.id}
                    role="button"
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setModalOpen(true);
                    }}
                    className="group relative overflow-hidden border border-border/20 bg-card hover:bg-muted/[0.03] shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer flex items-center gap-3 p-3 rounded-xl"
                  >
                    <div className="relative h-12 w-9 shrink-0 rounded bg-muted/20 overflow-hidden ring-1 ring-border/10 group-hover:ring-primary/25 transition-all shadow-sm">
                      <Image 
                        src={book.cover_url || "/images/default-book-cover.png"} 
                        alt="" 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-300" 
                        unoptimized 
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-foreground/95 group-hover:text-primary transition-colors">
                        {book.title}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground/80 mt-0.5">
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

  // =========================================================================
  // VIEW 2: UNIFIED STUDENT DASHBOARD (STUDENT & ACTIVE STUDENT ASSISTANTS)
  // =========================================================================
  const isAssistant = role === "student_assistant" && profileData?.status?.toUpperCase() === "ACTIVE" && hasAnyPermission;
  const hasCirculationPerm = !!profileData?.permissions?.manage_circulation;
  const hasAttendancePerm = !!profileData?.permissions?.manage_attendance;

  return (
    <div className="space-y-6 pb-14 overflow-x-hidden relative">
      <LiveActivityTicker />

      {/* ==================== LIBRARY CARD CONTAINER ==================== */}
      <section className="grid gap-6 items-start">
        <Card className="border border-border/20 bg-card/30 backdrop-blur-sm shadow-sm overflow-hidden relative p-5 sm:p-7 rounded-xl">
          {studentCard ? (
            <div className="space-y-4">
              <MyCardContainer initialData={studentCard} variant="dashboard" />
              {activeAttendance && (
                <div className="flex items-center justify-between px-3 py-2.5 bg-green-500/[0.03] rounded-xl border border-green-500/20 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Currently Timed In</span>
                  </div>
                  <span className="text-[10px] font-bold text-green-600/80">
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

      {/* ==================== ASSISTANT DESK TOOLBAR (SA ONLY) ==================== */}
      {isAssistant && (
        <section className="space-y-3">
          <div className="border border-border/20 bg-card/30 backdrop-blur-sm rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-border/10 pb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Assistant Desk Shortcuts</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {hasCirculationPerm && (
                <Card 
                  role="button"
                  onClick={() => router.push('/circulation')}
                  className="group border border-border/20 bg-card hover:bg-muted/[0.03] hover:border-primary/20 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl shadow-none"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform shrink-0">
                    <RefreshCw size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground/90 truncate">Circulation Desk</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Checkout & return books</p>
                  </div>
                </Card>
              )}

              {hasAttendancePerm && (
                <Card 
                  role="button"
                  onClick={() => router.push('/attendance')}
                  className="group border border-border/20 bg-card hover:bg-muted/[0.03] hover:border-green-500/20 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl shadow-none"
                >
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-600 group-hover:scale-105 transition-transform shrink-0">
                    <UserCheck size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground/90 truncate">Attendance Logs</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Scanner & visitor logs</p>
                  </div>
                </Card>
              )}

              <Card 
                role="button"
                onClick={() => router.push('/student-catalog')}
                className="group border border-border/20 bg-card hover:bg-muted/[0.03] hover:border-blue-500/20 transition-all cursor-pointer p-4 flex items-center gap-3 rounded-xl shadow-none"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:scale-105 transition-transform shrink-0">
                  <BookOpen size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground/90 truncate">Book Catalog</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Search & explore books</p>
                </div>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* ==================== PERSONAL ACTIVITY SECTION ==================== */}
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

      {/* ==================== SUPPORT SECTION (FAQS) ==================== */}
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
