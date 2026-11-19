import { getMe } from '@/lib/auth-helpers';

/**
 * Validates that the current user may use catalog inventory actions.
 * Default: super_admin and librarian only (writes, bulk import, export).
 * Pass `allowAssistants` for the read-only inventory views student assistants also see.
 * Returns the authenticated Supabase client on success.
 */
export async function getCatalogStaff(allowAssistants = false) {
  const me = await getMe();
  if (!me || !me.isStaff || me.isDeactivatedSA) throw new Error('Unauthorized');

  if (me.role !== 'super_admin' && me.role !== 'librarian') {
    if (!allowAssistants || me.profile?.permissions?.manage_inventory !== true) {
      throw new Error('Access denied: Inventory management is restricted to authorized staff roles.');
    }
  }

  return me;
}

export async function assertStaffCatalogAccess(allowAssistants = false) {
  return (await getCatalogStaff(allowAssistants)).supabase;
}
