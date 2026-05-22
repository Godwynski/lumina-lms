'use client';

import { useState, useCallback, useMemo } from 'react';
import { RefreshCcw, User, CheckCircle2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CirculationStepper } from './CirculationStepper';
import { ScanStep } from './steps/ScanStep';
import { ReviewStep } from './steps/ReviewStep';
import { SuccessStep } from './steps/SuccessStep';
import { useSearchParams, useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { resolveScan, checkoutBook, returnBook } from '@/lib/actions/circulation';
import { toast } from 'sonner';

type FlowMode = 'checkout' | 'return';

interface ActiveStudent {
  cardNumber: string;
  fullName: string;
  studentId: string;
  status: string;
}

interface PendingCheckout {
  bookQr: string;
  bookTitle: string;
  dueDate: string;
  idempotencyKey: string;
}

interface PendingReturn {
  bookQr: string;
  bookTitle: string;
  studentName: string;
  dueDate?: string;
  borrowedAt?: string;
  idempotencyKey: string;
}


const CHECKOUT_STEPS = [
  { id: 1, label: 'Student Identification' },
  { id: 2, label: 'Resource Verification' },
  { id: 3, label: 'Final Review' },
];

const RETURN_STEPS = [
  { id: 1, label: 'Identify Resource' },
  { id: 2, label: 'Validate Borrow' },
];

function MemberPreview({ student }: { student: ActiveStudent }) {
  return (
    <div className="mb-8 p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center gap-4">
      <Avatar className="h-10 w-10 border border-primary/20 bg-background">
        <AvatarFallback>
          <User className="h-5 w-5 text-primary/60" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold truncate">{student.fullName}</h4>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider">
            {student.status}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Bookmark className="h-3 w-3" />
          {student.studentId}
        </p>
      </div>
      <CheckCircle2 className="h-4 w-4 text-primary" />
    </div>
  );
}

export function CirculationWizard() {
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

  const playScanCue = useCallback((type: 'success' | 'error') => {
    if (typeof window === 'undefined') return;

    if (type === 'success' && 'vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    } else if (type === 'error' && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }

    const win = window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext };
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 220, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      oscillator.start(now);
      oscillator.stop(now + 0.16);
      void ctx.close();
    } catch {
      // Ignore audio context failures.
    }
  }, []);

  const handleReset = useCallback(() => {
    setActiveStudent(null);
    setPendingCheckout(null);
    setPendingReturn(null);
    setIsProcessing(false);
    setIsConfirmed(false);
    setReservationData({ ready: false });
  }, []);

  const switchMode = (newMode: FlowMode) => {
    setMode(newMode);
    handleReset();
    const params = new URLSearchParams(searchParams);
    params.set('mode', newMode);
    router.replace(`?${params.toString()}`);
  };

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
          isManual: true, // If we got here, we already resolved it, so this is just for safety
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

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Centered Compact Stepper */}
      <div className="bg-card/30 border border-border/10 rounded-2xl p-6 pb-10 backdrop-blur-sm">
        <CirculationStepper steps={steps} currentStep={currentStep} />
      </div>

      <main className="bg-card/50 border border-border/10 rounded-3xl p-8 relative overflow-hidden transition-all duration-200">
        {/* Header Action Bar Integrated */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/20">
          <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/10">
            <Button
              variant={mode === 'checkout' ? 'default' : 'ghost'}
              className="h-7 rounded-lg px-4 text-[9px] font-bold uppercase tracking-wider"
              onClick={() => switchMode('checkout')}
            >
              Checkout
            </Button>
            <Button
              variant={mode === 'return' ? 'default' : 'ghost'}
              className="h-7 rounded-lg px-4 text-[9px] font-bold uppercase tracking-wider"
              onClick={() => switchMode('return')}
            >
              Return
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleReset}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Reset</span>
          </Button>
        </div>

        <div>
          {isConfirmed ? (
            <SuccessStep 
              title={mode === 'checkout' ? 'Checkout Complete' : 'Return Complete'}
              message={mode === 'checkout' 
                ? `The resource has been successfully assigned to ${activeStudent?.fullName}.`
                : `The resource has been successfully returned.`}
              onReset={handleReset}
              reservationReady={reservationData.ready}
              reservedFor={reservationData.studentName}
            />
          ) : (currentStep === 1 || (currentStep === 2 && mode === 'checkout')) ? (
            <div key="scanning-flow">
              {activeStudent && mode === 'checkout' && (
                <MemberPreview student={activeStudent} />
              )}
              
              <ScanStep 
                title={
                  currentStep === 1 
                    ? (mode === 'checkout' ? 'Identify Student' : 'Identify Resource')
                    : 'Scan Resource'
                }
                description={
                  currentStep === 1
                    ? (mode === 'checkout' 
                        ? 'Scan student library card or enter number.' 
                        : 'Scan book copy QR code to begin.')
                    : 'Now scan the book copy QR code.'
                }
                placeholder={
                  currentStep === 1
                    ? (mode === 'checkout' ? 'Enter Card ID' : 'Enter Book QR')
                    : 'Enter Book QR'
                }
                onScan={processScan}
                isProcessing={isProcessing}
                actionLabel={currentStep === 1 ? 'Process' : 'Verify'}
              />
            </div>
          ) : (
            <div key="review" className="space-y-8">
              <ReviewStep 
                type={mode}
                studentName={mode === 'checkout' ? activeStudent!.fullName : pendingReturn!.studentName}
                studentId={mode === 'checkout' ? activeStudent!.studentId : 'N/A'}
                bookTitle={mode === 'checkout' ? pendingCheckout!.bookTitle : pendingReturn!.bookTitle}
                dueDate={mode === 'checkout' ? pendingCheckout!.dueDate : pendingReturn!.dueDate || 'N/A'}
                borrowedAt={mode === 'return' ? pendingReturn!.borrowedAt : undefined}
              />
              
              <div className="flex gap-3 justify-end pt-6 border-t border-border/20">
                  <Button 
                    variant="ghost" 
                    onClick={handleReset} 
                    disabled={isProcessing}
                    className="rounded-xl px-6 h-10 text-[11px] font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={confirmAction} 
                    disabled={isProcessing}
                    className="rounded-xl px-8 h-10 bg-primary text-[11px] font-bold uppercase tracking-wider"
                  >
                    {isProcessing ? 'Finalizing...' : `Confirm ${mode === 'checkout' ? 'Checkout' : 'Return'}`}
                  </Button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
