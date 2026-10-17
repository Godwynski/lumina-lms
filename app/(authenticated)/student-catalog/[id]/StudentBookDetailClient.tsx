'use client';

import { use, useState, useTransition, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getCategoryName } from '@/lib/utils';
import {
  MapPin,
  BookOpen,
  CalendarDays,
  Tag,
  Hash,
  Layers,
  AlertTriangle,
  Library,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import { cancelReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BookDetail, AvailabilityStatus } from '@/components/catalog/types';
import { StatusBanner } from '@/components/catalog/StatusBanner';
import { CopyMeter } from '@/components/catalog/CopyMeter';
import { MetaTile } from '@/components/catalog/MetaTile';
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
  const [imgSrc, setImgSrc] = useState(book?.cover_url || "/images/default-book-cover.png");
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
            <ArrowRight className="mr-1.5 h-3.5 w-3.5 rotate-180" />
            Back to Catalog
          </Link>
        </Button>
      </div>
    );
  }

  const isAvailable = book.available_copies > 0;
  const categoryName = getCategoryName(book.categories);

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

  const handleReserveSuccess = (_queuePosition: number, _status: 'READY' | 'ACTIVE') => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Status Banner ── */}
      <StatusBanner book={book} availability={availability} variant="full" />

      {/* ── Main 2-col layout ── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">

        {/* Left: Cover */}
        <div className="shrink-0 mx-auto md:mx-0 space-y-4">
          <div className="relative h-[280px] w-[190px] overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-none backdrop-blur-sm">
            <Image
              src={imgSrc}
              alt={book?.title || 'Book Cover'}
              fill
              sizes="190px"
              className="object-cover transition-transform duration-500 hover:scale-105"
              unoptimized
              onError={() => setImgSrc("/images/default-book-cover.png")}
            />

            {/* Availability ribbon */}
            <div className={`absolute bottom-0 left-0 right-0 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-center backdrop-blur-sm ${
              availability.isReady
                ? 'bg-emerald-500/90 text-white'
                : availability.hasReservation
                ? 'bg-primary/90 text-primary-foreground'
                : isAvailable
                ? 'bg-emerald-500/85 text-white'
                : 'bg-amber-500/90 text-white'
            }`}>
              {availability.isReady
                ? '✦ Ready for Pickup'
                : availability.hasReservation
                ? `Queue #${availability.queuePosition ?? 1}`
                : isAvailable
                ? 'On Shelf'
                : 'Fully Borrowed'}
            </div>
          </div>

          {/* Tags below cover */}
          {book.tags && book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 w-[190px]">
              {book.tags.slice(0, 4).map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0.5 font-bold">
                  <Tag className="mr-1 h-2.5 w-2.5" />
                  {tag}
                </Badge>
              ))}
              {book.tags.length > 4 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold text-muted-foreground">
                  +{book.tags.length - 4}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Right: Info */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Title & Author */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground leading-tight">{book.title}</h1>
            <p className="mt-1 text-sm font-bold text-muted-foreground/70">{book.author}</p>
          </div>

          {/* Copy Meter */}
          <div className="rounded-2xl border border-border/40 bg-card/20 p-4 shadow-none backdrop-blur-sm">
            <CopyMeter available={book.available_copies} total={book.total_copies} />
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <MetaTile
              icon={Hash}
              label="ISBN"
              value={<span className="font-mono text-xs">{book.isbn || 'N/A'}</span>}
              variant="stacked"
            />
            <MetaTile
              icon={Layers}
              label="Category"
              value={categoryName || 'Uncategorized'}
              variant="stacked"
            />
            <MetaTile
              icon={MapPin}
              label="Shelf Location"
              value={book.section || 'General'}
              variant="stacked"
            />
            <MetaTile
              icon={Library}
              label="Section"
              value={book.location || book.section || 'Main Floor'}
              variant="stacked"
            />
          </div>

          {/* Pickup Deadline (only if READY) */}
          {availability.isReady && availability.holdExpiresAt && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-300/50 bg-emerald-50/50 px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-black text-emerald-700">
                  Pick up by{' '}
                  {new Date(availability.holdExpiresAt).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="mt-0.5 text-[10px] text-emerald-600/70">
                  After this date, your hold will expire and the next person in queue will be notified.
                </p>
              </div>
            </div>
          )}

          {/* Return date hint (only if unavailable and no personal reservation) */}
          {!isAvailable && !availability.hasReservation && availability.nextAvailableDate && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200/50 bg-amber-50/40 px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs font-bold text-amber-700">
                A copy is expected to be returned by{' '}
                <span className="font-black">
                  {new Date(availability.nextAvailableDate).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                . Reserve now to be first in line.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <ReserveTitleButton
              bookId={id}
              isAvailable={isAvailable}
              hasExistingReservation={availability.hasReservation}
              isReady={availability.isReady}
              queuePosition={availability.queuePosition}
              holdExpiresAt={availability.holdExpiresAt}
              nextAvailableDate={availability.nextAvailableDate}
              onReserveSuccess={handleReserveSuccess}
              className="h-11 px-6 text-sm shadow-md"
            />
            {availability.hasReservation && (
              <Button
                variant="outline"
                size="default"
                disabled={isPending}
                onClick={() => setCancelDialogOpen(true)}
                className="h-11 px-5 text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
              >
                {isPending ? 'Cancelling…' : 'Cancel Reservation'}
              </Button>
            )}
          </div>

          {/* Cancel Confirmation Dialog */}
          <CancelReservationDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
            bookTitle={book.title}
            isCancelling={isPending}
            onConfirmCancel={handleCancelReservation}
            isReady={availability.isReady}
          />

          {/* Help hints */}
          <div className="grid gap-2 sm:grid-cols-2 pt-1">
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                Can&apos;t find the book?
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Use the shelf label first, then scan adjacent call numbers. Ask staff at the desk to check the return queue.
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                Borrow Policy
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Check your dashboard for borrow periods and current borrowing status.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
