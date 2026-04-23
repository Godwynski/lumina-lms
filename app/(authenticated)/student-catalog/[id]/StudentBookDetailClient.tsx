'use client';

import { use, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin,
  BookOpen,
  CheckCircle2,
  Clock,
  Ticket,
  CalendarDays,
  Tag,
  Hash,
  Layers,
  AlertTriangle,
  Sparkles,
  Library,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import { ReportMissingButton } from '@/components/common/ReportMissingButton';
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
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface BookDetail {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  section: string | null;
  location: string | null;
  available_copies: number;
  total_copies: number;
  categories: { name?: string } | { name?: string }[] | null;
  tags: string[] | null;
}

interface AvailabilityStatus {
  nextAvailableDate: string | null;
  hasReservation: boolean;
  isReady: boolean;
  queuePosition: number | null;
  holdExpiresAt: string | null;
  reservationId: string | null;
}

interface Props {
  bookPromise: Promise<BookDetail | null>;
  availabilityPromise: Promise<AvailabilityStatus>;
  id: string;
}

// ─── Status Banner ────────────────────────────────────────────────────────────

function StatusBanner({
  book,
  availability,
}: {
  book: BookDetail;
  availability: AvailabilityStatus;
}) {
  const isAvailable = book.available_copies > 0;

  if (availability.isReady) {
    const deadline = availability.holdExpiresAt
      ? new Date(availability.holdExpiresAt).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;

    return (
      <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 backdrop-blur-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 shadow-inner">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-emerald-700 uppercase tracking-tight leading-tight">Copy Ready for Pickup</p>
          {deadline && (
            <p className="mt-0.5 text-[11px] font-bold text-emerald-600/70">
              Claim at the desk by <span className="text-emerald-700 font-black underline decoration-emerald-500/30 underline-offset-2">{deadline}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 animate-pulse">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.4)]" />
        </div>
      </div>
    );
  }

  if (availability.hasReservation && availability.queuePosition) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 backdrop-blur-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
          <Ticket className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-primary uppercase tracking-tight leading-tight">
            Queue Position #{availability.queuePosition}
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-muted-foreground/70">
            We&apos;ll notify you when a copy is assigned to you.
          </p>
        </div>
      </div>
    );
  }

  if (isAvailable) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-4 backdrop-blur-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-inner">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-emerald-700 uppercase tracking-tight leading-tight">
            {book.available_copies} {book.available_copies === 1 ? 'copy' : 'copies'} on shelf
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-muted-foreground/70">
            Reserve to secure this title for your next visit.
          </p>
        </div>
      </div>
    );
  }

  // All copies borrowed
  const returnDate = availability.nextAvailableDate
    ? new Date(availability.nextAvailableDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-amber-500/10 bg-amber-500/5 px-4 py-4 backdrop-blur-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-inner">
        <Clock className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-amber-700 uppercase tracking-tight leading-tight">Currently Unavailable</p>
        <p className="mt-0.5 text-[11px] font-bold text-amber-600/70">
          {returnDate ? (
            <>Estimated availability <span className="text-amber-700 font-black">{returnDate}</span></>
          ) : (
            'Join the queue to be first in line when a copy returns.'
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Copy Progress Bar ─────────────────────────────────────────────────────────

function CopyMeter({ available, total }: { available: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((available / total) * 100);
  const borrowed = total - available;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
        <span className="uppercase tracking-widest">Copy Availability</span>
        <span>{available}/{total} free</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-3 text-[10px] font-bold">
        <span className="flex items-center gap-1 text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          {available} on shelf
        </span>
        <span className="flex items-center gap-1 text-amber-600">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          {borrowed} borrowed
        </span>
      </div>
    </div>
  );
}

// ─── Metadata Tile ─────────────────────────────────────────────────────────────

function MetaTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-border/40 bg-card/20 p-4 shadow-none transition-all hover:border-primary/20 hover:bg-muted/30 backdrop-blur-sm">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-sm font-black text-foreground uppercase tracking-tight leading-snug">{value || '—'}</p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function StudentBookDetailClient({ bookPromise, availabilityPromise, id }: Props) {
  const router = useRouter();
  const book = use(bookPromise);
  const availability = use(availabilityPromise);
  const [isPending, startTransition] = useTransition();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

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
  const categoryName = Array.isArray(book.categories)
    ? book.categories[0]?.name
    : (book.categories as { name?: string })?.name;

  const handleCancelReservation = () => {
    const resId = availability.reservationId;
    if (!resId) return;
    setCancelDialogOpen(false);
    
    startTransition(async () => {
      try {
        await cancelReservation(resId);
        toast.success('Reservation cancelled');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel');
      }
    });
  };

  const handleReserveSuccess = (_queuePosition: number, _status: 'READY' | 'ACTIVE') => {
    router.refresh();
  };

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Status Banner ── */}
      <StatusBanner book={book} availability={availability} />

      {/* ── Main 2-col layout ── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">

        {/* Left: Cover */}
        <div className="shrink-0 mx-auto md:mx-0 space-y-4">
          <div className="relative h-[280px] w-[190px] overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-none backdrop-blur-sm">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                sizes="190px"
                className="object-cover transition-transform duration-500 hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Library className="h-10 w-10 text-muted-foreground/15" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/20">No Cover</span>
              </div>
            )}

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
            />
            <MetaTile
              icon={Layers}
              label="Category"
              value={categoryName || 'Uncategorized'}
            />
            <MetaTile
              icon={MapPin}
              label="Shelf Location"
              value={book.section || 'General'}
            />
            <MetaTile
              icon={Library}
              label="Section"
              value={book.location || book.section || 'Main Floor'}
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
            <ReportMissingButton
              bookId={id}
              disabled={!isAvailable}
              userType="student"
            />
          </div>

          {/* Cancel Confirmation Dialog */}
          <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <DialogTitle className="text-center">Cancel Reservation?</DialogTitle>
                <DialogDescription className="text-center">
                  {availability.isReady ? (
                    <>
                      Your copy of <span className="font-semibold text-foreground">&ldquo;{book.title}&rdquo;</span> is currently held for you.
                      Cancelling will release it back to the shelf for anyone to borrow.
                    </>
                  ) : (
                    <>
                      You&apos;ll lose your queue position for <span className="font-semibold text-foreground">&ldquo;{book.title}&rdquo;</span>. You can always reserve again later.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 sm:justify-center pt-2">
                <DialogClose asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    Keep Reservation
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleCancelReservation}
                  disabled={isPending}
                  className="flex-1 sm:flex-none"
                >
                  {isPending ? 'Cancelling…' : 'Yes, Cancel'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                Check your dashboard for borrow periods, renewal limits, and current borrowing status.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
