'use server'
 
import { createSafeClient } from '@/lib/supabase/server';
import { getBorrowingHistory, type BorrowingRecord } from './history';
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
}: {
  role: string | null;
}): Promise<{
  activeBorrows: number;
  pendingApprovals: number;
  myActiveBorrows: number;
  recentBooks: { id: string; title: string; author: string; cover_url: string | null; created_at: string }[];
  activeBorrowsList?: BorrowingRecord[];
  attendanceToday: number;
  totalBooks: number;
  totalUsers: number;
}> {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");
  
  const { user, supabase } = me;
  const userId = user.id;

  const isStudent = role === 'student';
  const isManager = role === 'admin' || role === 'librarian' || role === 'student_assistant';
  const canReviewApprovals = role === 'admin' || role === 'librarian';

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
    safeWrap(getCachedRecentBooks(), []),
    canReviewApprovals
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('library_cards')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending')
              .then(res => ({ count: res.count ?? 0 }))
          ),
          { count: 0 }
        )
      : Promise.resolve({ count: 0 }),
    isStudent
      ? safeWrap(
          getBorrowingHistory(userId, 1, 5, 'ACTIVE', undefined, supabase),
          { records: [], totalCount: 0 }
        )
      : Promise.resolve({ records: [], totalCount: 0 }),
    safeWrap(
      Promise.resolve(
        supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .gte('check_in_at', `${new Date().toISOString().split('T')[0]}T00:00:00`)
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
  ]);

  interface SupabaseCountResult { count: number | null }
  interface BorrowHistoryResult { records: BorrowingRecord[]; totalCount: number }

  return {
    activeBorrows: (activeBorrowsResult as SupabaseCountResult).count || 0,
    pendingApprovals: (pendingCardsResult as SupabaseCountResult).count || 0,
    myActiveBorrows: (borrowingHistoryResult as BorrowHistoryResult).totalCount || 0,
    recentBooks: recentBooksResult as { id: string; title: string; author: string; cover_url: string | null; created_at: string }[],
    activeBorrowsList: (borrowingHistoryResult as BorrowHistoryResult).records,
    attendanceToday: (dailyAttendanceResult as SupabaseCountResult).count || 0,
    totalBooks: (totalBooksResult as SupabaseCountResult).count || 0,
    totalUsers: (totalUsersResult as SupabaseCountResult).count || 0,
  };
}
