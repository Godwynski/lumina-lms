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
  const { data, error: userError } = await supabase.auth.getUser();
  const user = data?.user;

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
    isAdmin: role === 'admin',
    supabase
  };
});

/**
 * Returns the currently authenticated user's UI preferences.
 * Wrapped in React cache() for request-level memoization.
 */
export const getPreferences = cache(async () => {
  const me = await getMe();
  if (!me) return {};

  const { supabase, user } = me;
  const { data, error } = await supabase
    .from('ui_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[AUTH-HELPERS] Failed to fetch preferences:', error.message);
    return {};
  }

  return (data?.preferences as Record<string, unknown>) ?? {};
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

