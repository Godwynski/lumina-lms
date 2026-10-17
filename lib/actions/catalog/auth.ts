import { getMe } from '@/lib/auth-helpers';

/**
 * Validates that the current user has staff access to manage the catalog inventory.
 * Allowed roles: super_admin, librarian, student_assistant.
 * Returns the authenticated Supabase client on success.
 */
export async function assertStaffCatalogAccess() {
  const me = await getMe();
  if (!me || !me.isStaff) throw new Error('Unauthorized');
  
  if (me.role !== 'super_admin' && me.role !== 'librarian' && me.role !== 'student_assistant') {
    throw new Error('Access denied: Inventory management is restricted to authorized staff roles.');
  }

  return me.supabase;
}
