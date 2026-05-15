import { createClient } from './supabase/server';
import { cache } from 'react';
import { ProfileData, UserRole, UserPermissions } from './types';
export type { UserRole, UserPermissions };


export const normalizeUserRole = (value: unknown): UserRole | null => {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  
  // Mapping deprecated 'staff' role to 'student_assistant'
  if (role === 'staff') return 'student_assistant';
  
  if (role === 'admin' || role === 'librarian' || role === 'student_assistant' || role === 'student') {
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
    profile: profile as unknown as ProfileData & { 
      id: string; 
      email: string | null; 
      role: string; 
      status: string;
      permissions: UserPermissions | null;
    },
    role: role as UserRole,
    isStaff: ['admin', 'librarian', 'student_assistant'].includes(role),
    isAdmin: role === 'admin',
    isDeactivatedSA: role === 'student_assistant' && profile.status?.toUpperCase() !== 'ACTIVE',
    hasPermission: (permission: keyof UserPermissions) => {
      if (role === 'admin') return true;
      const perms = (profile.permissions as UserPermissions | null);
      return !!perms?.[permission];
    },
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

