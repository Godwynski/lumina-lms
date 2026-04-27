'use server';
import { createClient } from '@/lib/supabase/server';
import { createSafeAction } from './action-utils';
import { z } from 'zod';

// ... Removed unused getSystemSetting helper
/**
 * Automatically expires READY reservations that have passed their hold deadline
 * and assigns the book copy to the next student in the queue.
 * Should only be called from reservation placement or via a scheduled job —
 * NOT from every read call.
 */

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

    // If READY, we need to: (1) release the copy, (2) promote next in queue
    if (reservation.status === 'READY' && reservation.copy_id) {
      // Check if anyone else is ACTIVE in the queue for this book
      const { data: nextInQueue } = await supabase
        .from('reservations')
        .select('id')
        .eq('book_id', reservation.book_id)
        .eq('status', 'ACTIVE')
        .order('queue_position', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextInQueue) {
        // Promote the next person: assign the copy and set hold timer
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
            copy_id: reservation.copy_id,
            hold_expires_at: expiryDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', nextInQueue.id);
      } else {
        // Nobody waiting — release copy back to the shelf
        await supabase
          .from('book_copies')
          .update({ status: 'AVAILABLE', updated_at: new Date().toISOString() })
          .eq('id', reservation.copy_id);
      }
    }

    // Maintenance: reorder queue positions (await directly to avoid build issues with 'after' in client-imported files)
    try {
      await supabase.rpc('compress_reservation_queue', { p_book_id: reservation.book_id });
    } catch (err) {
      console.error('Reservation maintenance failed:', err);
    }

    const { revalidatePath, revalidateTag } = await import('next/cache');
    revalidateTag(`book-${reservation.book_id}`, 'default');
    revalidatePath('/dashboard');
    revalidatePath('/student-catalog');

    return { success: true };
  },
  {
    auditAction: "cancel",
    auditEntity: "reservation",
    allowedRoles: ['admin', 'librarian', 'staff', 'student']
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
