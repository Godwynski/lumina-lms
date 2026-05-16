'use client';

import type { User } from '@supabase/supabase-js';
import { Library } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
import { ActivitySection } from './ActivitySection';
import { SupportSection } from './SupportSection';

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
  preferredView,
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
  const categories = use(inventoryCategoriesPromise);
  
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

  const normalizedRole = role?.trim().toLowerCase() as UserRole | null;
  const isActuallyStaff = normalizedRole === "admin" || normalizedRole === "librarian" || normalizedRole === "student_assistant";
  const isStaffMode = isActuallyStaff && preferredView !== "student";

  if (isStaffMode) {
    return (
      <div className="space-y-4 pb-14 overflow-x-hidden relative">
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

      {/* Hero Section: Library Card */}
      <section className="grid gap-6 items-start">
        <Card className="border-none bg-gradient-to-br from-primary/10 via-background to-primary/5 shadow-md overflow-hidden relative p-5 sm:p-7">
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
