'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useBookDetailRealtime(bookId: string | null, refresh: () => void) {
  useEffect(() => {
    if (!bookId) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 500);
    };
    const supabase = createClient();
    const channel = supabase
      .channel(`book-detail-${bookId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books', filter: `id=eq.${bookId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_copies', filter: `book_id=eq.${bookId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `book_id=eq.${bookId}` }, refreshSoon)
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [bookId, refresh]);
}
