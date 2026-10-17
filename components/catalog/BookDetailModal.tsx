'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  MapPin,
  Tag,
  Hash,
  Layers,
  Library,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getBookAdminDetails, getBookPublicDetails } from '@/lib/actions/catalog';
import { cn, getCategoryName } from '@/lib/utils';
import type { Book, BookCopyWithReservation } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { AdminManagementContent } from './AdminManagementContent';
import type { BookDetail, AvailabilityStatus } from './types';
import { CopyMeter } from './CopyMeter';
import { MetaTile } from './MetaTile';
import { StatusBanner } from './StatusBanner';
import { CancelReservationDialog } from './CancelReservationDialog';

// ─── Types ─────────────────────────────────────────────────────────────────

type ReservationQueueEntry = Awaited<ReturnType<typeof getBookAdminDetails>>['queue'][number];

export interface BookDetailModalProps {
  bookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'student' | 'super_admin';
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
}: {
  book: BookDetail;
  availability: AvailabilityStatus;
  onClose: () => void;
  onCancelSuccess?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const isAvailable = book.available_copies > 0;
  const categoryName = getCategoryName(book.categories);

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
    <div className="space-y-4">
      {/* Real-time Status Banner */}
      <StatusBanner book={book} availability={availability} variant="compact" />

      {/* Cover + Title row */}
      <div className="flex gap-4 pr-6">
        <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/20 shadow-sm">
          <Image 
            src={book.cover_url || "/images/default-book-cover.png"} 
            alt={book.title} 
            fill 
            className="object-cover" 
            sizes="96px" 
            unoptimized 
          />
          {/* Availability ribbon */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider text-center backdrop-blur-sm",
            availability.isReady ? 'bg-emerald-500/90 text-white'
              : availability.hasReservation ? 'bg-primary/90 text-primary-foreground'
              : isAvailable ? 'bg-emerald-500/85 text-white'
              : 'bg-amber-500/90 text-white'
          )}>
            {availability.isReady ? '✦ Ready'
              : availability.hasReservation ? `Queue #${availability.queuePosition ?? 1}`
              : isAvailable ? 'On Shelf'
              : 'Fully Borrowed'}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground leading-tight line-clamp-2">{book.title}</h2>
            <p className="mt-0.5 text-sm font-bold text-muted-foreground/70">{book.author}</p>
          </div>

          {/* Tags */}
          {book.tags && book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {book.tags.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[8px] px-1.5 py-0 font-bold">
                  <Tag className="mr-0.5 h-2 w-2" />
                  {tag}
                </Badge>
              ))}
              {book.tags.length > 3 && (
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 font-bold text-muted-foreground">
                  +{book.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Copy Meter */}
      <div className="rounded-xl border border-border/30 bg-card/20 p-3 backdrop-blur-sm">
        <CopyMeter available={book.available_copies} total={book.total_copies} />
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetaTile icon={Hash} label="ISBN" value={<span className="font-mono text-[11px]">{book.isbn || 'N/A'}</span>} variant="compact" />
        <MetaTile icon={Tag} label="DDC" value={<span className="font-mono text-[11px]">{book.dewey_decimal || 'N/A'}</span>} variant="compact" />
        <MetaTile icon={Layers} label="Category" value={categoryName || 'Uncategorized'} variant="compact" />
        <MetaTile icon={MapPin} label="Location" value={book.section || 'General'} variant="compact" />
        <MetaTile icon={Library} label="Section" value={book.location || book.section || 'Main Floor'} variant="compact" />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <ReserveTitleButton
          bookId={book.id}
          isAvailable={isAvailable}
          hasExistingReservation={availability.hasReservation}
          isReady={availability.isReady}
          queuePosition={availability.queuePosition}
          holdExpiresAt={availability.holdExpiresAt}
          nextAvailableDate={availability.nextAvailableDate}
          onReserveSuccess={handleReserveSuccess}
          className="h-9 px-4 text-xs shadow-sm flex-1"
        />
        {availability.hasReservation && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setCancelDialogOpen(true)}
            className="h-9 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            {isPending ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <CancelReservationDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        bookTitle={book.title}
        isCancelling={isPending}
        onConfirmCancel={handleCancelReservation}
        isReady={availability.isReady}
      />
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────

export function BookDetailModal({ bookId, open, onOpenChange, variant, initialData, canManage = true, onCancelSuccess }: BookDetailModalProps) {
  const [studentData, setStudentData] = useState<{ book: BookDetail; availability: AvailabilityStatus } | null>(null);
  const [adminData, setAdminData] = useState<{ book: Book; copies?: BookCopyWithReservation[]; queue?: ReservationQueueEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!bookId) return;
    setError(null);
    try {
      if (variant === 'student') {
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

  // Real-time synchronization for the modal content
  useEffect(() => {
    if (!open || !bookId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`modal-realtime-${bookId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'books', filter: `id=eq.${bookId}` },
        fetchData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'book_copies', filter: `book_id=eq.${bookId}` },
        fetchData
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `book_id=eq.${bookId}` },
        fetchData
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, bookId, fetchData]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto custom-scrollbar pt-12",
        variant === 'super_admin' ? "sm:max-w-3xl" : "sm:max-w-lg"
      )}>
        <DialogHeader className="sr-only">
          <DialogTitle>Book Details</DialogTitle>
          <DialogDescription>View book information and take actions</DialogDescription>
        </DialogHeader>

        {!error && !activeAdminData && !activeStudentData && <ModalSkeleton />}

        {!error && activeStudentData && variant === 'student' && (
          <div>
            <StudentModalContent
              book={activeStudentData.book}
              availability={activeStudentData.availability}
              onClose={() => onOpenChange(false)}
              onCancelSuccess={onCancelSuccess}
            />
          </div>
        )}

        {!error && activeAdminData && variant === 'super_admin' && (
          <div>
            <AdminManagementContent 
              initialBook={activeAdminData.book} 
              initialCopies={activeAdminData.copies}
              initialQueue={activeAdminData.queue}
              onClose={() => onOpenChange(false)}
              onRefresh={fetchData}
              canManage={canManage}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
