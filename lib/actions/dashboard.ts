'use server'

import { createClient } from '@/lib/supabase/server';
import { createSafeClient } from '@/lib/supabase/server';
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
}) {
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
  ] = await Promise.all([
    supabase
      .from('borrowing_records')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'), // Match schema lowercase enum 
    getCachedRecentBooks(),
    canReviewApprovals
      ? supabase
          .from('library_cards')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    isStudent
      ? supabase
          .from('borrowing_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active') // Match schema lowercase enum 
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    activeLoans: activeLoans || 0,
    pendingApprovals: pendingApprovalsResult.count || 0,
    myActiveLoans: myActiveLoansResult.count || 0,
    recentBooks,
  };
}
