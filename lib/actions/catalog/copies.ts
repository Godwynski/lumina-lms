'use server';

import type { Book, BookCopyWithReservation } from '@/lib/types';
import { createSafeAction } from '@/lib/actions/action-utils';
import { revalidateTag, revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { getBookAvailabilityStatus } from '@/lib/actions/reservations';
import { assertStaffCatalogAccess } from './auth';

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
    status: z.enum(['AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST']) 
  }),
  async ({ id, status }, { supabase }) => {
    const { data, error } = await supabase
      .from('book_copies')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);

    // If a copy is manually marked as AVAILABLE, MAINTENANCE, or LOST, 
    // we must close any lingering ACTIVE/OVERDUE borrowing records to prevent DB inconsistency.
    if (['AVAILABLE', 'MAINTENANCE', 'LOST'].includes(status)) {
      await supabase
        .from('borrowing_records')
        .update({ 
          status: 'RETURNED', 
          returned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('book_copy_id', id)
        .in('status', ['ACTIVE', 'OVERDUE']);
    }
    
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
  const [book, availability] = await Promise.all([
    getPublicBookById(bookId),
    getBookAvailabilityStatus(bookId),
  ]);
  return { book: book as Book, availability };
}

/**
 * Consolidated action to fetch all data needed for the admin management view in one round-trip.
 * Combines book copies (with active reservations) and the full reservation queue.
 */
export async function getBookAdminDetails(bookId: string) {
  const supabase = await assertStaffCatalogAccess();

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
