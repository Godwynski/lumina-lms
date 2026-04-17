'use server'
 
import { createSafeClient } from '@/lib/supabase/server';
import { getViolations, type ViolationWithProfile } from './violations';
import { getBorrowingHistory, type BorrowingRecord } from './history';
import { unstable_cache } from 'next/cache';
import { getMe } from '@/lib/auth-helpers';

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
  activeLoans: number;
  pendingApprovals: number;
  myActiveLoans: number;
  recentBooks: { id: string; title: string; author: string; cover_url?: string | null; created_at: string }[];
  activeLoansList?: BorrowingRecord[];
  violationsList?: ViolationWithProfile[];
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
    } catch (err) {
      console.warn('[DASHBOARD] Sub-promise failed:', err instanceof Error ? err.message : String(err));
      return defaultValue;
    }
  };

  const [
    activeLoansResult,
    recentBooks,
    pendingApprovalsResult,
    myActiveLoansResult,
    myViolationsResult,
  ] = await Promise.all([
    safeWrap(
      supabase
        .from('borrowing_records')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),
      { count: 0, error: null }
    ),
    safeWrap(getCachedRecentBooks(), []),
    canReviewApprovals
      ? safeWrap(
          supabase
            .from('library_cards')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'PENDING'),
          { count: 0, error: null }
        )
      : Promise.resolve({ count: 0 }),
    isStudent
      ? safeWrap(
          getBorrowingHistory(userId, 1, 5, 'ACTIVE'),
          { records: [], totalCount: 0 }
        )
      : Promise.resolve({ records: [], totalCount: 0 }),
    isStudent
      ? safeWrap(
          getViolations(),
          { violations: [], stats: { total: 0, active: 0, referred: 0, resolved: 0 }, role: '' }
        )
      : Promise.resolve({ violations: [], stats: { total: 0, active: 0, referred: 0, resolved: 0 }, role: '' }),
  ]);

  const activeLoans = (activeLoansResult as { count: number | null }).count || 0;

  return {
    activeLoans: activeLoans || 0,
    pendingApprovals: (pendingApprovalsResult as { count: number }).count || 0,
    myActiveLoans: (myActiveLoansResult as { totalCount: number }).totalCount || 0,
    recentBooks,
    activeLoansList: (myActiveLoansResult as { records: BorrowingRecord[] }).records,
    violationsList: (myViolationsResult as { violations: ViolationWithProfile[] }).violations,
  };
}
