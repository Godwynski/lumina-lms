'use server'

import { createClient } from '@/lib/supabase/server';

export async function getDashboardStats({
  userId,
  role,
}: {
  userId: string;
  role: string | null;
}) {
  const supabase = await createClient();
  const isStudent = role === 'student';
  const canReviewApprovals = role === 'admin' || role === 'librarian';

  const [
    { count: activeLoans },
    { data: recentBooks },
    pendingApprovalsResult,
    myActiveLoansResult,
  ] = await Promise.all([
    supabase
      .from('borrowing_records')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'ACTIVE']),
    supabase
      .from('books')
      .select('id, title, author, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5),
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
          .in('status', ['active', 'ACTIVE'])
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    activeLoans: activeLoans || 0,
    pendingApprovals: pendingApprovalsResult.count || 0,
    myActiveLoans: myActiveLoansResult.count || 0,
    recentBooks: recentBooks || [],
  };
}
