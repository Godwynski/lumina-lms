'use server';

import { getMe } from '@/lib/auth-helpers';
import { sanitizeFilterInput } from '@/lib/utils';
import { mapProfileToUser } from '@/lib/utils/mappers';

import type { User } from '@/lib/types';

/**
 * Server action to fetch paginated and filtered users for management.
 * Enforces role restrictions (librarians cannot see super_admins).
 */
export async function getUsers(options: {
  tab?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ users: User[]; total: number }> {
  const me = await getMe();
  if (!me) {
    throw new Error('Unauthorized');
  }

  const { supabase, role } = me;
  if (role !== 'super_admin' && role !== 'librarian') {
    throw new Error('Forbidden');
  }

  const tab = options.tab || 'all';
  const page = Math.max(1, options.page || 1);
  const pageSize = options.pageSize || 12;

  let queryBuilder = supabase
    .from('profiles')
    .select('*', { count: 'exact' });

  if (tab === 'review') {
    queryBuilder = queryBuilder.eq('status', 'PENDING');
  } else if (tab === 'archived') {
    queryBuilder = queryBuilder.eq('status', 'ARCHIVED');
  } else if (tab !== 'all') {
    queryBuilder = queryBuilder.eq('role', tab).neq('status', 'ARCHIVED');
  } else {
    // "all" tab: exclude archived
    queryBuilder = queryBuilder.neq('status', 'ARCHIVED');
  }

  // Librarian Restriction: Hide super admins
  if (role === 'librarian') {
    queryBuilder = queryBuilder.neq('role', 'super_admin');
  }

  if (options.search?.trim()) {
    const raw = options.search.trim();
    const safe = sanitizeFilterInput(raw);
    const safeEmail = raw.replace(/["(),\\]/g, '');
    const orConditions = [
      `full_name.ilike.%${safe}%`,
      `email.ilike.%${safe}%`,
      `student_id.ilike.%${safe}%`,
    ];
    if (raw.includes('@')) {
      orConditions.push(`email.eq.${safeEmail}`);
    }
    queryBuilder = queryBuilder.or(orConditions.join(','));
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await queryBuilder
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const users = (data ?? []).map((row) => mapProfileToUser(row as Record<string, unknown>));
  return { users, total: count ?? 0 };
}
