'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  MapPin,
  BookOpen,
  CheckCircle2,
  Clock,
  Ticket,
  Tag,
  Hash,
  Layers,
  Sparkles,
  Library,
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
import { getBookAdminDetails, getBookPublicDetails } from '@/lib/actions/catalog';
import { cn } from '@/lib/utils';
import type { Book, BookCopyWithReservation } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { AdminManagementContent } from './AdminManagementContent';


// ─── Types ─────────────────────────────────────────────────────────────────

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

type ReservationQueueEntry = Awaited<ReturnType<typeof getBookAdminDetails>>['queue'][number];

interface BookDetailModalProps {
  bookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'student' | 'admin';
  initialData?: Partial<Book>;
  canManage?: boolean;
  onCancelSuccess?: () => void;
}

// ─── Copy Progress Bar ─────────────────────────────────────────────────────

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

// ─── Metadata Row ──────────────────────────────────────────────────────────

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/20 p-2.5 backdrop-blur-sm">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-muted-foreground/60">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">{label}</p>
        <p className="truncate text-xs font-bold text-foreground/90">{value || '—'}</p>
      </div>
    </div>
  );
}

// ─── Status Mini Banner ────────────────────────────────────────────────────

function StatusMini({ book, availability }: { book: BookDetail; availability: AvailabilityStatus }) {
  const isAvailable = book.available_copies > 0;

  if (availability.isReady) {
    const deadline = availability.holdExpiresAt
      ? new Date(availability.holdExpiresAt).toLocaleDateString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
        })
      : null;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-black text-emerald-700 uppercase tracking-tight">Ready for Pickup</p>
          {deadline && <p className="text-[10px] font-bold text-emerald-600/70 mt-0.5">Claim by {deadline}</p>}
        </div>
        <span className="ml-auto animate-pulse inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.4)]" />
      </div>
    );
  }

  if (availability.hasReservation && availability.queuePosition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
        <Ticket className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-black text-primary uppercase tracking-tight">Queue Position #{availability.queuePosition}</p>
          <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">We&apos;ll notify you when assigned.</p>
        </div>
      </div>
    );
  }

  if (isAvailable) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-black text-emerald-700 uppercase tracking-tight">
            {book.available_copies} {book.available_copies === 1 ? 'copy' : 'copies'} on shelf
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2.5">
      <Clock className="h-4 w-4 text-amber-600 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-black text-amber-700 uppercase tracking-tight">Currently Unavailable</p>
      </div>
    </div>
  );
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
        onCancelSuccess?.();
        router.refresh();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel');
      }
    });
  };

  const handleReserveSuccess = () => {
    router.refresh();
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <StatusMini book={book} availability={availability} />

      {/* Cover + Title row */}
      <div className="flex gap-4 pr-6">
        <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/20 shadow-sm">
          {book.cover_url ? (
            <Image src={book.cover_url} alt={book.title} fill className="object-cover" sizes="96px" unoptimized />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1">
              <Library className="h-6 w-6 text-muted-foreground/15" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/20">No Cover</span>
            </div>
          )}
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
        <MetaRow icon={Hash} label="ISBN" value={<span className="font-mono text-[11px]">{book.isbn || 'N/A'}</span>} />
        <MetaRow icon={Layers} label="Category" value={categoryName || 'Uncategorized'} />
        <MetaRow icon={MapPin} label="Location" value={book.section || 'General'} />
        <MetaRow icon={Library} label="Section" value={book.location || book.section || 'Main Floor'} />
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
        <ReportMissingButton
          bookId={book.id}
          disabled={!isAvailable}
          userType="student"
        />
      </div>


      {/* Cancel confirmation nested */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Cancel Reservation?</DialogTitle>
            <DialogDescription className="text-center">
              You&apos;ll lose your queue position for &ldquo;{book.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-center pt-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 sm:flex-none">Keep</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleCancelReservation} disabled={isPending} className="flex-1 sm:flex-none">
              {isPending ? 'Cancelling…' : 'Yes, Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    if (initialData && variant === 'admin') {
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
        variant === 'admin' ? "sm:max-w-2xl" : "sm:max-w-lg"
      )}>
        <DialogHeader className="sr-only">
          <DialogTitle>Book Details</DialogTitle>
          <DialogDescription>View book information and take actions</DialogDescription>
        </DialogHeader>

        {!error && !activeAdminData && !activeStudentData && <ModalSkeleton />}

        {error && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/20">
              <BookOpen className="h-5 w-5 text-muted-foreground/20" />
            </div>
            <p className="text-sm font-bold text-foreground/60">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchData} className="mt-2 text-[10px] font-black uppercase">Try Again</Button>
          </div>
        )}

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

        {!error && activeAdminData && variant === 'admin' && (
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
