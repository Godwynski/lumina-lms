'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getBookAdminDetails, getBookPublicDetails } from '@/lib/actions/catalog';
import { cn } from '@/lib/utils';
import type { Book, BookCopyWithReservation } from '@/lib/types';
import { useBookDetailRealtime } from '@/hooks/use-book-detail-realtime';
import { AdminManagementContent } from './AdminManagementContent';
import { isOutOfService, type BookDetail, type AvailabilityStatus } from './types';
import { CatalogBookDetails } from './CatalogBookDetails';
import { CancelReservationDialog } from './CancelReservationDialog';

// ─── Types ─────────────────────────────────────────────────────────────────

type ReservationQueueEntry = Awaited<ReturnType<typeof getBookAdminDetails>>['queue'][number];

export interface BookDetailModalProps {
  bookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'student' | 'super_admin' | 'read_only';
  onCloseAutoFocus?: (event: Event) => void;
  initialData?: Partial<Book>;
  canManage?: boolean;
  onCancelSuccess?: () => void;
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────

function ModalSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-4">
        <div className="h-36 w-24 rounded-xl bg-muted/40 shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-3/4 rounded bg-muted/40" />
          <div className="h-4 w-1/2 rounded bg-muted/40" />
          <div className="h-3 w-1/3 rounded bg-muted/30" />
          <div className="h-8 w-full rounded-xl bg-muted/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-xl bg-muted/30" />)}
      </div>
    </div>
  );
}

// ─── Student Modal Content ─────────────────────────────────────────────────

function StudentModalContent({
  book,
  availability,
  onClose,
  onCancelSuccess,
  readOnly = false,
  isAvailabilityLoading,
}: {
  readOnly?: boolean;
  isAvailabilityLoading: boolean;
  book: BookDetail;
  availability: AvailabilityStatus;
  onClose: () => void;
  onCancelSuccess?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const isAvailable = book.available_copies > 0;
  const canReserve = !readOnly && !isAvailabilityLoading && !availability.hasReservation && !availability.isReady && !isOutOfService(book, availability);
  const canCancel = !readOnly && !isAvailabilityLoading && availability.hasReservation;

  const handleCancelReservation = () => {
    const resId = availability.reservationId;
    if (!resId) return;
    setCancelDialogOpen(false);
    startTransition(async () => {
      try {
        await cancelReservation(resId);
        toast.success('Reservation cancelled');
        onCancelSuccess?.();
        router.refresh();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel');
      }
    });
  };

  const handleReserveSuccess = () => {
    startTransition(() => {
      router.refresh();
    });
    onClose();
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-5">
          <CatalogBookDetails book={book} availability={availability} isAvailabilityLoading={isAvailabilityLoading} />
        </div>
      </div>

      {(canReserve || canCancel) && (
        <footer aria-label="Book actions" className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
            {canReserve && (
              <ReserveTitleButton bookId={book.id} isAvailable={isAvailable} hasExistingReservation={false}
                onReserveSuccess={handleReserveSuccess} className="min-h-11" />
            )}
            {canCancel && (
              <Button variant="outline" disabled={isPending} onClick={() => setCancelDialogOpen(true)}
                className="min-h-11 text-destructive">
                {isPending ? 'Cancelling…' : 'Cancel reservation'}
              </Button>
            )}
          </div>
        </footer>
      )}

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

// ─── Main Modal ────────────────────────────────────────────────────────────

export function BookDetailModal(props: BookDetailModalProps) {
  return <BookDetailModalContent key={`${props.bookId}:${props.variant}`} {...props} />;
}

function BookDetailModalContent({ bookId, open, onOpenChange, variant, initialData, canManage = true, onCancelSuccess, onCloseAutoFocus }: BookDetailModalProps) {
  const { role } = usePreferences();
  const [studentData, setStudentData] = useState<{ book: BookDetail; availability: AvailabilityStatus } | null>(null);
  const [adminData, setAdminData] = useState<{ book: Book; copies?: BookCopyWithReservation[]; queue?: ReservationQueueEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!bookId) return;
    setError(null);
    try {
      if (variant !== 'super_admin') {
        const { book, availability } = await getBookPublicDetails(bookId);
        if (!book) {
          setError('Book not found');
          return;
        }
        setStudentData({ book: book as BookDetail, availability });
      } else {
        // Consolidated fetch for admin (1 roundtrip)
        const { book, copies, queue } = await getBookAdminDetails(bookId);
        
        if (!book) {
          setError('Book not found');
          return;
        }
        setAdminData({ 
          book: book as Book, 
          copies, 
          queue
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load book details');
    }
  }, [bookId, variant]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useBookDetailRealtime(open ? bookId : null, fetchData);

  const placeholderStudentData = useMemo(() => {
    if (initialData && variant === 'student') {
      return { 
        book: initialData as BookDetail, 
        availability: {
          nextAvailableDate: null,
          hasReservation: false,
          isReady: false,
          queuePosition: null,
          holdExpiresAt: null,
          reservationId: null
        }
      };
    }
    return null;
  }, [initialData, variant]);

  const placeholderAdminData = useMemo(() => {
    if (initialData && variant === 'super_admin') {
      return { 
        book: initialData as Book,
        copies: undefined as BookCopyWithReservation[] | undefined,
        queue: undefined as ReservationQueueEntry[] | undefined
      };
    }
    return null;
  }, [initialData, variant]);

  const activeStudentData = studentData || placeholderStudentData;
  const activeAdminData = adminData || placeholderAdminData;

  const isInventory = variant === 'super_admin';
  const showBookRecords = variant === 'read_only' && (role === 'super_admin' || role === 'librarian');
  const fullPageHref = (isInventory ? '/inventory/' : '/student-catalog/') + bookId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus} className={cn(
        'flex flex-col gap-0 overflow-hidden border-border bg-background p-0 text-foreground',
        'max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none',
        isInventory ? 'sm:max-w-[min(calc(100%_-_2rem),58rem)]' : 'sm:max-w-[min(calc(100%_-_2rem),40rem)]'
      )}>
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border bg-card px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-left sm:px-6">
          <div className="min-w-0">
            <DialogTitle>Book Details</DialogTitle>
            <DialogDescription className="sr-only">
              {isInventory ? 'View book information and physical copies.' : 'View book information and availability.'}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showBookRecords && (
              <Button asChild variant="ghost" className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm">
                <Link href={'/audit?bookId=' + bookId} onClick={() => onOpenChange(false)}>Book records</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" className="size-11">
              <Link href={fullPageHref} aria-label="Open full page" title="Open full page" onNavigate={() => onOpenChange(false)}>
                <Maximize2 aria-hidden="true" />
              </Link>
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Close" data-slot="dialog-close">
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {error ? (
          <div className="space-y-3 p-4 sm:p-6">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={fetchData}>Try again</Button>
          </div>
        ) : isInventory && activeAdminData ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-5xl">
              <AdminManagementContent
                initialBook={activeAdminData.book}
                initialCopies={activeAdminData.copies}
                initialQueue={activeAdminData.queue}
                onClose={() => onOpenChange(false)}
                onRefresh={fetchData}
                canManage={canManage}
              />
            </div>
          </div>
        ) : !isInventory && activeStudentData ? (
          <StudentModalContent
            readOnly={variant === 'read_only'}
            isAvailabilityLoading={!studentData}
            book={activeStudentData.book}
            availability={activeStudentData.availability}
            onClose={() => onOpenChange(false)}
            onCancelSuccess={onCancelSuccess}
          />
        ) : (
          <div role="status" className="p-4 sm:p-6">
            <span className="sr-only">Loading book details…</span>
            <ModalSkeleton />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
