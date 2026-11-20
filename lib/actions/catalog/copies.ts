'use server';

import type { Book, BookCopyStatus, BookCopyWithReservation } from '@/lib/types';
import { createSafeAction } from '@/lib/actions/action-utils';
import { revalidateTag, revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { getBookAvailabilityStatus } from '@/lib/actions/reservations';
import { getCatalogStaff } from './auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth-helpers';
import { copyAcquisitionSchema, copyDispositionSchema, hasCopyAcquisition, libraryDate, type CopyLifecycle } from '@/lib/copy-acquisition';

export interface RawCopy {
  id: string;
  book_id: string;
  status: string;
  condition: string;
  qr_string: string;
  accession_number: string;
  created_at: string;
  reservations?: Array<{
    id: string;
    status: string;
    queue_position: number;
    hold_expires_at: string;
    profiles: Record<string, unknown> | null;
  }>;
}

export interface AdminReservationQueueEntry {
  id: string;
  status: string;
  queue_position: number;
  hold_expires_at: string | null;
  reserved_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    student_id: string | null;
  } | {
    full_name: string | null;
    email: string | null;
    student_id: string | null;
  }[] | null;
}

function refreshBookInventory(bookId: string) {
  revalidateTag('catalog', 'max');
  revalidateTag('books', 'max');
  revalidateTag('public-books', 'max');
  revalidateTag(`book-${bookId}`, 'max');
  revalidatePath('/inventory');
  revalidatePath(`/student-catalog/${bookId}`);
}

export const addBookCopies = createSafeAction(
  z.object({
    bookId: z.string(),
    copiesCount: z.number().int().min(1).max(50),
    acquisition: copyAcquisitionSchema.optional(),
  }),
  async ({ bookId, copiesCount, acquisition }, { supabase }) => {
    const { data, error } = hasCopyAcquisition(acquisition)
      ? await createAdminClient().rpc('create_book_copy_batch', {
        p_copies: Array.from({ length: copiesCount }, () => ({ book_id: bookId, acquisition })),
      })
      : await supabase.from('book_copies').insert(
        Array.from({ length: copiesCount }, () => ({ book_id: bookId, status: 'AVAILABLE' })),
      ).select('id');

    if (error) {
      logger.error('catalog', `Failed to add copies for book ID: ${bookId}`, { error: error.message });
      throw new Error('Failed to add book copies.');
    }

    refreshBookInventory(bookId);
    const copyIds = (data as { id: string }[] | null)?.map(copy => copy.id) ?? [];
    
    return [null, {
      reason: `Added ${copiesCount} copies to book ID: ${bookId}`,
      entityId: copyIds.length === 1 ? copyIds[0] : null,
      details: { book_id: bookId, copiesCount, copyIds, ...(hasCopyAcquisition(acquisition) ? { acquisition } : {}) }
    }];
  },
  { 
    auditAction: "create", 
    auditEntity: "book_copy", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

type CopyChangeResult = { id: string; bookId: string; status: BookCopyStatus; queueWaiting: boolean };

async function saveCopyChange(actorId: string, copyId: string, change: object) {
  const { data, error } = await createAdminClient().rpc('change_book_copy_lifecycle', {
    p_actor: actorId, p_copy_id: copyId, p_change: change,
  });
  if (error || !data) throw new Error(error?.message ?? 'Could not save the copy details.');
  return data as CopyChangeResult;
}

export const updateCopyAcquisition = createSafeAction(
  z.object({ id: z.string().min(1), acquisition: copyAcquisitionSchema }),
  ({ id, acquisition }, { userId }) => saveCopyChange(userId, id, { acquisition }),
  { allowedRoles: ['super_admin', 'librarian'] },
);

export const recordCopyDisposition = createSafeAction(
  copyDispositionSchema,
  async ({ id, ...change }, { userId }) => {
    const saved = await saveCopyChange(userId, id, change);
    refreshBookInventory(saved.bookId);
    revalidatePath('/circulation');
    revalidatePath('/history');
    revalidatePath('/dashboard');
    return saved;
  },
  { allowedRoles: ['super_admin', 'librarian'] },
);

const updateRoutineCopyStatus = createSafeAction(
  z.object({ 
    id: z.string(), 
    status: z.enum(['AVAILABLE', 'MAINTENANCE'])
  }),
  async ({ id, status }, { supabase }) => {
    const { data: current, error: currentError } = await supabase
      .from('book_copies')
      .select('status')
      .eq('id', id)
      .single();
    if (currentError || !current) throw new Error(currentError?.message || 'Copy not found');

    // Loans and holds own these copies; changing them here would leave the loan or hold wrong.
    if (current.status === 'RESERVED') {
      throw new Error('This copy is on hold for a student. Cancel the hold or check it out first.');
    }
    if (current.status === 'BORROWED') {
      throw new Error('This copy is on loan. Use Return first.');
    }
    if (current.status === 'SOLD' || current.status === 'DONATED_OUT') {
      throw new Error('This copy has already left circulation.');
    }

    if (current.status === 'LOST') {
      // A found book must go through Return so the lost loan is closed and its fine counted.
      const { data: openLoans, error: loanLookupError } = await supabase
        .from('borrowing_records')
        .select('id')
        .eq('book_copy_id', id)
        .eq('status', 'LOST')
        .is('returned_at', null)
        .limit(1);
      if (loanLookupError) throw new Error(loanLookupError.message);
      if (openLoans?.length) {
        throw new Error('This copy is still on a lost loan. Scan it at the return desk to close the loan.');
      }
    }

    if (status === 'AVAILABLE' && current.status !== 'AVAILABLE') {
      // Gives the copy to the next student in the queue, or puts it back on the shelf.
      const { data: released, error: releaseError } = await createAdminClient().rpc('recover_book_copy', {
        p_copy_id: id, p_expected_status: current.status,
      });
      if (releaseError) throw new Error(releaseError.message);
      if (released?.ok === false) throw new Error('This copy changed. Refresh and try again.');
    } else {
      // Only if the status is still what we checked, so a checkout in between isn't overwritten.
      const { data: updated, error } = await supabase
        .from('book_copies')
        .update({ status })
        .eq('id', id)
        .eq('status', current.status)
        .select('id');
      if (error) throw new Error(error.message);
      if (!updated?.length) throw new Error('The copy changed while you were editing. Refresh and try again.');
    }

    const { data, error } = await supabase
      .from('book_copies')
      .select()
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);

    refreshBookInventory(data.book_id);
    
    return [data, {
      reason: `Changed book copy status to ${status}`,
      newValue: { status },
      details: { copyId: id }
    }];
  },
  { 
    auditAction: "update_status", 
    auditEntity: "book_copy", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

export async function updateBookCopyStatus(input: unknown) {
  const legacyLoss = z.object({ id: z.string(), status: z.literal('LOST') }).safeParse(input);
  if (!legacyLoss.success) return updateRoutineCopyStatus(input);

  const result = await recordCopyDisposition({ ...legacyLoss.data, occurredOn: libraryDate() });
  if (!result.success) return result;
  const supabase = await createClient();
  const { data, error } = await supabase.from('book_copies').select().eq('id', result.data.id).single();
  return error ? { success: false as const, error: error.message } : { success: true as const, data };
}

/**
 * Consolidated action for student book detail view.
 */
export async function getBookPublicDetails(bookId: string) {
  let [book, availability] = await Promise.all([
    getPublicBookById(bookId),
    getBookAvailabilityStatus(bookId),
  ]);
  // Staff history may reference archived titles excluded from the public catalog.
  if (!book) {
    const me = await getMe();
    if (me?.isStaff) {
      const { data, error } = await me.supabase.from('books')
        .select('id, title, author, isbn, description, dewey_decimal, category_id, tags, section, location, cover_url, total_copies, available_copies, categories(name)')
        .eq('id', bookId).maybeSingle();
      if (error) throw new Error(error.message);
      book = data;
    }
  }
  return { book: book as Book, availability };
}

/**
 * Consolidated action to fetch all data needed for the admin management view in one round-trip.
 * Combines book copies (with active reservations) and the full reservation queue.
 */
export async function getBookAdminDetails(bookId: string) {
  const staff = await getCatalogStaff(true);
  const { supabase } = staff;
  const canReadLifecycle = staff.profile?.status?.toUpperCase() === 'ACTIVE' &&
    (staff.role === 'librarian' || staff.role === 'super_admin');

  const [bookResponse, copiesResponse, queueResponse, lifecycleResponse] = await Promise.all([
    supabase
      .from('books')
      .select(`*, categories(name)`)
      .eq('id', bookId)
      .maybeSingle(),
    supabase
      .from('book_copies')
      .select(`
        id, book_id, status, condition, qr_string, accession_number, created_at,
        reservations!copy_id (
          id,
          status,
          queue_position,
          hold_expires_at,
          profiles!user_id (
            id,
            full_name,
            email,
            student_id
          )
        )
      `)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false }),
    supabase
      .from('reservations')
      .select(`
        id,
        status,
        queue_position,
        hold_expires_at,
        reserved_at,
        copy_id,
        profiles!user_id (
          id,
          full_name,
          email,
          student_id,
          avatar_url
        ),
        book_copies!copy_id (
          qr_string
        )
      `)
      .eq('book_id', bookId)
      .in('status', ['READY', 'ACTIVE'])
      .order('status', { ascending: false })
      .order('queue_position', { ascending: true })
      .order('reserved_at', { ascending: true }),
    canReadLifecycle ? createAdminClient().from('book_copy_lifecycle')
      .select('copy_id, acquisition_method, acquired_on, purchase_price, disposition_on, sale_amount, last_lost_on, book_copies!inner(book_id)')
      .eq('book_copies.book_id', bookId) : null,
  ]);

  if (bookResponse.error) throw new Error(bookResponse.error.message);
  if (copiesResponse.error) throw new Error(copiesResponse.error.message);
  if (queueResponse.error) throw new Error(queueResponse.error.message);
  if (lifecycleResponse?.error) throw new Error(lifecycleResponse.error.message);
  if (!bookResponse.data) return { book: null, copies: [], queue: [] };
  const lifecycleByCopy = new Map<string, CopyLifecycle>(
    (lifecycleResponse?.data ?? []).map(({ copy_id, book_copies: _book, ...details }) => [copy_id, details]),
  );

  const normalizedCopies = ((copiesResponse.data ?? []) as unknown as RawCopy[]).map((copy) => {
    const activeRes = copy.reservations?.find(
      (r) => r.status === 'READY' || r.status === 'ACTIVE'
    );
    return {
      id: copy.id,
      book_id: copy.book_id,
      status: copy.status,
      condition: copy.condition,
      qr_string: copy.qr_string,
      accession_number: copy.accession_number,
      created_at: copy.created_at,
      ...(canReadLifecycle ? { lifecycle: lifecycleByCopy.get(copy.id) ?? null } : {}),
      reservation: activeRes ? {
        id: activeRes.id,
        status: activeRes.status,
        queue_position: activeRes.queue_position,
        hold_expires_at: activeRes.hold_expires_at,
        profiles: activeRes.profiles || null
      } : null
    };
  }) as BookCopyWithReservation[];

  return {
    book: bookResponse.data as unknown as Book,
    copies: normalizedCopies,
    queue: (queueResponse.data ?? []) as unknown as AdminReservationQueueEntry[]
  };
}
