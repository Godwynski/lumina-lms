'use server'

import { createClient, createSafeClient } from '@/lib/supabase/server';
import { getViolations, type ViolationWithProfile } from './violations';
import { getBorrowingHistory, type BorrowingRecord } from './history';
import { unstable_cache } from 'next/cache';

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
  totalPoints?: number;
}> {
  const supabase = await createClient();
  
  // Security Gap Fix: Derive userId from the verified session, not from props
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;

  const isStudent = role === 'student';
  const canReviewApprovals = role === 'admin' || role === 'librarian';

  // recentBooks is cached for 1 hour — no user data, changes infrequently.
  // The user-specific counts are always fresh (no cache).
  const [
    { count: activeLoans },
    recentBooks,
    pendingApprovalsResult,
    myActiveLoansResult,
    myViolationsResult,
  ] = await Promise.all([
    supabase
      .from('borrowing_records')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE'), // Match schema uppercase enum 
    getCachedRecentBooks(),
    canReviewApprovals
      ? supabase
          .from('library_cards')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING')
      : Promise.resolve({ count: 0 }),
    isStudent
      ? getBorrowingHistory(userId, 1, 5, 'ACTIVE')
      : Promise.resolve({ records: [], totalCount: 0 }),
    isStudent
      ? getViolations()
      : Promise.resolve({ violations: [], stats: { total: 0, active: 0, resolved: 0, totalPoints: 0 }, role: '' }),
  ]);

  return {
    activeLoans: activeLoans || 0,
    pendingApprovals: (pendingApprovalsResult as { count: number }).count || 0,
    myActiveLoans: (myActiveLoansResult as { totalCount: number }).totalCount || 0,
    recentBooks,
    activeLoansList: (myActiveLoansResult as { records: BorrowingRecord[] }).records,
    violationsList: (myViolationsResult as { violations: ViolationWithProfile[] }).violations,
    totalPoints: (myViolationsResult as { stats: { totalPoints: number } }).stats?.totalPoints || 0,
  };
}
