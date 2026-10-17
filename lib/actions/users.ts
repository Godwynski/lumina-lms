'use server';

import { getMe, normalizeUserRole } from '@/lib/auth-helpers';
import { sanitizeFilterInput } from '@/lib/utils';
import { mapProfileToUser } from '@/lib/utils/mappers';
import { UserCreateSchema } from '@/lib/validations/api';
import { createSafeAction } from './action-utils';
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
    const safe = sanitizeFilterInput(options.search.trim());
    queryBuilder = queryBuilder.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
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

/**
 * Server action to invite or upgrade a user's role and status with server-side validation,
 * role check, profile update, and audit logging.
 */
export const inviteUser = createSafeAction(
  UserCreateSchema,
  async (input, { supabase, role: requesterRole }) => {
    const email = input.email.trim().toLowerCase();
    const requestedRole = normalizeUserRole(input.role) || 'student';
    const department = input.department?.trim() || 'General';

    if (requesterRole === 'librarian' && input.role && requestedRole !== 'student') {
      throw new Error('Librarians are not allowed to assign roles');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      throw new Error('No account found for that email. They must sign in first.');
    }

    const targetRole = normalizeUserRole(profile.role) || 'student';

    if (targetRole === 'super_admin' && requesterRole !== 'super_admin') {
      throw new Error('Only super administrators can modify a super administrator account');
    }

    if (requesterRole === 'librarian' && targetRole !== 'student') {
      throw new Error('Librarians cannot modify accounts with staff or admin roles');
    }

    if (requestedRole === 'super_admin' && requesterRole !== 'super_admin') {
      throw new Error('Only super administrators can assign the super admin role');
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        role: requestedRole,
        status: 'PENDING',
        department,
      })
      .eq('id', profile.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return [
      { user: mapProfileToUser(updated as Record<string, unknown>) },
      {
        entityId: profile.id,
        reason: `Invited/Upgraded user ${email} to ${requestedRole} (status set to pending)`,
        oldValue: { role: profile.role, status: profile.status, department: profile.department },
        newValue: { role: updated.role, status: updated.status, department: updated.department },
      },
    ];
  },
  {
    allowedRoles: ['super_admin', 'librarian'],
    auditAction: 'role_updated',
    auditEntity: 'profile',
  }
);
