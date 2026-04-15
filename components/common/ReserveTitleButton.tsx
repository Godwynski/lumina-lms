'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Ticket, Gift, CheckCircle2, Bookmark, Clock } from 'lucide-react';
import { getBookAvailabilityStatus } from '@/lib/actions/reservations';
import { toast } from 'sonner';

interface ReserveTitleButtonProps {
  bookId: string;
  isAvailable: boolean;
  disabled?: boolean;
  hasExistingReservation?: boolean;
  nextAvailableDate?: string | null;
  isReady?: boolean;
  queuePosition?: number | null;
  holdExpiresAt?: string | null;
  onReserveSuccess?: (queuePosition: number, status: 'READY' | 'ACTIVE') => void;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ReserveTitleButton({ 
  bookId, 
  isAvailable, 
  disabled, 
  hasExistingReservation: initialHasReservation, 
  nextAvailableDate: initialNextDate,
  isReady: initialIsReady,
  queuePosition: initialPos,
  holdExpiresAt: initialExpires,
  onReserveSuccess,
  variant = "default",
  size = "default",
  className
}: ReserveTitleButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [status, setStatus] = useState({
    hasReservation: initialHasReservation,
    isReady: initialIsReady,
    queuePosition: initialPos,
    holdExpiresAt: initialExpires,
    nextAvailableDate: initialNextDate
  });

  // Self-hydration: only fetch if the parent explicitly did NOT pass reservation status.
  // In the catalog list view, pass hasExistingReservation={false} to suppress this.
  // In the book detail view, the parent fetches and passes the full status.
  useEffect(() => {
    if (initialHasReservation === undefined) {
      // undefined means the parent didn't check — fetch once
      getBookAvailabilityStatus(bookId).then((data: {
        hasReservation: boolean;
        isReady: boolean;
        queuePosition: number | null;
        holdExpiresAt: string | null;
        nextAvailableDate: string | null;
      }) => {
        setStatus({
          hasReservation: data.hasReservation,
          isReady: data.isReady,
          queuePosition: data.queuePosition,
          holdExpiresAt: data.holdExpiresAt,
          nextAvailableDate: data.nextAvailableDate
        });
      });
    } else {
      // Sync when props arrive/change (book detail view)
      setStatus({
        hasReservation: initialHasReservation,
        isReady: initialIsReady,
        queuePosition: initialPos,
        holdExpiresAt: initialExpires,
        nextAvailableDate: initialNextDate
      });
    }
  }, [bookId, initialHasReservation, initialIsReady, initialPos, initialExpires, initialNextDate]);

  const handleReserve = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    startTransition(async () => {
      try {
        // Use the atomic API route (not the old placeReservation server action)
        const res = await fetch('/api/circulation/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId }),
        });

        const data = await res.json() as {
          ok: boolean;
          queue_position?: number;
          message?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Failed to place reservation');
        }

        setIsSuccess(true);
        const queuePos = data.queue_position ?? 1;

        // Refresh availability from DB after success
        const fresh = await getBookAvailabilityStatus(bookId);
        setStatus({
          hasReservation: fresh.hasReservation,
          isReady: fresh.isReady,
          queuePosition: fresh.queuePosition,
          holdExpiresAt: fresh.holdExpiresAt,
          nextAvailableDate: fresh.nextAvailableDate
        });

        const finalStatus: 'READY' | 'ACTIVE' = fresh.isReady ? 'READY' : 'ACTIVE';
        const finalPos = fresh.queuePosition ?? queuePos;

        toast.success(
          fresh.isReady
            ? `Reserved! Your copy is ready for pickup.`
            : `Reserved! You are at position ${queuePos} in the queue.`
        );

        // Notify parent so it can update the list row instantly
        onReserveSuccess?.(finalPos, finalStatus);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Failed to place reservation');
      }
    });
  };

  const inQueue = status.hasReservation || isSuccess;
  const isCurrentlyReady = status.isReady;
  const pos = status.queuePosition;
  const deadline = status.holdExpiresAt;

  // If the book is assigned and ready for pickup
  if (isCurrentlyReady) {
    const dateStr = deadline ? new Date(deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    return (
      <Button
        disabled
        variant="outline"
        size={size}
        className={`rounded-xl gap-2 font-black border-emerald-300 bg-emerald-50 text-emerald-700 animate-pulse shadow-sm ${className}`}
      >
        <Clock className="h-4 w-4" />
        Ready (Until {dateStr})
      </Button>
    );
  }

  // If available, show "Reserve for Pickup"
  if (isAvailable) {
    return (
      <Button
        onClick={handleReserve}
        disabled={isPending || inQueue || disabled}
        variant={inQueue ? "outline" : "default"}
        size={size}
        className={`rounded-xl gap-2 font-bold shadow-sm transition-all hover:scale-[1.02] ${className}`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : inQueue ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Gift className="h-4 w-4" />
        )}
        {isPending ? 'Reserving...' : inQueue ? 'Your Reserve' : 'Reserve for Pickup'}
      </Button>
    );
  }

  // Not available — show queue button
  return (
    <Button
      onClick={handleReserve}
      disabled={isPending || inQueue || disabled}
      variant={inQueue ? "outline" : variant}
      size={size}
      className={`rounded-xl gap-2 font-bold ${className}`}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : inQueue ? (
        <Ticket className="h-4 w-4 text-primary" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {isPending ? 'Processing...' : inQueue ? `Your Queue #${pos || 1}` : 'Reserve to Borrow'}
    </Button>
  );
}
