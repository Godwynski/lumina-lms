'use server';

import type { Book, BookCopyWithReservation } from '@/lib/types';
import { createSafeAction } from '@/lib/actions/action-utils';
import { revalidateTag, revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { getBookAvailabilityStatus } from '@/lib/actions/reservations';
import { assertStaffCatalogAccess } from './auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMe } from '@/lib/auth-helpers';

export interface RawCopy {
  id: string;
  book_id: string;
  status: string;
  condition: string;
  qr_string: string;
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

export const addBookCopies = createSafeAction(
  z.object({
    bookId: z.string(),
    copiesCount: z.number().min(1).max(50)
  }),
  async ({ bookId, copiesCount }, { supabase }) => {
    const copies = Array.from({ length: copiesCount }).map(() => ({
      book_id: bookId,
      status: 'AVAILABLE'
    }));

    const { error } = await supabase
      .from('book_copies')
      .insert(copies);

    if (error) {
      logger.error('catalog', `Failed to add copies for book ID: ${bookId}`, { error: error.message });
      throw new Error('Failed to add book copies.');
    }

    revalidateTag('catalog', 'max');
    revalidateTag('public-books', 'max');
    revalidateTag(`book-${bookId}`, 'max');
    revalidatePath(`/catalog/${bookId}`);
    
    return [null, {
      reason: `Added ${copiesCount} copies to book ID: ${bookId}`,
      details: { copiesCount }
    }];
  },
  { 
    auditAction: "create", 
    auditEntity: "book_copy", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

export const updateBookCopyStatus = createSafeAction(
  z.object({ 
    id: z.string(), 
    // BORROWED is not settable here: only a checkout creates the loan that goes with it.
    status: z.enum(['AVAILABLE', 'MAINTENANCE', 'LOST'])
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
    if (current.status === 'BORROWED' && status !== 'LOST') {
      throw new Error('This copy is on loan. Use Return first.');
    }

    if (status === 'AVAILABLE' && current.status !== 'AVAILABLE') {
      // Gives the copy to the next student in the queue, or puts it back on the shelf.
      const { error: releaseError } = await createAdminClient().rpc('release_copy', { p_copy_id: id });
      if (releaseError) throw new Error(releaseError.message);
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

    // A lost book stays on record as LOST (not RETURNED), with no return date.
    if (status === 'LOST' && current.status === 'BORROWED') {
      const { error: loanError } = await supabase
        .from('borrowing_records')
        .update({ status: 'LOST', updated_at: new Date().toISOString() })
        .eq('book_copy_id', id)
        .in('status', ['ACTIVE', 'OVERDUE']);
      if (loanError) throw new Error(loanError.message);
    }

    const { data, error } = await supabase
      .from('book_copies')
      .select()
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);

    revalidateTag('catalog', 'max');
    revalidateTag('public-books', 'max');
    revalidateTag(`book-${data.book_id}`, 'max');
    revalidatePath('/catalog');
    revalidatePath(`/catalog/${data.book_id}`);
    
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
        .select('id, title, author, isbn, description, category_id, tags, section, location, cover_url, total_copies, available_copies, categories(name)')
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
  const supabase = await assertStaffCatalogAccess(true);

  const [bookResponse, copiesResponse, queueResponse] = await Promise.all([
    supabase
      .from('books')
      .select(`*, categories(name)`)
      .eq('id', bookId)
      .single(),
    supabase
      .from('book_copies')
      .select(`
        id, book_id, status, condition, qr_string, created_at,
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
      .order('reserved_at', { ascending: true })
  ]);

  if (bookResponse.error) throw new Error(bookResponse.error.message);
  if (copiesResponse.error) throw new Error(copiesResponse.error.message);
  if (queueResponse.error) throw new Error(queueResponse.error.message);

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
      created_at: copy.created_at,
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
