'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark, Loader2, CheckCircle2 } from 'lucide-react';
import { placeReservation } from '@/lib/actions/reservations';
import { toast } from 'sonner';

interface ReserveTitleButtonProps {
  bookId: string;
  isAvailable: boolean;
  disabled?: boolean;
}

export function ReserveTitleButton({ bookId, isAvailable, disabled }: ReserveTitleButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReserve = () => {
    startTransition(async () => {
      try {
        const res = await placeReservation(bookId);
        if (res.success) {
          setIsSuccess(true);
          toast.success(`Reserved! You are at position ${res.position} in the queue.`);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to place reservation");
      }
    });
  };

  if (isAvailable) return null; // Only show if not available

  return (
    <Button
      onClick={handleReserve}
      disabled={isPending || isSuccess || disabled}
      variant={isSuccess ? "outline" : "default"}
      className="w-full rounded-xl gap-2 h-11 font-semibold"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSuccess ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {isPending ? 'Processing...' : isSuccess ? 'In Queue' : 'Reserve Title'}
    </Button>
  );
}
