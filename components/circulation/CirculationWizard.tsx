'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CirculationStepper } from './CirculationStepper';
import { ScanStep } from './steps/ScanStep';
import { ReviewStep } from './steps/ReviewStep';
import { SuccessStep } from './steps/SuccessStep';
import { MemberPreview } from './MemberPreview';
import { useCirculationWizard } from '@/hooks/use-circulation-wizard';

/**
 * Streamlined Circulation Wizard shell.
 * Coordinates circulation step presentation while state management, audio cues,
 * and server actions are isolated in dedicated hooks and subcomponents.
 */
export function CirculationWizard() {
  const {
    mode,
    steps,
    currentStep,
    activeStudent,
    pendingCheckout,
    pendingReturn,
    isProcessing,
    isCommitting,
    isConfirmed,
    reservationData,
    switchMode,
    handleReset: resetWizard,
    processScan,
    confirmAction,
  } = useCirculationWizard();

  // View-only step override for going back. The hook derives `reachedStep` from
  // the scanned data, so stepping back never clears the student or the draft.
  const [session, setSession] = useState(0);
  const reachedStep = currentStep;
  const [viewStep, setViewStep] = useState<number | null>(null);
  const step = isConfirmed || viewStep === null ? reachedStep : Math.min(viewStep, reachedStep);
  const canNavigate = !isConfirmed && !isProcessing && !isCommitting;

  const goToStep = (id: number) => {
    if (canNavigate && id >= 1 && id <= reachedStep) setViewStep(id < reachedStep ? id : null);
  };
  const handleReset = () => {
    setViewStep(null);
    setSession(n => n + 1);
    resetWizard();
  };
  const handleSwitchMode = (next: typeof mode) => {
    setViewStep(null);
    switchMode(next);
  };
  // A successful scan produces a fresh draft, so resume at the furthest step.
  const handleScan: typeof processScan = async (value, isManual) => {
    const ok = await processScan(value, isManual);
    if (ok) setViewStep(null);
    return ok;
  };
  // Stepped back to student identification with a student already scanned.
  const reviewingStudent = mode === 'checkout' && step === 1 && !!activeStudent;

  // When a step replaces the focused control, move focus to the new stage.
  // Preserve normal route-entry focus and keep failed scans in the current field.
  const stageRef = useRef<HTMLElement>(null);
  const stageKey = `${mode}-${step}`;
  const previousStage = useRef(stageKey);
  useEffect(() => {
    if (previousStage.current !== stageKey) {
      previousStage.current = stageKey;
      stageRef.current?.focus();
    }
  }, [stageKey]);
  const stageLabel = isConfirmed
    ? (mode === 'checkout' ? 'Checkout complete' : 'Return complete')
    : `Step ${step} of ${steps.length}: ${steps[step - 1].label}`;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Centered Compact Stepper */}
      <div className="bg-card/30 border border-border/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
        <CirculationStepper
          steps={steps}
          currentStep={step}
          reachedStep={reachedStep}
          onStepClick={canNavigate ? goToStep : undefined}
        />
      </div>

      <div className="bg-card/50 border border-border/10 rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 relative overflow-hidden transition-all duration-200">
        {/* Header Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-8 pb-6 border-b border-border/20">
          <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/10">
            <Button
              variant={mode === 'checkout' ? 'default' : 'ghost'}
              className="h-7 rounded-lg px-4 text-[11px] font-bold uppercase tracking-wider"
              aria-pressed={mode === 'checkout'}
              disabled={isCommitting}
              onClick={() => mode !== 'checkout' && handleSwitchMode('checkout')}
            >
              Checkout
            </Button>
            <Button
              variant={mode === 'return' ? 'default' : 'ghost'}
              className="h-7 rounded-lg px-4 text-[11px] font-bold uppercase tracking-wider"
              aria-pressed={mode === 'return'}
              disabled={isCommitting}
              onClick={() => mode !== 'return' && handleSwitchMode('return')}
            >
              Return
            </Button>
          </div>

          <div className="flex items-center gap-1">
          {step > 1 && !isConfirmed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 rounded-lg text-muted-foreground transition-colors"
              disabled={!canNavigate}
              onClick={() => goToStep(step - 1)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Back</span>
            </Button>
          )}
          {!isConfirmed && (reachedStep > 1 || isProcessing) && <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            disabled={isCommitting}
            onClick={handleReset}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Start over</span>
          </Button>}
          </div>
        </div>

        <section ref={stageRef} tabIndex={-1} aria-label={stageLabel} className="scroll-mt-6 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {isConfirmed ? (
            <SuccessStep 
              title={mode === 'checkout' ? 'Checkout Complete' : 'Return Complete'}
              message={mode === 'checkout' 
                ? `The resource has been successfully assigned to ${activeStudent?.fullName}.`
                : `The resource has been successfully returned.`}
              nextLabel={mode === 'checkout' ? 'New checkout' : 'New return'}
              onReset={handleReset}
              reservationReady={reservationData.ready}
              reservedFor={reservationData.studentName}
            />
          ) : (step === 1 || (step === 2 && mode === 'checkout')) ? (
            <div key={`${mode}-${session}`}>
              {activeStudent && mode === 'checkout' && (
                <MemberPreview student={activeStudent} />
              )}
              
              {reviewingStudent ? (
                <div className="flex justify-end pt-6">
                  <Button
                    onClick={() => goToStep(2)}
                    className="rounded-xl px-8 h-10 bg-primary text-[11px] font-bold uppercase tracking-wider"
                  >
                    Continue
                  </Button>
                </div>
              ) : (
              <ScanStep 
                title={
                  step === 1 
                    ? (mode === 'checkout' ? 'Scan student card' : 'Scan book copy')
                    : 'Scan book copy'
                }
                description={
                  step === 1
                    ? (mode === 'checkout' 
                        ? 'Scan student library card or enter number.' 
                        : 'Scan book copy QR code to begin.')
                    : `${activeStudent?.fullName} verified. Scan the QR on the physical copy.`
                }
                placeholder={
                  step === 1
                    ? (mode === 'checkout' ? 'Enter Card ID' : 'Enter Book QR')
                    : 'Enter Book QR'
                }
                onScan={handleScan}
                isProcessing={isProcessing}
                actionLabel={step === 1 ? 'Process' : 'Verify'}
              />
              )}
            </div>
          ) : (
            <div key="review" className="space-y-8">
              <ReviewStep 
                type={mode}
                studentName={mode === 'checkout' ? activeStudent!.fullName : pendingReturn!.studentName}
                studentId={mode === 'checkout' ? activeStudent!.studentId : undefined}
                copyCode={mode === 'checkout' ? pendingCheckout!.bookQr : pendingReturn!.bookQr}
                bookTitle={mode === 'checkout' ? pendingCheckout!.bookTitle : pendingReturn!.bookTitle}
                dueDate={mode === 'checkout' ? pendingCheckout!.dueDate : pendingReturn!.dueDate || 'N/A'}
                borrowedAt={mode === 'return' ? pendingReturn!.borrowedAt : undefined}
              />
              
              <div className="flex flex-wrap gap-3 justify-end pt-6 border-t border-border/20">
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
        </section>

      </div>
    </div>
  );
}
