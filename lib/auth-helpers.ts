import { createClient } from './supabase/server';
import { cache } from 'react';

export type UserRole = 'admin' | 'librarian' | 'staff' | 'student';

export const normalizeUserRole = (value: unknown): UserRole | null => {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  if (role === 'admin' || role === 'librarian' || role === 'staff' || role === 'student') {
    return role as UserRole;
  }
  return null;
};

/**
 * Returns the currently authenticated user's profile and role.
 * Wrapped in React cache() for request-level memoization.
 */
export const getMe = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return null;

  // Faster path: Get role from metadata if available
  const metadataRole = normalizeUserRole(user.app_metadata?.role);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return null;

  const role = metadataRole || normalizeUserRole(profile.role) || 'student';

  return {
    user,
    profile,
    role: role as UserRole,
    isStaff: ['admin', 'librarian', 'staff'].includes(role),
    isAdmin: role === 'admin'
  };
});

/**
 * Returns the role for the currently authenticated user.
 */
export const getUserRole = cache(async () => {
  const me = await getMe();
  return me?.role ?? null;
});

/**
 * Asserts that the current user has one of the required roles.
 * Throws an error if not authorized. Useful for Server Actions.
 */
export async function assertRole(allowedRoles: UserRole[]) {
  const me = await getMe();
  
  if (!me) {
    throw new Error('Unauthorized');
  }

  if (!allowedRoles.includes(me.role)) {
    throw new Error('Forbidden');
  }

  return me;
}

