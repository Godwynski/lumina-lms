'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { resolveScan, checkoutBook, returnBook } from '@/lib/actions/circulation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useScanFeedback } from './use-scan-feedback';
import { hasBorrowingBlock, type ActiveStudent } from '@/components/circulation/MemberPreview';

// The RPCs return ISO timestamps; the review step shows them as-is.
const formatDate = (iso?: string) => (iso ? format(new Date(iso), 'MMM dd, yyyy') : undefined);

export type FlowMode = 'checkout' | 'return';

export interface PendingCheckout {
  bookQr: string;
  bookTitle: string;
  dueDate: string;
  idempotencyKey: string;
}

export interface PendingReturn {
  bookQr: string;
  bookTitle: string;
  studentName: string;
  dueDate?: string;
  borrowedAt?: string;
  fineAmount?: number;
  overdueDays?: number;
  idempotencyKey: string;
}

export const CHECKOUT_STEPS = [
  { id: 1, label: 'Library card' },
  { id: 2, label: 'Book / Item' },
  { id: 3, label: 'Review checkout' },
];

export const RETURN_STEPS = [
  { id: 1, label: 'Book / Item' },
  { id: 2, label: 'Review return' },
];

/**
 * Custom hook encapsulating state transitions, scan resolution, and transaction confirmations
 * for the multi-step library circulation checkout/return wizard.
 */
export function useCirculationWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'return' ? 'return' : 'checkout';

  const [mode, setMode] = useState<FlowMode>(initialMode);
  const [activeStudent, setActiveStudent] = useState<ActiveStudent | null>(null);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [pendingReturn, setPendingReturn] = useState<PendingReturn | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  // Bumped on reset/mode switch. Async results from an older generation are
  // dropped so they can't repopulate a cleared wizard or the wrong mode.
  const generationRef = useRef(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [reservationData, setReservationData] = useState<{ ready: boolean; studentName?: string }>({ ready: false });

  const { playScanCue } = useScanFeedback();

  const isBlocked = hasBorrowingBlock(activeStudent?.block);
  const isBlockedPendingOverride = mode === 'checkout' && !!activeStudent && isBlocked && !overrideReason;

  const currentStep = useMemo(() => {
    if (isConfirmed) return 4;
    if (mode === 'checkout') {
      if (!activeStudent) return 1;
      if (isBlockedPendingOverride) return 1;
      if (!pendingCheckout) return 2;
      return 3;
    } else {
      if (!pendingReturn) return 1;
      return 2;
    }
  }, [mode, activeStudent, isBlockedPendingOverride, pendingCheckout, pendingReturn, isConfirmed]);

  const steps = mode === 'checkout' ? CHECKOUT_STEPS : RETURN_STEPS;

  const handleReset = useCallback(() => {
    generationRef.current++;
    setActiveStudent(null);
    setOverrideReason(null);
    setPendingCheckout(null);
    setPendingReturn(null);
    setIsProcessing(false);
    setIsConfirmed(false);
    setReservationData({ ready: false });
  }, []);

  const applyOverride = useCallback((reason: string): boolean => {
    const trimmed = reason.trim();
    if (trimmed.length < 10 || trimmed.length > 300) {
      toast.error('Override reason must be between 10 and 300 characters.');
      return false;
    }
    setOverrideReason(trimmed);
    return true;
  }, []);

  const switchMode = useCallback((newMode: FlowMode) => {
    setMode(newMode);
    handleReset();
    const params = new URLSearchParams(searchParams);
    params.set('mode', newMode);
    router.replace(`?${params.toString()}`);
  }, [handleReset, router, searchParams]);

  const processScan = async (value: string, isManual: boolean = false): Promise<boolean> => {
    const gen = generationRef.current;
    const isStale = () => gen !== generationRef.current;
    setIsProcessing(true);
    logger.info('Circulation', `Processing scan: ${value}`, { mode, hasStudent: !!activeStudent });

    try {
      if (mode === 'checkout') {
        if (!activeStudent) {
          const result = await resolveScan({ scanValue: value, expectedType: 'auto', isManual });
          if (isStale()) return false;
          
          if (result.success && result.data.type === 'student') {
            const student = result.data.data as ActiveStudent;
            setActiveStudent(student);
            setOverrideReason(null);
            if (hasBorrowingBlock(student.block)) {
              toast.error('Patron has overdue books or unpaid fines. Borrowing is blocked.');
              playScanCue('error');
            } else {
              toast.success('Patron verified. Please scan the item.');
              playScanCue('success');
            }
            return true;
          } else {
            toast.error(result.error || 'Invalid library card.');
            playScanCue('error');
            return false;
          }
        } else {
          const result = await checkoutBook({ 
            studentCardQr: activeStudent.cardNumber, 
            bookQr: value, 
            previewOnly: true,
            isManual
          });
          if (isStale()) return false;

          if (result.success) {
            setPendingCheckout({
              bookQr: value,
              bookTitle: result.data.book_title!,
              dueDate: formatDate(result.data.due_date) ?? 'N/A',
              idempotencyKey: crypto.randomUUID(),
            });
            playScanCue('success');
            return true;
          } else {
            toast.error(result.error || 'Could not validate book.');
            playScanCue('error');
            return false;
          }
        }
      } else {
        const result = await returnBook({ bookQr: value, previewOnly: true, isManual });
        if (isStale()) return false;

        if (result.success) {
          setPendingReturn({
             bookQr: value,
             bookTitle: result.data.book_title!,
             studentName: result.data.student_name!,
             dueDate: formatDate(result.data.due_date),
             borrowedAt: formatDate(result.data.borrowed_at),
             fineAmount: Number(result.data.fine_amount ?? 0),
             overdueDays: Number(result.data.overdue_days ?? 0),
             idempotencyKey: crypto.randomUUID(),
          });
          playScanCue('success');
          return true;
        } else {
          toast.error(result.error || 'Return validation failed.');
          playScanCue('error');
          return false;
        }
      }
    } catch (err: unknown) {
      if (isStale()) return false;
      const message = err instanceof Error ? err.message : 'Process failed.';
      logger.error('Circulation', 'Scan process error', {}, err);
      toast.error(message, { id: 'circulation-error-toast' });
      return false;
    } finally {
      if (!isStale()) setIsProcessing(false);
      logger.info('Circulation', 'Scan processing finished');
    }
  };

  const confirmAction = async (
    settleFine: boolean = false,
    resolution?: 'PAID' | 'CONDONED',
    remarks?: string
  ) => {
    const gen = generationRef.current;
    const isStale = () => gen !== generationRef.current;
    setIsProcessing(true);
    setIsCommitting(true);

    try {
      if (mode === 'checkout' && activeStudent && pendingCheckout) {
        const checkoutPayload: {
          studentCardQr: string;
          bookQr: string;
          idempotencyKey: string;
          previewOnly: boolean;
          isManual: boolean;
          overrideReason?: string;
        } = {
          studentCardQr: activeStudent.cardNumber,
          bookQr: pendingCheckout.bookQr,
          idempotencyKey: pendingCheckout.idempotencyKey,
          previewOnly: false,
          isManual: true,
        };
        if (overrideReason) {
          checkoutPayload.overrideReason = overrideReason;
        }
        const result = await checkoutBook(checkoutPayload);
        if (isStale()) return;

        if (result.success) {
          setIsConfirmed(true);
          toast.success('Transaction recorded', {
            description: 'Ensure the physical copy matches.',
          });
        } else {
          toast.error(result.error || 'Failed to confirm checkout.');
        }
      } else if (mode === 'return' && pendingReturn) {
        const returnPayload: {
          bookQr: string;
          idempotencyKey: string;
          previewOnly: boolean;
          isManual: boolean;
          settleFine: boolean;
          resolution?: 'PAID' | 'CONDONED';
          remarks?: string;
        } = {
          bookQr: pendingReturn.bookQr,
          idempotencyKey: pendingReturn.idempotencyKey,
          previewOnly: false,
          isManual: true,
          settleFine,
        };
        if (settleFine && resolution !== undefined) {
          returnPayload.resolution = resolution;
          if (remarks !== undefined && remarks.trim() !== '') {
            returnPayload.remarks = remarks.trim();
          }
        }
        const result = await returnBook(returnPayload);
        if (isStale()) return;

        if (result.success) {
          setIsConfirmed(true);
          toast.success('Transaction recorded', {
            description: 'Ensure the physical copy matches.',
          });
          if (result.data.reservation_ready) {
            setReservationData({ ready: true, studentName: result.data.reserved_for });
          }
        } else {
          toast.error(result.error || 'Failed to confirm return.');
        }
      }
    } catch (err: unknown) {
      if (isStale()) return;
      const message = err instanceof Error ? err.message : 'Network failure during confirmation.';
      toast.error(message);
    } finally {
      setIsCommitting(false);
      if (!isStale()) setIsProcessing(false);
    }
  };

  return {
    mode,
    steps,
    currentStep,
    activeStudent,
    overrideReason,
    isBlocked,
    isBlockedPendingOverride,
    pendingCheckout,
    pendingReturn,
    isProcessing,
    isCommitting,
    isConfirmed,
    reservationData,
    switchMode,
    handleReset,
    applyOverride,
    processScan,
    confirmAction,
  };
}
