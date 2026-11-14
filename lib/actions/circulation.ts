'use server';

import { z } from 'zod';
import { createSafeAction } from './action-utils';
import { logger } from '@/lib/logger';
import { logAuditActivity } from '@/lib/audit';
import { revalidateTag, revalidatePath } from 'next/cache';
import { SupabaseClient } from '@supabase/supabase-js';
import { sendNotification } from '@/lib/notifications';
import { format } from 'date-fns';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Checks if a user is eligible to borrow books.
 * Blocks if profile status is not ACTIVE or if they have OVERDUE books.
 */
async function checkUserBorrowingEligibility(supabase: SupabaseClient, userId: string) {
  // 1. Check profile status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('status, full_name')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found.');
  }

  if (profile.status?.toUpperCase() !== 'ACTIVE') {
    throw new Error(`Account is ${profile.status?.toLowerCase() || 'inactive'}. Borrowing is restricted.`);
  }

  // 2. Check for overdue books
  const { count, error: overdueError } = await supabase
    .from('borrowing_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'OVERDUE');

  if (overdueError) throw new Error('Failed to verify borrowing history.');

  if (count && count > 0) {
    throw new Error(`User has ${count} overdue book(s). Please return them before borrowing more.`);
  }

  return profile;
}

/**
 * Resolves a scanned value (Library Card or Book QR) to its entity.
 */
export const resolveScan = createSafeAction(
  z.object({
    scanValue: z.string().min(1),
    expectedType: z.enum(['auto', 'student', 'book']).default('auto'),
    isManual: z.boolean().default(false)
  }),
  async ({ scanValue, expectedType, isManual }, { supabase }) => {
    const value = scanValue.trim();

    // 1. Try resolving as Library Card (Student)
    if (expectedType !== 'book') {
      const cardSelect = `
          card_number,
          status,
          user_id,
          profiles:user_id (
            full_name,
            student_id,
            status
          )
        `;
      let { data: card, error: cardError } = await supabase
        .from('library_cards')
        .select(cardSelect)
        .eq('card_number', value)
        .maybeSingle();

      if (cardError) throw new Error(cardError.message);

      // Fallback: a typed student ID. Use that student's real card, since checkout looks up the
      // card number and card numbers are random LIB-… values, not student IDs.
      if (!card) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('student_id', value)
          .maybeSingle();

        if (profileError) throw new Error(profileError.message);

        if (profile) {
          const { data: ownCard, error: ownCardError } = await supabase
            .from('library_cards')
            .select(cardSelect)
            .eq('user_id', profile.id)
            .maybeSingle();
          if (ownCardError) throw new Error(ownCardError.message);
          card = ownCard;
        }
      }

      if (card) {
        // Validation logic
        if (card.status?.toUpperCase() !== 'ACTIVE') {
          throw new Error('Library card is not active.');
        }

        const profile = Array.isArray(card.profiles) ? card.profiles[0] : card.profiles;
        if (profile?.status?.toUpperCase() !== 'ACTIVE') {
          throw new Error(`Student account is ${profile?.status?.toLowerCase() || 'inactive'}.`);
        }

        return {
          type: 'student',
          data: {
            cardNumber: card.card_number,
            status: card.status,
            userId: card.user_id,
            fullName: profile?.full_name ?? 'Student',
            studentId: profile?.student_id ?? 'N/A',
          }
        };
      }
    }

    // 2. Try resolving as Book Copy
    if (expectedType !== 'student') {
      const { data: copy, error: copyError } = await supabase
        .from('book_copies')
        .select(`
          id,
          qr_string,
          status,
          book_id,
          books:book_id (
            title
          )
        `)
        .eq('qr_string', value)
        .maybeSingle();

      if (copyError) throw new Error(copyError.message);

      if (copy) {
        const book = Array.isArray(copy.books) ? copy.books[0] : copy.books;
        return {
          type: 'book',
          data: {
            copyId: copy.id,
            qrString: copy.qr_string,
            status: copy.status,
            bookId: copy.book_id,
            bookTitle: book?.title ?? 'Unknown title',
          }
        };
      }
    }

    const errorMessage = isManual 
      ? 'The identifier is not recognized by the circulation system.'
      : 'Scanned QR is not recognized by the circulation system.';

    throw new Error(errorMessage);
  },
  { allowedRoles: ['super_admin', 'librarian', 'student_assistant'], allowedPermissions: ['manage_circulation'] }
);

/**
 * Processes a book checkout.
 */
export const checkoutBook = createSafeAction(
  z.object({
    studentCardQr: z.string().min(1),
    bookQr: z.string().min(1),
    idempotencyKey: z.string().optional(),
    previewOnly: z.boolean().optional().default(false),
    isManual: z.boolean().default(false)
  }),
  async ({ studentCardQr, bookQr, idempotencyKey, previewOnly, isManual }, { supabase, profile: staff }) => {
    // 1. Pre-validation: Eligibility Check (only if not preview)
    let studentUserId: string | null = null;
    if (!previewOnly) {
       // First resolve the student to get user_id
       const { data: card } = await supabase
         .from('library_cards')
         .select('user_id')
         .eq('card_number', studentCardQr.trim())
         .single();
       
       if (card) {
         studentUserId = card.user_id;
         await checkUserBorrowingEligibility(supabase, card.user_id);
       }
    }

    // 2. Execute RPC using Admin Client to bypass client execution restrictions
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('process_qr_checkout', {
      p_librarian_id: String(staff.id),
      p_card_qr: studentCardQr.trim(),
      p_book_qr: bookQr.trim(),
      p_idempotency_key: idempotencyKey ?? null,
      p_preview_only: previewOnly,
    });

    if (error) {
      logger.error('circulation', 'Checkout RPC error', { error: error.message, bookQr });
      throw new Error(error.message || 'Checkout failed.');
    }

    const result = (data ?? {}) as { 
      ok?: boolean; 
      code?: string; 
      message?: string;
      borrowing_id?: string;
      book_title?: string;
      student_name?: string;
      due_date?: string;
    };

    if (!result.ok) {
      logger.warn('circulation', `Checkout failed: ${result.message}`, { bookQr, code: result.code });
      
      let message = result.message || 'Checkout failed.';
      if (isManual && message.toLowerCase().includes('not found')) {
        message = 'The identifier is not recognized by the circulation system.';
      }
      
      throw new Error(message);
    }

    if (!previewOnly) {
      logger.info('circulation', 'Checkout successful', { bookQr, librarianId: staff.id });
      await logAuditActivity(
        String(staff.id),
        'borrowing_record',
        result.borrowing_id || null,
        'checkout',
        `Checked out book '${result.book_title}' to ${result.student_name} (QR: ${bookQr})`,
        { studentCardQr, bookQr, studentName: result.student_name, bookTitle: result.book_title },
        null,
        { status: 'ACTIVE', book_qr: bookQr }
      );

      // Notify the student
      if (studentUserId) {
        await sendNotification({
          userId: studentUserId,
          title: "Book Borrowed",
          content: `You have successfully borrowed "${result.book_title}". Due date: ${result.due_date ? format(new Date(result.due_date), "MMM dd, yyyy") : 'N/A'}.`,
          type: "CIRCULATION",
          priority: "medium",
          metadata: {
            borrowingId: result.borrowing_id,
            bookTitle: result.book_title,
            dueDate: result.due_date
          }
        });
      }
      
      revalidatePath('/circulation', 'page');
      revalidateTag('catalog', 'max');
      revalidateTag('public-books', 'max');
    }

    return result;
  },
  { 
    allowedRoles: ['super_admin', 'librarian', 'student_assistant'],
    allowedPermissions: ['manage_circulation']
  }
);

/**
 * Processes a book return.
 */
export const returnBook = createSafeAction(
  z.object({
    bookQr: z.string().min(1),
    idempotencyKey: z.string().optional(),
    previewOnly: z.boolean().optional().default(false),
    isManual: z.boolean().default(false),
    settleFine: z.boolean().optional().default(false),
  }),
  async ({ bookQr, idempotencyKey, previewOnly, isManual, settleFine }, { supabase, profile: staff }) => {
    // Find the current borrower to notify them
    let studentUserId: string | null = null;
    if (!previewOnly) {
      const { data: copy } = await supabase
        .from('book_copies')
        .select('id')
        .eq('qr_string', bookQr.trim())
        .maybeSingle();
      
      if (copy) {
        const { data: record } = await supabase
          .from('borrowing_records')
          .select('user_id')
          .eq('book_copy_id', copy.id)
          .in('status', ['ACTIVE', 'OVERDUE'])
          .maybeSingle();
        
        if (record) {
          studentUserId = record.user_id;
        }
      }
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('process_qr_return', {
      p_librarian_id: String(staff.id),
      p_book_qr: bookQr.trim(),
      p_idempotency_key: idempotencyKey ?? null,
      p_preview_only: previewOnly,
    });

    if (error) {
      logger.error('circulation', 'Return RPC error', { error: error.message, bookQr });
      throw new Error(error.message || 'Return failed.');
    }

    const result = (data ?? {}) as {
      ok?: boolean;
      code?: string;
      message?: string;
      borrowing_id?: string;
      book_title?: string;
      student_name?: string;
      reservation_ready?: boolean;
      reserved_for?: string;
      borrowed_at?: string;
      due_date?: string;
      fine_amount?: number | string;
      overdue_days?: number;
    };

    if (!result.ok) {
      logger.warn('circulation', `Return failed: ${result.message}`, { bookQr, code: result.code });
      
      let message = result.message || 'Return failed.';
      if (isManual && message.toLowerCase().includes('not found')) {
        message = 'The identifier is not recognized by the circulation system.';
      }
      
      throw new Error(message);
    }

    if (!previewOnly) {
      const fineAmount = Number(result.fine_amount ?? 0);
      if (settleFine && result.borrowing_id && fineAmount > 0) {
        const settledAt = new Date().toISOString();
        const { error: settleError } = await admin
          .from('borrowing_records')
          .update({ fine_settled_at: settledAt, updated_at: settledAt })
          .eq('id', result.borrowing_id);
        if (settleError) {
          throw new Error(settleError.message || 'Book returned, but failed to settle overdue fine.');
        }
      }

      logger.info('circulation', 'Return successful', { bookQr, librarianId: staff.id });
      await logAuditActivity(
        String(staff.id),
        'book_copy',
        null,
        'return',
        `Returned book '${result.book_title}' from ${result.student_name} (QR: ${bookQr})${
          result.reservation_ready ? ` — reserved for ${result.reserved_for}` : ''
        }${settleFine && fineAmount > 0 ? ` — settled PHP ${fineAmount.toFixed(2)} fine` : ''}`,
        { bookQr, studentName: result.student_name, bookTitle: result.book_title, reservationReady: result.reservation_ready, fineAmount, fineSettled: settleFine && fineAmount > 0 },
        { status: 'BORROWED' },
        { status: 'RETURNED' }
      );

      // Notify the student
      if (studentUserId) {
        await sendNotification({
          userId: studentUserId,
          title: "Book Returned",
          content: `You have successfully returned "${result.book_title}". Thank you!`,
          type: "CIRCULATION",
          priority: "medium",
          metadata: {
            bookTitle: result.book_title,
            returnedAt: new Date().toISOString()
          }
        });
      }

      revalidatePath('/circulation', 'page');
      revalidatePath('/history');
      revalidateTag('catalog', 'max');
      revalidateTag('public-books', 'max');
    }

    return result;
  },
  { 
    allowedRoles: ['super_admin', 'librarian', 'student_assistant'],
    allowedPermissions: ['manage_circulation']
  }
);
