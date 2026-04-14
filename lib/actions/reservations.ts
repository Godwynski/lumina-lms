'use server'

import { createClient, createSafeClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { logAuditActivity } from '@/lib/audit';

// ... Removed unused getSystemSetting helper
/**
 * Automatically expires READY reservations that have passed their hold deadline
 * and assigns the book copy to the next student in the queue.
 * Should only be called from reservation placement or via a scheduled job —
 * NOT from every read call.
 */
export async function cleanupAndReassignReservations() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // 1. Find expired READY reservations
  const { data: expiredHolds } = await supabase
    .from('reservations')
    .select('id, book_id, copy_id, user_id')
    .eq('status', 'READY')
    .lt('hold_expires_at', now);

  if (!expiredHolds || expiredHolds.length === 0) return;

  for (const hold of expiredHolds) {
    // 2. Mark current as EXPIRED
    await supabase
      .from('reservations')
      .update({ status: 'EXPIRED', updated_at: now })
      .eq('id', hold.id);

    // 3. Find next student in queue for the same book
    const { data: nextGuest } = await supabase
      .from('reservations')
      .select('id, user_id')
      .eq('book_id', hold.book_id)
      .eq('status', 'ACTIVE')
      .order('queue_position', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextGuest && hold.copy_id) {
       // 4. Transfer the hold to the next student
       const holdDaysStr = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'hold_expiry_days')
        .single()
        .then(res => res.data?.value || '7');
      
      const holdDays = parseInt(holdDaysStr, 10);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + holdDays);

      await supabase
        .from('reservations')
        .update({ 
          status: 'READY', 
          fulfilled_at: now,
          hold_expires_at: expiryDate.toISOString(),
          copy_id: hold.copy_id,
          updated_at: now
        })
        .eq('id', nextGuest.id);

      await logAuditActivity(
        '00000000-0000-0000-0000-000000000000', // System automated
        'reservation',
        nextGuest.id,
        'reassign',
        `Reassigned expired hold for book ID ${hold.book_id} to next student in queue.`
      );
    } else if (hold.copy_id) {
      // 5. No one else waiting, release book to general stack
      await supabase
        .from('book_copies')
        .update({ status: 'AVAILABLE', updated_at: now })
        .eq('id', hold.copy_id);
      
      await logAuditActivity(
        '00000000-0000-0000-0000-000000000000',
        'book_copy',
        hold.copy_id,
        'release',
        `Released book ID ${hold.book_id} back to AVAILABLE after hold expired.`
      );
    }
  }

  revalidatePath('/student-catalog');
  revalidatePath('/dashboard');
}

export async function getBookAvailabilityStatus(bookId: string) {
  const supabase = createSafeClient();
  
  // NOTE: cleanup is NOT triggered here to avoid excessive background tasks
  // on every catalog page load. It is triggered on reservation placement
  // and via the heartbeat route.

  const { data: { user } } = await supabase.auth.getUser();

  // 1. Get earliest due date for this book
  const { data: loans, error } = await supabase
    .from('borrowing_records')
    .select('due_date, book_copies!inner(book_id)')
    .eq('book_copies.book_id', bookId)
    .eq('status', 'ACTIVE')
    .order('due_date', { ascending: true })
    .limit(1);

  let nextAvailableDate: string | null = null;
  if (!error && loans && loans.length > 0) {
    nextAvailableDate = loans[0].due_date;
  }

  // 2. Check if current user has an active/ready reservation
  let hasReservation = false;
  let isReady = false;
  let queuePosition: number | null = null;
  let holdExpiresAt: string | null = null;

  let userRes = null;
  if (user) {
    const { data } = await supabase
      .from('reservations')
      .select('id, status, hold_expires_at, queue_position')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .in('status', ['ACTIVE', 'READY'])
      .maybeSingle();
    userRes = data;
    
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

export async function cancelReservation(reservationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Authentication required');

  // Fetch reservation including status and copy_id so we can release if READY
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('user_id, book_id, status, copy_id')
    .eq('id', reservationId)
    .single();

  if (fetchError || !reservation) throw new Error('Reservation not found');
  if (reservation.user_id !== user.id) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', reservationId);

  if (error) throw new Error(error.message);

  // Trigger non-blocking maintenance tasks
  after(async () => {
    try {
      // 1. Reorder queue to remove the gap left by this cancellation
      await supabase.rpc('compress_reservation_queue', { p_book_id: reservation.book_id });
      
      // 2. Log activity
      await logAuditActivity(user.id, "reservation", reservationId, "cancel", `Cancelled reservation for book ${reservation.book_id}`);

      // 3. If was READY, promote next person
      if (reservation.status === 'READY') {
        await cleanupAndReassignReservations();
      }
    } catch (err) {
      console.error('Reservation after-cancel maintenance failed:', err);
    }
  });
  
  revalidateTag(`book-${reservation.book_id}`, 'page');
  revalidatePath('/dashboard', 'page');

  return { success: true };
}

export async function getMyReservations() {
  const supabase = createSafeClient();
  const { data: { user } } = await supabase.auth.getUser();

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
