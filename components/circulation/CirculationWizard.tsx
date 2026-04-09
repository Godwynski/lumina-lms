'use client';

import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence, m } from "framer-motion";
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CirculationStepper } from './CirculationStepper';
import { ScanStep } from './steps/ScanStep';
import { ReviewStep } from './steps/ReviewStep';
import { SuccessStep } from './steps/SuccessStep';
import { StatusNotice } from './StatusNotice';
import { useSearchParams, useRouter } from 'next/navigation';

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

interface Notice {
  tone: 'ok' | 'warn' | 'error';
  text: string;
}

const CHECKOUT_STEPS = [
  { id: 1, label: 'Student Identification' },
  { id: 2, label: 'Resource Verification' },
  { id: 3, label: 'Final Review' },
];

const RETURN_STEPS = [
  { id: 1, label: 'Identify Resource' },
  { id: 2, label: 'Validate Loan' },
];

export function CirculationWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'return' ? 'return' : 'checkout';

  const [mode, setMode] = useState<FlowMode>(initialMode);
  const [activeStudent, setActiveStudent] = useState<ActiveStudent | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [pendingReturn, setPendingReturn] = useState<PendingReturn | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

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
    setNotice(null);
    setIsProcessing(false);
    setIsConfirmed(false);
  }, []);

  const switchMode = (newMode: FlowMode) => {
    setMode(newMode);
    handleReset();
    const params = new URLSearchParams(searchParams);
    params.set('mode', newMode);
    router.replace(`?${params.toString()}`);
  };

  const processScan = async (value: string) => {
    setIsProcessing(true);
    setNotice(null);

    try {
      if (mode === 'checkout') {
        if (!activeStudent) {
          const res = await fetch('/api/circulation/resolve-scan', {
            method: 'POST',
            body: JSON.stringify({ scanValue: value, expectedType: 'auto' }),
          });
          const payload = await res.json();
          if (payload.ok && payload.type === 'student') {
            setActiveStudent(payload.data);
            setNotice({ tone: 'ok', text: 'Student verified. Please scan the book copy.' });
            playScanCue('success');
          } else {
            setNotice({ tone: 'error', text: payload.message || 'Invalid student card.' });
            playScanCue('error');
          }
        } else {
          const res = await fetch('/api/circulation/checkout', {
            method: 'POST',
            body: JSON.stringify({ studentCardQr: activeStudent.cardNumber, bookQr: value, previewOnly: true }),
          });
          const payload = await res.json();
          if (payload.ok) {
            setPendingCheckout({
              bookQr: value,
              bookTitle: payload.book_title,
              dueDate: payload.due_date,
              idempotencyKey: crypto.randomUUID(),
            });
            playScanCue('success');
          } else {
            setNotice({ tone: 'error', text: payload.message || 'Could not validate book.' });
            playScanCue('error');
          }
        }
      } else {
        const res = await fetch('/api/circulation/return', {
          method: 'POST',
          body: JSON.stringify({ bookQr: value, previewOnly: true }),
        });
        const payload = await res.json();
        if (payload.ok) {
          setPendingReturn({
             bookQr: value,
             bookTitle: payload.book_title,
             studentName: payload.student_name,
             dueDate: payload.due_date,
             borrowedAt: payload.borrowed_at,
             idempotencyKey: crypto.randomUUID(),
          });
          playScanCue('success');
        } else {
          setNotice({ tone: 'error', text: payload.message || 'Return validation failed.' });
          playScanCue('error');
        }
      }
    } catch {
      setNotice({ tone: 'error', text: 'Connection issue. Try manual input.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmAction = async () => {
    setIsProcessing(true);
    try {
      if (mode === 'checkout' && activeStudent && pendingCheckout) {
        const res = await fetch('/api/circulation/checkout', {
          method: 'POST',
          body: JSON.stringify({
            studentCardQr: activeStudent.cardNumber,
            bookQr: pendingCheckout.bookQr,
            idempotencyKey: pendingCheckout.idempotencyKey,
            previewOnly: false,
          }),
        });
        const payload = await res.json();
        if (payload.ok) setIsConfirmed(true);
        else setNotice({ tone: 'error', text: payload.message || 'Failed to confirm checkout.' });
      } else if (mode === 'return' && pendingReturn) {
        const res = await fetch('/api/circulation/return', {
          method: 'POST',
          body: JSON.stringify({
            bookQr: pendingReturn.bookQr,
            idempotencyKey: pendingReturn.idempotencyKey,
            previewOnly: false,
          }),
        });
        const payload = await res.json();
        if (payload.ok) setIsConfirmed(true);
        else setNotice({ tone: 'error', text: payload.message || 'Failed to confirm return.' });
      }
    } catch {
      setNotice({ tone: 'error', text: 'Network failure during confirmation.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Circulation Desk</h1>
          <p className="text-sm text-muted-foreground mt-1">Guided workflow for library resource transactions.</p>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-2xl border border-border/50">
          <Button
            variant={mode === 'checkout' ? 'default' : 'ghost'}
            className="h-9 rounded-xl px-4 text-xs font-semibold shadow-sm"
            onClick={() => switchMode('checkout')}
          >
            Checkout
          </Button>
          <Button
            variant={mode === 'return' ? 'default' : 'ghost'}
            className="h-9 rounded-xl px-4 text-xs font-semibold shadow-sm"
            onClick={() => switchMode('return')}
          >
            Return
          </Button>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={handleReset}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 lg:sticky lg:top-8 bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Workflow Progress</h4>
          <CirculationStepper steps={steps} currentStep={currentStep} />
        </aside>

        <main className="lg:col-span-9 bg-card border border-border rounded-3xl p-8 shadow-sm relative overflow-hidden">
           <AnimatePresence mode="wait">
             {isConfirmed ? (
                <m.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.4 }}
                >
                  <SuccessStep 
                    title={mode === 'checkout' ? 'Checkout Complete' : 'Return Complete'}
                    message={mode === 'checkout' 
                      ? `The resource has been successfully assigned to ${activeStudent?.fullName}. Due date: ${pendingCheckout?.dueDate}.`
                      : `The resource has been successfully returned and inventory record updated.`}
                    onReset={handleReset}
                  />
                </m.div>
             ) : currentStep === 1 ? (
                <m.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <ScanStep 
                    title={mode === 'checkout' ? 'Identify Student' : 'Identify Resource'}
                    description={mode === 'checkout' 
                        ? 'Scan the student library card or enter their card number manually.' 
                        : 'Scan the book copy QR code to begin the return process.'}
                    placeholder={mode === 'checkout' ? 'Enter Card ID' : 'Enter Book QR'}
                    onScan={processScan}
                    isProcessing={isProcessing}
                    actionLabel="Process"
                  />
                </m.div>
             ) : currentStep === 2 && mode === 'checkout' ? (
                <m.div
                  key="step2-checkout"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <ScanStep 
                    title="Scan Resource"
                    description={`Borrower: ${activeStudent?.fullName}. Now scan the book copy QR.`}
                    placeholder="Enter Book QR"
                    onScan={processScan}
                    isProcessing={isProcessing}
                    actionLabel="Verify"
                  />
                </m.div>
             ) : (
                <m.div
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <ReviewStep 
                    type={mode}
                    studentName={mode === 'checkout' ? activeStudent!.fullName : pendingReturn!.studentName}
                    studentId={mode === 'checkout' ? activeStudent!.studentId : 'N/A'}
                    bookTitle={mode === 'checkout' ? pendingCheckout!.bookTitle : pendingReturn!.bookTitle}
                    dueDate={mode === 'checkout' ? pendingCheckout!.dueDate : pendingReturn!.dueDate || 'N/A'}
                    borrowedAt={mode === 'return' ? pendingReturn!.borrowedAt : undefined}
                  />
                  
                  <div className="flex gap-3 justify-end pt-6 border-t border-border">
                     <Button 
                        variant="ghost" 
                        onClick={handleReset} 
                        disabled={isProcessing}
                        className="rounded-xl px-6"
                     >
                        Cancel
                     </Button>
                     <Button 
                        onClick={confirmAction} 
                        disabled={isProcessing}
                        className="rounded-xl px-8 bg-primary shadow-lg shadow-primary/20"
                     >
                        {isProcessing ? 'Finalizing...' : `Confirm ${mode === 'checkout' ? 'Checkout' : 'Return'}`}
                     </Button>
                  </div>
                </m.div>
             )}
           </AnimatePresence>

           <StatusNotice notice={notice} className="mt-8" />
        </main>
      </div>
    </div>
  );
}
