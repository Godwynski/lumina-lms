'use server'

import { createClient } from '@/lib/supabase/server';

export async function getDashboardStats() {
  const supabase = await createClient();
  
  const [
    { count: totalBooks },
    { count: activeLoans },
    { count: totalUsers },
    { data: recentBooks }
  ] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('borrowing_records').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('id, title, author, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(5)
  ]);

  return {
    totalBooks: totalBooks || 0,
    activeLoans: activeLoans || 0,
    totalUsers: totalUsers || 0,
    recentBooks: recentBooks || []
  };
}
