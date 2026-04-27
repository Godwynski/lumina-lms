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
}> {
  const me = await getMe();
  if (!me) throw new Error("Unauthorized");
  
  const { user, supabase } = me;
  const userId = user.id;

  const isStudent = role === 'student';
  const canReviewApprovals = role === 'admin' || role === 'librarian';

  // Helper to wrap promises with default values on error (e.g. AbortError)
  const safeWrap = async <T>(promise: Promise<T>, defaultValue: T): Promise<T> => {
    try {
      return await promise;
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw err; // Re-throw so Next.js can stop the stream
      }
      console.warn('[DASHBOARD] Sub-promise failed:', err instanceof Error ? err.message : String(err));
      return defaultValue;
    }
  };

  const [
    activeBorrowsResult,
    recentBooks,
    pendingApprovalsResult,
    myActiveBorrowsResult,
  ] = await Promise.all([
    safeWrap(
      Promise.resolve(
        supabase
          .from('borrowing_records')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ACTIVE')
      ),
      { count: 0, data: [], error: null, status: 200, statusText: 'OK', success: true }
    ),
    safeWrap(getCachedRecentBooks(), [] as { id: string; title: string; author: string; cover_url: string | null; created_at: string }[]),
    canReviewApprovals
      ? safeWrap(
          Promise.resolve(
            supabase
              .from('library_cards')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'pending')
          ),
          { count: 0, data: [], error: null, status: 200, statusText: 'OK', success: true }
        )
      : Promise.resolve({ count: 0 }),
    isStudent
      ? safeWrap(
          getBorrowingHistory(userId, 1, 5, 'ACTIVE', undefined, supabase),
          { records: [], totalCount: 0 }
        )
      : Promise.resolve({ records: [], totalCount: 0 }),
  ]);

  const activeBorrows = (activeBorrowsResult as { count: number | null }).count || 0;

  return {
    activeBorrows: activeBorrows || 0,
    pendingApprovals: (pendingApprovalsResult as { count: number }).count || 0,
    myActiveBorrows: (myActiveBorrowsResult as { totalCount: number }).totalCount || 0,
    recentBooks,
    activeBorrowsList: (myActiveBorrowsResult as { records: BorrowingRecord[] }).records,
  };
}
