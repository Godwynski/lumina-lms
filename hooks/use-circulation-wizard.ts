'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { resolveScan, checkoutBook, returnBook } from '@/lib/actions/circulation';
import { toast } from 'sonner';
import { useScanFeedback } from './use-scan-feedback';
import type { ActiveStudent } from '@/components/circulation/MemberPreview';

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
  idempotencyKey: string;
}

export const CHECKOUT_STEPS = [
  { id: 1, label: 'Student Identification' },
  { id: 2, label: 'Resource Verification' },
  { id: 3, label: 'Final Review' },
];

export const RETURN_STEPS = [
  { id: 1, label: 'Identify Resource' },
  { id: 2, label: 'Validate Borrow' },
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
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [pendingReturn, setPendingReturn] = useState<PendingReturn | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [reservationData, setReservationData] = useState<{ ready: boolean; studentName?: string }>({ ready: false });

  const { playScanCue } = useScanFeedback();

  const currentStep = useMemo(() => {
    if (isConfirmed) return 4;
    if (mode === 'checkout') {
      if (!activeStudent) return 1;
      if (!pendingCheckout) return 2;
      return 3;
    } else {
      if (!pendingReturn) return 1;
      return 2;
    }
  }, [mode, activeStudent, pendingCheckout, pendingReturn, isConfirmed]);

  const steps = mode === 'checkout' ? CHECKOUT_STEPS : RETURN_STEPS;

  const handleReset = useCallback(() => {
    setActiveStudent(null);
    setPendingCheckout(null);
    setPendingReturn(null);
    setIsProcessing(false);
    setIsConfirmed(false);
    setReservationData({ ready: false });
  }, []);

  const switchMode = useCallback((newMode: FlowMode) => {
    setMode(newMode);
    handleReset();
    const params = new URLSearchParams(searchParams);
    params.set('mode', newMode);
    router.replace(`?${params.toString()}`);
  }, [handleReset, router, searchParams]);

  const processScan = async (value: string, isManual: boolean = false): Promise<boolean> => {
    setIsProcessing(true);
    logger.info('Circulation', `Processing scan: ${value}`, { mode, hasStudent: !!activeStudent });

    try {
      if (mode === 'checkout') {
        if (!activeStudent) {
          const result = await resolveScan({ scanValue: value, expectedType: 'auto', isManual });
          
          if (result.success && result.data.type === 'student') {
            setActiveStudent(result.data.data as ActiveStudent);
            toast.success('Student verified. Please scan the book copy.');
            playScanCue('success');
            return true;
          } else {
            toast.error(result.error || 'Invalid student card.');
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

          if (result.success) {
            setPendingCheckout({
              bookQr: value,
              bookTitle: result.data.book_title!,
              dueDate: result.data.due_date!,
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

        if (result.success) {
          setPendingReturn({
             bookQr: value,
             bookTitle: result.data.book_title!,
             studentName: result.data.student_name!,
             dueDate: result.data.due_date,
             borrowedAt: result.data.borrowed_at,
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
      const message = err instanceof Error ? err.message : 'Process failed.';
      logger.error('Circulation', 'Scan process error', {}, err);
      toast.error(message, { id: 'circulation-error-toast' });
      return false;
    } finally {
      setIsProcessing(false);
      logger.info('Circulation', 'Scan processing finished');
    }
  };

  const confirmAction = async () => {
    setIsProcessing(true);

    try {
      if (mode === 'checkout' && activeStudent && pendingCheckout) {
        const result = await checkoutBook({
          studentCardQr: activeStudent.cardNumber,
          bookQr: pendingCheckout.bookQr,
          idempotencyKey: pendingCheckout.idempotencyKey,
          previewOnly: false,
          isManual: true,
        });
        
        if (result.success) {
          setIsConfirmed(true);
          toast.success('Transaction recorded', {
            description: 'Ensure the physical copy matches.',
          });
        } else {
          toast.error(result.error || 'Failed to confirm checkout.');
        }
      } else if (mode === 'return' && pendingReturn) {
        const result = await returnBook({
          bookQr: pendingReturn.bookQr,
          idempotencyKey: pendingReturn.idempotencyKey,
          previewOnly: false,
          isManual: true,
        });

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
      const message = err instanceof Error ? err.message : 'Network failure during confirmation.';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    mode,
    steps,
    currentStep,
    activeStudent,
    pendingCheckout,
    pendingReturn,
    isProcessing,
    isConfirmed,
    reservationData,
    switchMode,
    handleReset,
    processScan,
    confirmAction,
  };
}
