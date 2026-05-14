'use server';
import { createClient } from '@/lib/supabase/server';
import { createSafeAction } from './action-utils';
import { z } from 'zod';

// ... Removed unused getSystemSetting helper
/**
 * Automatically expires READY reservations that have passed their hold deadline
 * and assigns the book copy to the next student in the queue.
 * Should be called from reservation placement, returns, or via a scheduled job.
 */
export async function cleanupAndReassignReservations(bookId: string) {
  const supabase = await createClient();

  // 1. Find expired READY reservations for this book
  const { data: expired } = await supabase
    .from('reservations')
    .select('id, copy_id')
    .eq('book_id', bookId)
    .eq('status', 'READY')
    .lt('hold_expires_at', new Date().toISOString());

  if (!expired || expired.length === 0) return;

  for (const res of expired) {
    // A. Expire the current hold
    await supabase
      .from('reservations')
      .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
      .eq('id', res.id);

    if (res.copy_id) {
      // B. Find next in line
      const { data: nextInQueue } = await supabase
        .from('reservations')
        .select('id')
        .eq('book_id', bookId)
        .eq('status', 'ACTIVE')
        .order('queue_position', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextInQueue) {
        // C. Promote next person
        const { data: holdData } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'hold_expiry_days')
          .single();

        const holdDays = parseInt(holdData?.value ?? '3', 10);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + holdDays);

        await supabase
          .from('reservations')
          .update({
            status: 'READY',
            copy_id: res.copy_id,
            hold_expires_at: expiryDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', nextInQueue.id);
      } else {
        // D. No one waiting - return copy to shelf
        await supabase
          .from('book_copies')
          .update({ status: 'AVAILABLE', updated_at: new Date().toISOString() })
          .eq('id', res.copy_id);
      }
    }
  }

  // Final maintenance
  await supabase.rpc('compress_reservation_queue', { p_book_id: bookId });
}

export async function getBookAvailabilityStatus(bookId: string) {
  const supabase = await createClient();
  
  // NOTE: cleanup is NOT triggered here to avoid excessive background tasks
  // on every catalog page load. It is triggered on reservation placement.

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  // 1. Get earliest due date for this book
  const { data: borrows, error } = await supabase
    .from('borrowing_records')
    .select('due_date, book_copies!inner(book_id)')
    .eq('book_copies.book_id', bookId)
    .eq('status', 'ACTIVE')
    .order('due_date', { ascending: true })
    .limit(1);

  let nextAvailableDate: string | null = null;
  if (!error && borrows && borrows.length > 0) {
    nextAvailableDate = borrows[0].due_date;
  }

  // 2. Check if current user has an active/ready reservation
  let hasReservation = false;
  let isReady = false;
  let queuePosition: number | null = null;
  let holdExpiresAt: string | null = null;

  let userRes = null;
  if (user) {
    const { data: reservationData } = await supabase
      .from('reservations')
      .select('id, status, hold_expires_at, queue_position')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .in('status', ['ACTIVE', 'READY'])
      .maybeSingle();
    userRes = reservationData;
    
    if (userRes) {
      hasReservation = true;
      if (userRes.status === 'READY') {
        isReady = true;
        nextAvailableDate = userRes.hold_expires_at;
        holdExpiresAt = userRes.hold_expires_at;
      } else if (userRes.status === 'ACTIVE') {
        queuePosition = userRes.queue_position;
      }
    }
  }

  return {
    nextAvailableDate,
    hasReservation,
    isReady,
    queuePosition,
    holdExpiresAt,
    reservationId: userRes?.id || null
  };
}

export const cancelReservation = createSafeAction(
  z.string(),
  async (reservationId, { supabase, userId }) => {
    // Fetch reservation including status and copy_id so we can release if READY
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('user_id, book_id, status, copy_id')
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) throw new Error('Reservation not found');
    if (reservation.user_id !== userId) throw new Error('Unauthorized');

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', reservationId);

    if (error) throw new Error(error.message);

    if (reservation.status === 'READY' && reservation.copy_id) {
      await cleanupAndReassignReservations(reservation.book_id);
    }

    const { revalidatePath, revalidateTag } = await import('next/cache');
    revalidateTag(`book-${reservation.book_id}`, 'default');
    revalidatePath('/dashboard');
    revalidatePath('/student-catalog');

    return [{ success: true }, {
      reason: `Cancelled reservation for book: ${reservation.book_id}`,
      oldValue: { status: reservation.status },
      newValue: { status: 'CANCELLED' },
      details: { bookId: reservation.book_id }
    }];
  },
  {
    auditAction: "cancel",
    auditEntity: "reservation",
    allowedRoles: ['admin', 'librarian', 'student_assistant', 'student']
  }
);

export const staffCancelReservation = createSafeAction(
  z.string(),
  async (reservationId, { supabase }) => {
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('user_id, book_id, status, copy_id')
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) throw new Error('Reservation not found');

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', reservationId);

    if (error) throw new Error(error.message);

    if (reservation.status === 'READY' && reservation.copy_id) {
      await cleanupAndReassignReservations(reservation.book_id);
    }

    const { revalidatePath, revalidateTag } = await import('next/cache');
    revalidateTag(`book-${reservation.book_id}`, 'default');
    revalidatePath('/dashboard');
    revalidatePath('/catalog');

    return [{ success: true }, {
      reason: `Staff cancelled reservation for book: ${reservation.book_id}`,
      oldValue: { status: reservation.status },
      newValue: { status: 'CANCELLED' },
      details: { reservationId, reserverId: reservation.user_id }
    }];
  },
  {
    auditAction: "cancel",
    auditEntity: "reservation",
    allowedRoles: ['admin', 'librarian', 'student_assistant'],
    allowedPermissions: ['manage_circulation']
  }
);

export async function getMyReservations() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) return [];

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id,
      status,
      queue_position,
      hold_expires_at,
      books (
        id,
        title,
        author,
        cover_url
      )
    `)
    .eq('user_id', user.id)
    .in('status', ['ACTIVE', 'READY'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}
