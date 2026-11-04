'use server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSafeAction } from './action-utils';
import { z } from 'zod';

export async function getBookAvailabilityStatus(bookId: string) {
  const supabase = await createClient();
  
  // NOTE: cleanup is NOT triggered here to avoid excessive background tasks
  // on every catalog page load. It is triggered on reservation placement.

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  // 1. Earliest due date for this book (an RPC, since RLS hides other students' loans)
  const { data: nextDue, error } = await supabase.rpc('get_next_due_date', { p_book_id: bookId });
  let nextAvailableDate: string | null = !error && nextDue ? (nextDue as string) : null;

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
      if (userRes.status?.toUpperCase() === 'READY') {
        isReady = true;
        nextAvailableDate = userRes.hold_expires_at;
        holdExpiresAt = userRes.hold_expires_at;
      } else if (userRes.status?.toUpperCase() === 'ACTIVE') {
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
  async (reservationId, { supabase: _supabase, userId }) => {
    const adminClient = createAdminClient();

    // Fetch reservation including status and copy_id so we can release if READY
    const { data: reservation, error: fetchError } = await adminClient
      .from('reservations')
      .select('user_id, book_id, status, copy_id')
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) throw new Error('Reservation not found');
    if (reservation.user_id !== userId) throw new Error('Unauthorized');

    const { error } = await adminClient
      .from('reservations')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', reservationId);

    if (error) throw new Error(error.message);

    if (reservation.status?.toUpperCase() === 'READY' && reservation.copy_id) {
      // Gives the held copy to the next in line (or back to the shelf) and compacts the queue.
      const { error: releaseError } = await adminClient.rpc('release_copy', { p_copy_id: reservation.copy_id });
      if (releaseError) throw new Error(releaseError.message);
    } else {
      await adminClient.rpc('compress_reservation_queue', { p_book_id: reservation.book_id });
    }

    const { revalidatePath, revalidateTag } = await import('next/cache');
    revalidateTag(`book-${reservation.book_id}`, 'max');
    revalidateTag('public-books', 'max');
    revalidatePath('/dashboard', 'page');
    revalidatePath('/student-catalog', 'page');

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
    allowedRoles: ['super_admin', 'librarian', 'student_assistant', 'student']
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
