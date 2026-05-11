import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { sendOverdueEmail, sendDueSoonEmail } from './mail';

type NotificationType = 'SYSTEM' | 'CIRCULATION' | 'RESERVATION' | 'OVERDUE' | 'ACCOUNT' | 'DUE_SOON' | 'RESERVATION_EXPIRED';
type NotificationPriority = 'low' | 'medium' | 'high';

interface BorrowingRecordWithDetails {
  id: string;
  user_id: string;
  due_date: string;
  status: string;
  reminder_sent: boolean;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
  book_copy: {
    book_id: string;
    book: {
      title: string;
      author: string | null;
      cover_url: string | null;
    } | null;
  } | null;
}

// ... (sendNotification and sendBulkNotifications logic stays same, just adding new functions below)

/**
 * Runs scheduled maintenance tasks to find and notify users about
 * approaching due dates, overdue books, and expired reservations.
 */
export async function runMaintenanceTasks() {
  const supabaseAdmin = createAdminClient();
  const now = new Date();
  
  // Fetch system settings
  const { data: settingsData } = await supabaseAdmin
    .from('system_settings')
    .select('key, value');
  
  const settings = (settingsData || []).reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);

  const dueSoonDays = parseInt(settings['due_soon_reminder_days'] || '1', 10);

  const results = {
    remindersSent: 0,
    overdueTagged: 0,
    reservationsExpired: 0,
    errors: [] as string[]
  };

  // 1. Due Soon Reminders (Based on configured dueSoonDays)
  try {
    const dueSoonThreshold = new Date(now.getTime() + (dueSoonDays * 24 * 60 * 60 * 1000));
    const { data: dueSoon, error: dueSoonError } = await supabaseAdmin
      .from('borrowing_records')
      .select(`
        *,
        profiles:user_id(full_name, email),
        book_copy:book_copy_id(
          book:book_id(title, author, cover_url)
        )
      `)
      .eq('status', 'ACTIVE')
      .eq('reminder_sent', false)
      .lte('due_date', dueSoonThreshold.toISOString())
      .gt('due_date', now.toISOString());

    if (dueSoonError) throw dueSoonError;

    const records = (dueSoon as unknown as BorrowingRecordWithDetails[]) || [];
    for (const record of records) {
      const book = record.book_copy?.book;
      const dueDate = new Date(record.due_date);
      const { success } = await sendNotification({
        userId: record.user_id,
        title: 'Reminder: Book Due Soon',
        content: `Your borrowed book "${book?.title}"${book?.author ? ` by ${book.author}` : ''} is due on ${dueDate.toLocaleDateString()}. Please return or renew it to avoid fines.`,
        type: 'DUE_SOON',
        priority: 'medium',
        metadata: {
          bookId: record.book_copy?.book_id,
          bookTitle: book?.title,
          coverUrl: book?.cover_url,
          dueDate: record.due_date
        }
      });

      if (success) {
        // Send Email Notification if email exists
        if (record.profiles?.email) {
          await sendDueSoonEmail({
            to: record.profiles.email,
            userName: record.profiles.full_name || 'Valued Member',
            bookTitle: book?.title || 'Borrowed Book',
            dueDate: dueDate.toLocaleDateString(),
          });
        }

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

  // 2. Overdue Check (Actually overdue, status still ACTIVE or already OVERDUE but notify again if needed)
  try {
    const { data: overdue, error: overdueError } = await supabaseAdmin
      .from('borrowing_records')
      .select(`
        *,
        profiles:user_id(full_name, email),
        book_copy:book_copy_id(
          book:book_id(title, author, cover_url)
        )
      `)
      .in('status', ['ACTIVE', 'OVERDUE'])
      .lt('due_date', now.toISOString());

    if (overdueError) throw overdueError;

    const records = (overdue as unknown as BorrowingRecordWithDetails[]) || [];
    for (const record of records) {
      const book = record.book_copy?.book;
      const dueDate = new Date(record.due_date);
      const overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      
      const isInitialOverdue = record.status !== 'OVERDUE';

      // Update status to OVERDUE if it isn't already
      if (isInitialOverdue) {
        await supabaseAdmin
          .from('borrowing_records')
          .update({ status: 'OVERDUE', updated_at: now.toISOString() })
          .eq('id', record.id);
      }

      // Only notify if it just became overdue, or if it's a recurring check (e.g. every 7 days)
      // For now, let's stick to a strong notification when it first becomes overdue.
      if (isInitialOverdue) {
        const { success } = await sendNotification({
          userId: record.user_id,
          title: 'URGENT: Book Overdue',
          content: `Your borrowed book "${book?.title}"${book?.author ? ` by ${book.author}` : ''} was due on ${dueDate.toLocaleDateString()} and is now ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue. Please return it immediately to the Main Library circulation desk.`,
          type: 'OVERDUE',
          priority: 'high',
          metadata: {
            bookId: record.book_copy?.book_id,
            bookTitle: book?.title,
            coverUrl: book?.cover_url,
            dueDate: record.due_date,
            overdueDays
          }
        });

        if (success) {
          // Send Email Notification if email exists
          if (record.profiles?.email) {
            await sendOverdueEmail({
              to: record.profiles.email,
              userName: record.profiles.full_name || 'Valued Member',
              bookTitle: book?.title || 'Borrowed Book',
              dueDate: dueDate.toLocaleDateString(),
              overdueDays,
            });
          }

          results.overdueTagged++;
        }
      }
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
