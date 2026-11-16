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
import { computeOverdueFine } from '@/lib/fines';

export interface BorrowingBlock {
  overdueCount: number;
  receivableTotal: number;
}

/**
 * Computes borrowing eligibility metrics (overdue loans & unsettled receivable fines)
 * without throwing for overdue/fine blocks. Still throws if profile is missing/inactive.
 */
async function checkUserBorrowingEligibility(
  supabase: SupabaseClient,
  userId: string,
  options: { skipProfileCheck?: boolean } = {}
): Promise<BorrowingBlock> {
  if (!options.skipProfileCheck) {
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
  }

  const [{ data: records, error: recordsError }, { data: setting }] = await Promise.all([
    supabase
      .from('borrowing_records')
      .select('id, status, due_date, returned_at, fine_amount, fine_settled_at')
      .eq('user_id', userId)
      .or('status.in.(ACTIVE,OVERDUE),fine_settled_at.is.null'),
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'overdue_fine_per_day')
      .maybeSingle(),
  ]);

  if (recordsError) {
    throw new Error('Failed to verify borrowing history.');
  }

  const parsedRate = setting?.value != null && setting.value !== '' ? Number(setting.value) : 5;
  const fineRate = Number.isNaN(parsedRate) ? 5 : parsedRate;
  const nowMs = Date.now();

  let overdueCount = 0;
  let receivableTotal = 0;

  for (const row of records ?? []) {
    const status = String(row.status ?? '').toUpperCase();
    const dueMs = new Date(row.due_date).getTime();
    const isOverdue =
      status === 'OVERDUE' ||
      (status === 'ACTIVE' && !Number.isNaN(dueMs) && dueMs < nowMs);
    if (isOverdue) {
      overdueCount += 1;
    }

    if (row.fine_settled_at == null && (row.fine_amount != null || status === 'ACTIVE' || status === 'OVERDUE')) {
      const fine = computeOverdueFine(
        {
          due_date: row.due_date,
          returned_at: row.returned_at ?? null,
          status: row.status,
          fine_amount: row.fine_amount,
        },
        fineRate
      );
      if (fine > 0) {
        receivableTotal = Number((receivableTotal + fine).toFixed(2));
      }
    }
  }

  return { overdueCount, receivableTotal };
}

function formatBlockErrorMessage(block: BorrowingBlock): string {
  if (block.overdueCount > 0 && block.receivableTotal > 0) {
    return `User has ${block.overdueCount} overdue book(s) and ₱${block.receivableTotal.toFixed(2)} in unpaid fines. Please settle them before borrowing more.`;
  }
  if (block.overdueCount > 0) {
    return `User has ${block.overdueCount} overdue book(s). Please return them before borrowing more.`;
  }
  return `User has ₱${block.receivableTotal.toFixed(2)} in unpaid fines. Please settle them before borrowing more.`;
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
  async ({ scanValue, expectedType, isManual }, { supabase, userId: staffUserId }) => {
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
        if (card.user_id === staffUserId) {
          throw new Error('You cannot check out a book to yourself. Another staff member must process your checkout.');
        }

        // Validation logic
        if (card.status?.toUpperCase() !== 'ACTIVE') {
          throw new Error('Library card is not active.');
        }

        const profile = Array.isArray(card.profiles) ? card.profiles[0] : card.profiles;
        if (profile?.status?.toUpperCase() !== 'ACTIVE') {
          throw new Error(`Patron account is ${profile?.status?.toLowerCase() || 'inactive'}.`);
        }

        const block = await checkUserBorrowingEligibility(supabase, card.user_id, {
          skipProfileCheck: true,
        });

        return {
          type: 'student',
          data: {
            cardNumber: card.card_number,
            status: card.status,
            userId: card.user_id,
            fullName: profile?.full_name ?? 'Patron',
            studentId: profile?.student_id ?? 'N/A',
            block,
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
  { allowedRoles: ['super_admin', 'librarian', 'library_staff'], allowedPermissions: ['manage_circulation'] }
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
    isManual: z.boolean().default(false),
    overrideReason: z
      .string()
      .trim()
      .min(10, 'Override reason must be at least 10 characters.')
      .max(300, 'Override reason must be 300 characters or fewer.')
      .optional()
      .nullable(),
  }),
  async ({ studentCardQr, bookQr, idempotencyKey, previewOnly, isManual, overrideReason }, { supabase, profile: staff, role: staffRole }) => {
    const trimmedOverride = overrideReason?.trim() || null;

    // 1. Pre-validation: Eligibility & Override Check (only if not preview)
    let studentUserId: string | null = null;
    let eligibility: BorrowingBlock = { overdueCount: 0, receivableTotal: 0 };
    let isBlocked = false;

    if (!previewOnly) {
       if (trimmedOverride && staffRole !== 'librarian' && staffRole !== 'super_admin') {
         throw new Error('Only librarians and super admins can override borrowing blocks.');
       }

       // First resolve the student to get user_id
       const { data: card } = await supabase
         .from('library_cards')
         .select('user_id')
         .eq('card_number', studentCardQr.trim())
         .single();
       
       if (card) {
         if (card.user_id === String(staff.id)) {
           throw new Error('You cannot check out a book to yourself. Another staff member must process your checkout.');
         }
         studentUserId = card.user_id;
         eligibility = await checkUserBorrowingEligibility(supabase, card.user_id);
         isBlocked = eligibility.overdueCount > 0 || eligibility.receivableTotal > 0;
         if (isBlocked && !trimmedOverride) {
           throw new Error(formatBlockErrorMessage(eligibility));
         }
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
        { studentCardQr, bookQr, student_user_id: studentUserId, studentName: result.student_name, bookTitle: result.book_title },
        null,
        { status: 'ACTIVE', book_qr: bookQr }
      );

      if (isBlocked && trimmedOverride) {
        await logAuditActivity(
          String(staff.id),
          'borrowing_record',
          result.borrowing_id || null,
          'checkout_override',
          trimmedOverride,
          {
            studentCardQr,
            bookQr,
            student_user_id: studentUserId,
            studentName: result.student_name,
            bookTitle: result.book_title,
            overdueCount: eligibility.overdueCount,
            receivableTotal: eligibility.receivableTotal,
          },
          {
            blocked: true,
            overdueCount: eligibility.overdueCount,
            receivableTotal: eligibility.receivableTotal,
          },
          { overridden: true, reason: trimmedOverride }
        );
      }

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
    allowedRoles: ['super_admin', 'librarian', 'library_staff'],
    allowedPermissions: ['manage_circulation']
  }
);

/**
 * Processes a book return.
 */
export const returnBook = createSafeAction(
  z
    .object({
      bookQr: z.string().min(1),
      idempotencyKey: z.string().optional(),
      previewOnly: z.boolean().optional().default(false),
      isManual: z.boolean().default(false),
      settleFine: z.boolean().optional().default(false),
      resolution: z.enum(['PAID', 'CONDONED']).optional().default('PAID'),
      remarks: z.string().trim().max(500).optional().nullable(),
    })
    .superRefine((val, ctx) => {
      if (!val.previewOnly && val.settleFine && val.resolution === 'CONDONED') {
        const trimmed = (val.remarks ?? '').trim();
        if (trimmed.length < 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['remarks'],
            message: 'Remarks of at least 5 characters are required when condoning a fine.',
          });
        }
      }
    }),
  async ({ bookQr, idempotencyKey, previewOnly, isManual, settleFine, resolution, remarks }, { supabase, profile: staff }) => {
    // Find the current borrower to notify them
    let studentUserId: string | null = null;
    let returnCopy: { id: string; book_id: string } | null = null;
    if (!previewOnly) {
      const { data: copy } = await supabase
        .from('book_copies')
        .select('id,book_id')
        .eq('qr_string', bookQr.trim())
        .maybeSingle();
      
      if (copy) {
        returnCopy = copy;
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
      idempotent?: boolean;
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

    if (!previewOnly && !result.idempotent) {
      const fineAmount = Number(result.fine_amount ?? 0);
      const trimmedRemarks = remarks?.trim() || null;
      const settledDuringReturn = settleFine && Boolean(result.borrowing_id) && fineAmount > 0;
      if (settledDuringReturn) {
        const settledAt = new Date().toISOString();
        const { error: settleError } = await admin
          .from('borrowing_records')
          .update({
            fine_settled_at: settledAt,
            fine_resolution: resolution,
            fine_remarks: trimmedRemarks,
            fine_settled_by: staff.id,
            updated_at: settledAt,
          })
          .eq('id', result.borrowing_id!)
          .is('fine_settled_at', null);
        if (settleError) {
          throw new Error(settleError.message || 'Book returned, but failed to settle overdue fine.');
        }
      }

      const resolutionLabel = resolution === 'CONDONED' ? 'Condoned' : 'Paid';
      const remarkSuffix = trimmedRemarks ? ` — Remarks: ${trimmedRemarks}` : '';
      const fineAuditSuffix = settledDuringReturn
        ? ` — ${resolutionLabel} PHP ${fineAmount.toFixed(2)} fine${remarkSuffix}`
        : '';

      logger.info('circulation', 'Return successful', { bookQr, librarianId: staff.id });
      await logAuditActivity(
        String(staff.id),
        'book_copy',
        returnCopy?.id || null,
        'return',
        `Returned book '${result.book_title}' from ${result.student_name} (QR: ${bookQr})${
          result.reservation_ready ? ` — reserved for ${result.reserved_for}` : ''
        }${fineAuditSuffix}`,
        {
          bookQr,
          book_id: returnCopy?.book_id,
          book_copy_id: returnCopy?.id,
          student_user_id: studentUserId,
          studentName: result.student_name,
          bookTitle: result.book_title,
          reservationReady: result.reservation_ready,
          fineAmount,
          fineSettled: settledDuringReturn,
          ...(settledDuringReturn
            ? { fineResolution: resolution, fineRemarks: trimmedRemarks }
            : {}),
        },
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
      revalidatePath('/dashboard');
      revalidateTag('catalog', 'max');
      revalidateTag('public-books', 'max');
    }

    return result;
  },
  { 
    allowedRoles: ['super_admin', 'librarian', 'library_staff'],
    allowedPermissions: ['manage_circulation']
  }
);
