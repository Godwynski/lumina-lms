'use server'

import { createSafeClient } from '@/lib/supabase/server';
import { getBorrowingHistory, type BorrowingRecord } from './history';
import { computeOverdueFine } from '@/lib/fines';
import { unstable_cache } from 'next/cache';
import { getMe } from '@/lib/auth-helpers';
import { isAbortError } from '@/lib/error-utils';

/**
 * Cache the recentBooks query for 1 hour.
 * This data is not user-specific — it's the latest catalog additions.
 * Using createSafeClient because unstable_cache runs outside the request lifecycle
 * and cannot access cookies().
 */
const getCachedRecentBooks = unstable_cache(
  async () => {
    const supabase = createSafeClient();
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);
    return data ?? [];
  },
  ['dashboard-recent-books'],
  { revalidate: 3600, tags: ['books'] },
);


export async function getDashboardStats({
  role,
  scope = 'full',
}: {
  role: string | null;
  scope?: 'full' | 'analytics';
}): Promise<{
  activeBorrows: number;
  pendingApprovals: number;
  myActiveBorrows: number;
  recentBooks: { id: string; title: string; author: string; cover_url: string | null; created_at: string }[];
  activeBorrowsList?: BorrowingRecord[];
  attendanceToday: number;
  totalBooks: number;
  totalUsers: number;
  archivedBooks: number;
  archivedUsers: number;
  overdueBorrows: number;
  readyHolds: number;
}> {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");
  
  const { user, supabase } = me;
  const userId = user.id;

  const isActuallyStaff = role === 'super_admin' || 
                          role === 'librarian' || 
                          (role === 'library_staff' && me.profile?.status?.toUpperCase() === 'ACTIVE');


  const isManager = isActuallyStaff;
  const canReviewApprovals = role === 'super_admin' || role === 'librarian';
  const isFullScope = scope === 'full';

  const safeWrap = async <T>(promise: Promise<T>, defaultValue: T): Promise<T> => {
    try {
      return await promise;
    } catch (err: unknown) {
      if (isAbortError(err)) throw err;
      return defaultValue;
    }
  };

  const [
    activeBorrowsResult,
    recentBooksResult,
    pendingCardsResult,
    borrowingHistoryResult,
    dailyAttendanceResult,
    totalBooksResult,
    totalUsersResult,
    archivedBooksResult,
    archivedUsersResult,
    overdueBorrowsResult,
    readyHoldsResult,
  ] = await Promise.all([
    safeWrap(
      Promise.resolve(
        supabase
          .from('borrowing_records')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ACTIVE')
          .then(res => ({ count: res.count ?? 0 }))
      ),
      { count: 0 }
    ),
    isFullScope
      ? safeWrap(getCachedRecentBooks(), [])
      : Promise.resolve([]),
    isFullScope && canReviewApprovals
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('library_cards')
              .select('id', { count: 'exact', head: true })
              .ilike('status', 'pending')
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
    isFullScope
      ? safeWrap(
          getBorrowingHistory(userId, 1, 10, 'CURRENT', undefined, supabase),
          { records: [], totalCount: 0 }
        )
      : Promise.resolve({ records: [], totalCount: 0 }),
    safeWrap(
      Promise.resolve(
        supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .gte('check_in_at', (() => {
            const manilaStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
            return `${manilaStr}T00:00:00+08:00`;
          })())
          .then(res => ({ count: res.count ?? 0 }))
      ),
      { count: 0 }
    ),
    isManager
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('books')
              .select('id', { count: 'exact', head: true })
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
    canReviewApprovals
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
    isFullScope && isManager
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('books')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', false)
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
    isFullScope && canReviewApprovals
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'ARCHIVED')
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
    isFullScope && canReviewApprovals
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('borrowing_records')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'OVERDUE')
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
    isFullScope && canReviewApprovals
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('reservations')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'READY')
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
  ]);

  interface SupabaseCountResult { count: number | null }
  interface BorrowHistoryResult { records: BorrowingRecord[]; totalCount: number }

  const isPriorityBorrow = (b: BorrowingRecord) =>
    b.status === 'OVERDUE' ||
    (b.status === 'ACTIVE' && new Date(b.due_date).getTime() < Date.now()) ||
    (b.status === 'RETURNED' && Number(b.fine_amount ?? 0) > 0 && !b.fine_settled_at);

  const sortedActiveBorrows = [...(borrowingHistoryResult as BorrowHistoryResult).records]
    .map((b) => ({
      ...b,
      fine_amount: computeOverdueFine(b),
    }))
    .sort((a, b) => {
      const ap = isPriorityBorrow(a) ? 0 : 1;
      const bp = isPriorityBorrow(b) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  return {
    activeBorrows: (activeBorrowsResult as SupabaseCountResult).count || 0,
    pendingApprovals: (pendingCardsResult as SupabaseCountResult).count || 0,
    myActiveBorrows: (borrowingHistoryResult as BorrowHistoryResult).totalCount || 0,
    recentBooks: recentBooksResult as { id: string; title: string; author: string; cover_url: string | null; created_at: string }[],
    activeBorrowsList: sortedActiveBorrows,
    attendanceToday: (dailyAttendanceResult as SupabaseCountResult).count || 0,
    totalBooks: (totalBooksResult as SupabaseCountResult).count || 0,
    totalUsers: (totalUsersResult as SupabaseCountResult).count || 0,
    archivedBooks: (archivedBooksResult as SupabaseCountResult).count || 0,
    archivedUsers: (archivedUsersResult as SupabaseCountResult).count || 0,
    overdueBorrows: (overdueBorrowsResult as SupabaseCountResult).count || 0,
    readyHolds: (readyHoldsResult as SupabaseCountResult).count || 0,
  };
}

/**
 * Resolves the book title for a specific book copy ID.
 * Decouples client realtime listeners from direct relational join queries.
 */
export async function getBookCopyTitle(bookCopyId: string): Promise<string> {
  const me = await getMe();
  if (!me) return 'Resource';
  const { supabase } = me;
  const { data: copy } = await supabase
    .from('book_copies')
    .select('books(title)')
    .eq('id', bookCopyId)
    .single();

  return (copy?.books as unknown as { title: string } | null)?.title || 'Resource';
}
