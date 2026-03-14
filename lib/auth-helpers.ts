import { createClient } from './supabase/server';
import { cache } from 'react';

export const getUserRole = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // app_metadata is set by the admin API and is always returned from getUser()
  // This is the most reliable source — no extra DB query needed
  if (user.app_metadata?.role) {
    return user.app_metadata.role as string;
  }

  // Fallback: query profiles table (covers users registered through the app)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return (profile?.role as string) || 'student';
});
