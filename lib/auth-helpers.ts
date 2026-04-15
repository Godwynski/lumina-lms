import { createClient } from './supabase/server';
import { cache } from 'react';

const normalizeRole = (value: unknown): 'admin' | 'librarian' | 'staff' | 'student' | null => {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  if (role === 'admin' || role === 'librarian' || role === 'staff' || role === 'student') {
    return role;
  }
  return null;
};

/**
 * Returns the role for the currently authenticated user.
 *
 * Strategy (JWT-first, DB-fallback):
 * 1. Read app_metadata.role from the JWT — zero network round-trip, verified by Supabase.
 *    This is set by the Admin API and cannot be forged by the user.
 * 2. If absent (e.g., legacy accounts or OAuth sign-ups before the admin API set the field),
 *    fall back to profiles.role (one DB query).
 * 3. Default to 'student' if neither source has a valid role.
 *
 * NOTE: app_metadata changes take effect on the next JWT refresh (~1 hour). If you change a
 * user's role via the profiles table directly (not via the Admin API), the session role will
 * be stale until the token refreshes. Always use the Admin API to change roles to ensure
 * immediate consistency.
 *
 * Cached per-request via React's cache() to avoid redundant auth lookups within one request.
 * We intentionally do NOT use unstable_cache() here because role checks depend on cookies()
 * (the user's session) which cannot be accessed inside an unstable_cache scope in Next.js 15.
 */
export const getUserRole = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return null;

  // Fast path: role is in the JWT app_metadata (set by Admin API)
  const metadataRole = normalizeRole(user.app_metadata?.role);
  if (metadataRole) return metadataRole;

  // Slow path: fall back to DB profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const profileRole = normalizeRole(profile?.role);
  if (profileRole) return profileRole;

  return 'student';
});
