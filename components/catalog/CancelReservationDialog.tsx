'use client';

import * as React from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

export interface CancelReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  isCancelling: boolean;
  onConfirmCancel: () => void | Promise<void>;
  isReady?: boolean;
}

/**
 * Reusable modal for student confirmation before releasing an active book reservation hold.
 */
export function CancelReservationDialog({
  open,
  onOpenChange,
  bookTitle,
  isCancelling,
  onConfirmCancel,
  isReady = false,
}: CancelReservationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center font-bold">Cancel Reservation?</DialogTitle>
          <DialogDescription className="text-center text-xs text-muted-foreground">
            {isReady ? (
              <>
                Your copy of <span className="font-semibold text-foreground">&ldquo;{bookTitle}&rdquo;</span> is currently held for you.
                Cancelling will release it back to the shelf for anyone to borrow.
              </>
            ) : (
              <>
                You&apos;ll lose your queue position for <span className="font-semibold text-foreground">&ldquo;{bookTitle}&rdquo;</span>.
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
            onClick={onConfirmCancel}
            disabled={isCancelling}
            className="flex-1 sm:flex-none"
          >
            {isCancelling ? 'Cancelling…' : 'Yes, Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
