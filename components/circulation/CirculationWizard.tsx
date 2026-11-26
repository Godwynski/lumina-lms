'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FineSettlementDialog } from '@/components/common/FineSettlementDialog';
import { CirculationStepper } from './CirculationStepper';
import { ScanStep } from './steps/ScanStep';
import { ReviewStep } from './steps/ReviewStep';
import { SuccessStep } from './steps/SuccessStep';
import { MemberPreview } from './MemberPreview';
import { useCirculationWizard } from '@/hooks/use-circulation-wizard';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import type { UserRole } from '@/lib/types';
import styles from './CirculationWizard.module.css';

export interface CirculationWizardProps {
  userRole?: UserRole | null;
}

/**
 * Streamlined Circulation Wizard shell.
 * Coordinates circulation step presentation while state management, audio cues,
 * and server actions are isolated in dedicated hooks and subcomponents.
 */
export function CirculationWizard({ userRole }: CirculationWizardProps = {}) {
  const { role: contextRole } = usePreferences();
  const effectiveRole = userRole ?? contextRole;
  const canOverrideBlock = effectiveRole === 'librarian' || effectiveRole === 'super_admin';

  const {
    mode,
    steps,
    currentStep,
    activeStudent,
    overrideReason,
    isBlockedPendingOverride,
    pendingCheckout,
    pendingReturn,
    isProcessing,
    isCommitting,
    isConfirmed,
    reservationData,
    switchMode,
    handleReset: resetWizard,
    applyOverride,
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

  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const overrideFieldId = useId();
  const stageId = useId();
  const headerRef = useRef<HTMLElement>(null);

  const goToStep = (id: number) => {
    if (canNavigate && id >= 1 && id <= reachedStep) setViewStep(id < reachedStep ? id : null);
  };
  const clearOverrideDraft = () => {
    setShowOverrideForm(false);
    setOverrideDraft('');
    setOverrideError(null);
  };
  const handleReset = () => {
    setViewStep(null);
    setSession(n => n + 1);
    setIsSettleModalOpen(false);
    clearOverrideDraft();
    resetWizard();
  };
  const handleSwitchMode = (next: typeof mode) => {
    if (!switchMode(next)) return;
    setViewStep(null);
    setIsSettleModalOpen(false);
    clearOverrideDraft();
  };
  // A successful scan produces a fresh draft, so resume at the furthest step.
  const handleScan: typeof processScan = async (value, isManual) => {
    const ok = await processScan(value, isManual);
    if (ok) {
      setViewStep(null);
      clearOverrideDraft();
    }
    return ok;
  };
  // Stepped back to student identification with a student already scanned.
  const reviewingStudent = mode === 'checkout' && step === 1 && !!activeStudent && !isBlockedPendingOverride;

  const handleOverrideContinue = () => {
    const trimmed = overrideDraft.trim();
    if (trimmed.length < 10 || trimmed.length > 300) {
      setOverrideError('Override reason must be between 10 and 300 characters.');
      return;
    }
    if (applyOverride(trimmed)) {
      clearOverrideDraft();
      setViewStep(null);
    }
  };

  const stageRef = useRef<HTMLElement>(null);
  const stageKey = `${mode}:${step}:${session}:${isBlockedPendingOverride}:${showOverrideForm}`;
  const previousAnimationStage = useRef(stageKey);
  useLayoutEffect(() => {
    if (previousAnimationStage.current === stageKey) return;
    previousAnimationStage.current = stageKey;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Animate the new panel in place without delaying input or measuring layout.
    const animation = stageRef.current?.animate?.(
      [{ opacity: 0.75 }, { opacity: 1 }],
      { duration: 140, easing: 'ease-out' },
    );
    return () => animation?.cancel();
  }, [stageKey]);

  // Scan steps focus their input. For other steps, announce the changed panel.
  const previousStage = useRef({ mode, stageKey });
  useEffect(() => {
    const previous = previousStage.current;
    previousStage.current = { mode, stageKey };
    const stage = stageRef.current;
    if (previous.mode === mode && previous.stageKey !== stageKey && stage && !stage.contains(document.activeElement)) {
      stage.focus({ preventScroll: true });
    }
  }, [mode, stageKey]);
  const stageLabel = isConfirmed
    ? (mode === 'checkout' ? 'Checkout complete' : 'Return complete')
    : `Step ${step} of ${steps.length}: ${steps[step - 1].label}`;
  const showBack = step > 1 && !isConfirmed;
  const showReset = !isConfirmed && (reachedStep > 1 || isProcessing);

  const handleConfirmClick = () => {
    if (mode === 'return' && (pendingReturn?.fineAmount ?? 0) > 0) {
      setIsSettleModalOpen(true);
      return;
    }
    void confirmAction(false);
  };

  return (
    <div className={`${styles.workspace} mx-auto w-full min-w-0 max-w-5xl rounded-2xl border border-border/50 bg-card/50`}>
      <header ref={headerRef} className={`${styles.header} grid items-center gap-4 border-b border-border/50 px-3 py-3 sm:px-6 sm:py-4`}>
        <div role="group" aria-label="Circulation mode" className="app-toolbar-segments grid w-full max-w-xs grid-cols-2 justify-self-center">
          <Button
            type="button"
            variant={mode === 'checkout' ? 'default' : 'ghost'}
            className="app-toolbar-control"
            aria-pressed={mode === 'checkout'}
            aria-controls={stageId}
            disabled={isCommitting}
            onClick={() => handleSwitchMode('checkout')}
          >
            Checkout
          </Button>
          <Button
            type="button"
            variant={mode === 'return' ? 'default' : 'ghost'}
            className="app-toolbar-control"
            aria-pressed={mode === 'return'}
            aria-controls={stageId}
            disabled={isCommitting}
            onClick={() => handleSwitchMode('return')}
          >
            Return
          </Button>
        </div>

        <CirculationStepper
          steps={steps}
          currentStep={step}
          reachedStep={reachedStep}
          onStepClick={canNavigate ? goToStep : undefined}
        />
      </header>

      <div className="p-3 sm:p-6">
        <section id={stageId} ref={stageRef} tabIndex={-1} aria-label={stageLabel} className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
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
                <MemberPreview student={activeStudent} overrideReason={overrideReason} />
              )}

              {isBlockedPendingOverride ? (
                <div className="rounded-2xl border border-border/20 bg-muted/10 p-5 space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Checkout cannot proceed while this patron has overdue books or unpaid fines.
                    </p>
                    {!canOverrideBlock && (
                      <p className="text-xs text-muted-foreground">
                        Only a Librarian or Super Admin can override a borrowing block.
                      </p>
                    )}
                  </div>

                  {showOverrideForm && canOverrideBlock ? (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor={overrideFieldId} className="text-sm font-medium">
                          Override reason
                        </Label>
                        <Textarea
                          id={overrideFieldId}
                          value={overrideDraft}
                          onChange={(e) => {
                            setOverrideDraft(e.target.value);
                            if (overrideError) setOverrideError(null);
                          }}
                          placeholder="Enter reason for overriding this borrowing block (10–300 characters)"
                          maxLength={300}
                          aria-invalid={Boolean(overrideError)}
                          className="min-h-24"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Minimum 10 characters required.</span>
                          <span className="tabular-nums">{overrideDraft.trim().length}/300</span>
                        </div>
                        {overrideError && (
                          <p role="alert" className="text-xs font-medium text-destructive">
                            {overrideError}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleReset}
                          className="rounded-lg px-5 h-10"
                        >
                          Start over
                        </Button>
                        <Button
                          type="button"
                          onClick={handleOverrideContinue}
                          className="rounded-lg px-6 h-10"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        className="rounded-lg px-5 h-10"
                      >
                        Start over
                      </Button>
                      {canOverrideBlock && (
                        <Button
                          type="button"
                          onClick={() => {
                            setShowOverrideForm(true);
                            setOverrideError(null);
                          }}
                          className="rounded-lg px-6 h-10 gap-2"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Override
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : reviewingStudent ? (
                <div className="flex justify-end pt-6">
                  <Button
                    onClick={() => goToStep(2)}
                    className="rounded-lg px-8 h-10"
                  >
                    Continue
                  </Button>
                </div>
              ) : (
              <ScanStep 
                title={
                  step === 1 
                    ? (mode === 'checkout' ? 'Scan library card' : 'Scan item')
                    : 'Scan item'
                }
                description={
                  step === 1
                    ? (mode === 'checkout' 
                        ? 'Scan library card or enter number.' 
                        : 'Scan item QR code to begin.')
                    : `${activeStudent?.fullName} verified. Scan the QR on the physical item.`
                }
                label={
                  step === 1
                    ? (mode === 'checkout' ? 'Card or Patron ID' : 'Item QR code')
                    : 'Item QR code'
                }
                placeholder={
                  step === 1
                    ? (mode === 'checkout' ? 'e.g. LIB-2026-0001' : 'e.g. BK-0001-01')
                    : 'e.g. BK-0001-01'
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
                fineAmount={mode === 'return' ? pendingReturn?.fineAmount : undefined}
                overdueDays={mode === 'return' ? pendingReturn?.overdueDays : undefined}
              />
              
              <div className="flex flex-wrap gap-3 justify-end pt-6 border-t border-border/20">
                  <Button 
                    onClick={handleConfirmClick} 
                    disabled={isProcessing}
                    className="rounded-lg px-8 h-10"
                  >
                    {isProcessing ? 'Finalizing...' : `Confirm ${mode === 'checkout' ? 'Checkout' : 'Return'}`}
                  </Button>
              </div>

              <FineSettlementDialog
                open={isSettleModalOpen}
                onOpenChange={setIsSettleModalOpen}
                title="Overdue Penalty Settlement"
                description={
                  <>
                    This book is {pendingReturn?.overdueDays || 1} day(s) overdue with a penalty of{' '}
                    <span className="font-bold text-destructive tabular-nums">
                      ₱{Number(pendingReturn?.fineAmount ?? 0).toFixed(2)}
                    </span>
                    . Mark as Paid, Mark as Condoned, or return unpaid (Receivable) to settle later from Borrowing Logs.
                  </>
                }
                fineAmount={Number(pendingReturn?.fineAmount ?? 0)}
                isSubmitting={isProcessing}
                allowReturnOnly
                onReturnOnly={() => {
                  setIsSettleModalOpen(false);
                  void confirmAction(false);
                }}
                onResolve={(resolution, remarks) => {
                  setIsSettleModalOpen(false);
                  void confirmAction(true, resolution, remarks);
                }}
              />
            </div>
          )}
        </section>
      </div>

      {(showBack || showReset) && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-border/50 px-3 py-1.5 sm:px-6">
          {showBack && (
            <Button
              type="button"
              variant="ghost"
              className="app-toolbar-control gap-1.5"
              disabled={!canNavigate}
              onClick={() => {
                goToStep(step - 1);
                headerRef.current?.scrollIntoView?.({ block: 'nearest' });
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
          {showReset && (
            <Button
              type="button"
              variant="ghost"
              className="app-toolbar-control ml-auto gap-1.5 hover:bg-destructive/10 hover:text-destructive"
              disabled={isCommitting}
              onClick={() => {
                handleReset();
                headerRef.current?.scrollIntoView?.({ block: 'nearest' });
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Start over
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
