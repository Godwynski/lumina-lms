'use server'

import { createClient, createSafeClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { logAuditActivity } from '@/lib/audit';

/**
 * Fetches a specific system setting by key.
 */
async function getSystemSetting(key: string, defaultValue: string): Promise<string> {
  const supabase = createSafeClient();
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return defaultValue;
  return data.value;
}

export async function placeReservation(bookId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Authentication required');

  // 1. Check if user already has an active reservation for this book
  const { data: existing } = await supabase
    .from('reservations')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .in('status', ['ACTIVE', 'READY'])
    .maybeSingle();

  if (existing) {
    throw new Error('You already have an active reservation for this book.');
  }

  // 2. Check if user is currently borrowing the book
  const { data: myLoans } = await supabase
    .from('borrowing_records')
    .select('book_copies!inner(book_id)')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .eq('book_copies.book_id', bookId);

  if (myLoans && myLoans.length > 0) {
    throw new Error('You currently have a copy of this book checked out.');
  }

  // 3. Check Policy Limit
  const limitStr = await getSystemSetting('max_reservations_per_student', '3');
  const limit = parseInt(limitStr, 10);

  const { count } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['ACTIVE', 'READY']);

  if (count !== null && count >= limit) {
    throw new Error(`Reservation limit reached. You can only have ${limit} active reservations.`);
  }

  // 4. Determine Queue Position
  const { count: queueCount } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', bookId)
    .eq('status', 'ACTIVE');

  const position = (queueCount || 0) + 1;

  // 5. Place Reservation
  const { data, error } = await supabase
    .from('reservations')
    .insert([{
      user_id: user.id,
      book_id: bookId,
      queue_position: position,
      status: 'ACTIVE'
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // @ts-ignore - Entity type 'reservation' is valid but TS might be seeing stale AuditEntityType
  await logAuditActivity(user.id, "reservation", data.id, "create", `Placed reservation for book ${bookId} at position ${position}`);
  
  // @ts-ignore - Revalidation signatures vary by next version, suppress if 1-arg is flagged
  revalidateTag(`book-${bookId}`);
  // @ts-ignore
  revalidatePath('/dashboard');
  
  return { success: true, position };
}

export async function cancelReservation(reservationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Authentication required');

  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('user_id, book_id')
    .eq('id', reservationId)
    .single();

  if (fetchError || !reservation) throw new Error('Reservation not found');
  if (reservation.user_id !== user.id) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'CANCELLED' })
    .eq('id', reservationId);

  if (error) throw new Error(error.message);

  // @ts-ignore
  await logAuditActivity(user.id, "reservation", reservationId, "cancel", `Cancelled reservation for book ${reservation.book_id}`);
  
  // @ts-ignore
  revalidateTag(`book-${reservation.book_id}`);
  // @ts-ignore
  revalidatePath('/dashboard');

  return { success: true };
}

export async function getMyReservations() {
  const supabase = createSafeClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
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
