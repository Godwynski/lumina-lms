'use client';

import { use, useState, useTransition, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isOutOfService, type BookDetail, type AvailabilityStatus } from '@/components/catalog/types';
import { CatalogBookDetails } from '@/components/catalog/CatalogBookDetails';
import { CancelReservationDialog } from '@/components/catalog/CancelReservationDialog';

interface Props {
  bookPromise: Promise<BookDetail | null>;
  availabilityPromise: Promise<AvailabilityStatus>;
  id: string;
}

export function StudentBookDetailClient({ bookPromise, availabilityPromise, id }: Props) {
  const router = useRouter();
  const book = use(bookPromise);
  const availability = use(availabilityPromise);
  const [isPending, startTransition] = useTransition();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [supabase] = useState(() => createClient());

  // Debounced router.refresh
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 1500);
  }, [router, startTransition]);

  // Real-time synchronization
  useEffect(() => {
    const channel = supabase
      .channel(`book-detail-${id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'books', 
        filter: `id=eq.${id}` 
      }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'book_copies', 
        filter: `book_id=eq.${id}` 
      }, () => {
        debouncedRefresh();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reservations', 
        filter: `book_id=eq.${id}` 
      }, () => {
        debouncedRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase, debouncedRefresh, id]);

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/20">
          <BookOpen className="h-7 w-7 text-muted-foreground/20" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground/60">Book not found</p>
          <p className="mt-1 text-xs text-muted-foreground">This title may have been removed from the catalog.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/student-catalog">
            <ArrowLeft aria-hidden="true" />
            Back to Catalog
          </Link>
        </Button>
      </div>
    );
  }

  const isAvailable = book.available_copies > 0;
  const canReserve = !availability.hasReservation && !availability.isReady && !isOutOfService(book, availability);

  const handleCancelReservation = () => {
    const resId = availability.reservationId;
    if (!resId) return;
    setCancelDialogOpen(false);
    
    startTransition(async () => {
      try {
        await cancelReservation(resId);
        toast.success('Reservation cancelled', { id: 'reservation-toast' });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel', { id: 'reservation-toast' });
      }
    });
  };

  const handleReserveSuccess = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <>
      <CatalogBookDetails
        book={book}
        availability={availability}
        fullPage
        actions={canReserve ? (
          <ReserveTitleButton
            bookId={id}
            isAvailable={isAvailable}
            hasExistingReservation={false}
            onReserveSuccess={handleReserveSuccess}
            className="min-h-11 w-full sm:w-auto"
          />
        ) : availability.hasReservation ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setCancelDialogOpen(true)}
            className="min-h-11 w-full text-destructive sm:w-auto"
          >
            {isPending ? 'Cancelling…' : 'Cancel Reservation'}
          </Button>
        ) : undefined}
      />
      <CancelReservationDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        bookTitle={book.title}
        isCancelling={isPending}
        onConfirmCancel={handleCancelReservation}
        isReady={availability.isReady}
      />
    </>
  );
}
