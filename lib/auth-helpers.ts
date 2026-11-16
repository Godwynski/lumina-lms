import { createClient } from './supabase/server';
import { cache } from 'react';
import { ProfileData, UserRole, UserPermissions } from './types';
export type { UserRole, UserPermissions };


export const normalizeUserRole = (value: unknown): UserRole | null => {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  
  if (role === 'super_admin' || role === 'librarian' || role === 'student_assistant' || role === 'student') {
    return role as UserRole;
  }
  return null;
};

const getAuthSession = cache(async () => {
  try {
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();

    // If an auth error occurred (such as refresh_token_not_found, expired session, etc.),
    // treat the visitor as unauthenticated and return null cleanly.
    if (userError || !data?.user) return null;

    return { supabase, user: data.user };
  } catch {
    return null;
  }
});

const getProfileRow = cache(async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) => {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) return null;
    return profile;
  } catch {
    return null;
  }
});

/**
 * Returns the currently authenticated user's profile and role.
 * Wrapped in React cache() for request-level memoization.
 * 
 * Resilient against invalid or expired refresh tokens (AuthApiError 400 refresh_token_not_found):
 * returns null cleanly without throwing unhandled exceptions to server runtimes.
 */
export const getMe = cache(async () => {
  try {
    const session = await getAuthSession();
    if (!session) return null;

    const { supabase, user } = session;

    // Faster path: Get role from metadata if available
    const metadataRole = normalizeUserRole(user.app_metadata?.role);

    const profile = await getProfileRow(supabase, user.id);
    if (!profile) return null;

    const role = normalizeUserRole(profile.role) || metadataRole || 'student';

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
      isStaff: ['super_admin', 'librarian', 'student_assistant'].includes(role),
      isAdmin: role === 'super_admin',
      isDeactivatedSA: role === 'student_assistant' && profile.status?.toUpperCase() !== 'ACTIVE',
      hasPermission: (permission: keyof UserPermissions) => {
        if (role === 'super_admin' || role === 'librarian') return true;
        const perms = (profile.permissions as UserPermissions | null);
        return !!perms?.[permission];
      },
      supabase
    };
  } catch {
    // Intercept any thrown AuthApiError, network issues, or unexpected exceptions.
    // Invalid/expired refresh tokens indicate an unauthenticated guest/expired session,
    // so return null cleanly without throwing unhandled exceptions.
    return null;
  }
});

/**
 * Returns the currently authenticated user's UI preferences.
 * Wrapped in React cache() for request-level memoization.
 */
export const getPreferences = cache(async () => {
  try {
    const session = await getAuthSession();
    if (!session) return {};

    const { supabase, user } = session;
    const [profile, prefsResult] = await Promise.all([
      getProfileRow(supabase, user.id),
      supabase
        .from('ui_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (!profile) return {};

    const { data, error } = prefsResult;

    if (error) {
      console.error('[AUTH-HELPERS] Failed to fetch preferences:', error.message);
      return {};
    }

    return (data?.preferences as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
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

  const isStaffOnly = !allowedRoles.includes('student');
  if (isStaffOnly && me.profile.status?.toUpperCase() !== 'ACTIVE') {
    throw new Error('Forbidden');
  }

  return me;
}

