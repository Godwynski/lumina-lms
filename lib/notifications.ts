import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

type NotificationType = 'SYSTEM' | 'CIRCULATION' | 'RESERVATION' | 'OVERDUE' | 'ACCOUNT' | 'DUE_SOON' | 'RESERVATION_EXPIRED';
type NotificationPriority = 'low' | 'medium' | 'high';

// ... (sendNotification and sendBulkNotifications logic stays same, just adding new functions below)

/**
 * Runs scheduled maintenance tasks to find and notify users about
 * approaching due dates, overdue books, and expired reservations.
 */
export async function runMaintenanceTasks() {
  const supabaseAdmin = createAdminClient();
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
  
  const results = {
    remindersSent: 0,
    overdueTagged: 0,
    reservationsExpired: 0,
    errors: [] as string[]
  };

  // 1. Due Soon Reminders (Due in <= 2 days, not yet reminded, not yet returned)
  try {
    const { data: dueSoon, error: dueSoonError } = await supabaseAdmin
      .from('borrowing_records')
      .select('*, profiles:user_id(full_name), books:book_id(title)')
      .eq('status', 'BORROWED')
      .eq('reminder_sent', false)
      .lte('due_date', twoDaysFromNow.toISOString())
      .gt('due_date', now.toISOString());

    if (dueSoonError) throw dueSoonError;

    for (const record of dueSoon || []) {
      const { success } = await sendNotification({
        userId: record.user_id,
        title: 'Reminder: Book Due Soon',
        content: `Your borrowed book "${record.books.title}" is due on ${new Date(record.due_date).toLocaleDateString()}. Please return or renew it to avoid fines.`,
        type: 'DUE_SOON',
        priority: 'medium'
      });

      if (success) {
        await supabaseAdmin
          .from('borrowing_records')
          .update({ reminder_sent: true })
          .eq('id', record.id);
        results.remindersSent++;
      }
    }
  } catch (err: unknown) {
    results.errors.push(`Reminders error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Overdue Check (Actually overdue, status still BORROWED)
  try {
    const { data: overdue, error: overdueError } = await supabaseAdmin
      .from('borrowing_records')
      .select('*, profiles:user_id(full_name), books:book_id(title)')
      .eq('status', 'BORROWED')
      .lt('due_date', now.toISOString());

    if (overdueError) throw overdueError;

    for (const record of overdue || []) {
      // Update status to OVERDUE if it isn't already
      // Note: We might need to check if your system uses an 'OVERDUE' status in borrowing_records
      
      const { success } = await sendNotification({
        userId: record.user_id,
        title: 'URGENT: Book Overdue',
        content: `Your borrowed book "${record.books.title}" was due on ${new Date(record.due_date).toLocaleDateString()} and is now overdue. Please return it immediately.`,
        type: 'OVERDUE',
        priority: 'high'
      });

      if (success) results.overdueTagged++;
    }
  } catch (err: unknown) {
    results.errors.push(`Overdue check error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Reservation Expiry (Ready for > 3 days)
  try {
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    const { data: expired, error: expiredError } = await supabaseAdmin
      .from('reservations')
      .select('*, books:book_id(title)')
      .eq('status', 'READY')
      .lt('updated_at', threeDaysAgo.toISOString());

    if (expiredError) throw expiredError;

    for (const res of expired || []) {
      // Mark as cancelled/expired
      const { error: updateError } = await supabaseAdmin
        .from('reservations')
        .update({ status: 'CANCELLED' })
        .eq('id', res.id);

      if (!updateError) {
        await sendNotification({
          userId: res.user_id,
          title: 'Reservation Expired',
          content: `Your reservation for "${res.books.title}" has expired as it was not picked up within 3 days.`,
          type: 'RESERVATION_EXPIRED',
          priority: 'low'
        });
        results.reservationsExpired++;
      }
    }
  } catch (err: unknown) {
    results.errors.push(`Reservation expiry error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return results;
}

interface SendNotificationOptions {
  userId: string;
  title: string;
  content: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

/**
 * Sends a notification to a specific user.
 * Uses the admin client to bypass RLS.
 */
async function sendNotification({
  userId,
  title,
  content,
  type = 'SYSTEM',
  priority = 'medium',
  metadata = {},
}: SendNotificationOptions) {
  try {
    const supabaseAdmin = createAdminClient();

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        content,
        type,
        priority,
        metadata,
      });

    if (error) {
      logger.error('notifications', `Failed to send notification to ${userId}: ${error.message}`);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('notifications', `Unexpected error sending notification to ${userId}: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Sends a notification to multiple users.
 */
export async function sendBulkNotifications(
  userIds: string[],
  options: Omit<SendNotificationOptions, 'userId'>
) {
  try {
    const supabaseAdmin = createAdminClient();

    const notifications = userIds.map((userId) => ({
      user_id: userId,
      title: options.title,
      content: options.content,
      type: options.type || 'SYSTEM',
      priority: options.priority || 'medium',
      metadata: options.metadata || {},
    }));

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    if (error) {
      logger.error('notifications', `Failed to send bulk notifications: ${error.message}`);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('notifications', `Unexpected error sending bulk notifications: ${msg}`);
    return { success: false, error: msg };
  }
}
