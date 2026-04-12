'use server'

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth-helpers';
import { logger } from '../logger';
import { logAuditActivity } from '@/lib/audit';

export async function approveLibraryCard(cardId: string, userId: string) {
  const role = await getUserRole();
  if (role !== 'admin' && role !== 'librarian') {
    throw new Error('Unauthorized');
  }

  // Use Admin Client for internal operations that bypass RLS or need Auth Admin API
  const supabaseAdmin = createAdminClient();

  // 1. Update card status securely
  const { error: updateError } = await supabaseAdmin
    .from("library_cards")
    .update({ status: "active" })
    .eq("id", cardId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // 2. Fetch email securely via auth admin
  const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  
  if (authError || !user?.email) {
    logger.warn('admin', `Card approved but could not fetch email for user ${userId}`);
  } else {
    // In a real app we'd trigger an email system here
    logger.info('admin', `Card approved. Notification would be sent to ${user.email}`);
  }

  // AUDIT LOGGING
  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  
  await logAuditActivity(
    adminUser?.id || null, 
    "library_card",
    cardId,
    "approve",
    `Approved card for user ${userId}`
  );

  return { success: true };
}
