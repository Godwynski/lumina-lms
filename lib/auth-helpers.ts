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

export const getUserRole = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Prefer profiles.role so authorization and navigation use the same source.
  // app_metadata can be stale if role changes were made only in profiles.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const profileRole = normalizeRole(profile?.role);
  if (profileRole) return profileRole;

  const metadataRole = normalizeRole(user.app_metadata?.role);
  if (metadataRole) return metadataRole;

  return 'student';
});
