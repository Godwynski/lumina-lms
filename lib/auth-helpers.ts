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
 */
export const getUserRole = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Fast path: role is embedded in the JWT via app_metadata (set by Admin API).
  // This is the authoritative source and requires no DB query.
  const metadataRole = normalizeRole(user.app_metadata?.role);
  if (metadataRole) return metadataRole;

  // Slow path: fall back to the profiles table for legacy accounts or OAuth users
  // whose app_metadata.role has not been set yet.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const profileRole = normalizeRole(profile?.role);
  if (profileRole) return profileRole;

  return 'student';
});

