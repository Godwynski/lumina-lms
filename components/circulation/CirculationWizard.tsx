'use client';

import { RefreshCcw } from 'lucide-react';
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
    isConfirmed,
    reservationData,
    switchMode,
    handleReset,
    processScan,
    confirmAction,
  } = useCirculationWizard();

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Centered Compact Stepper */}
      <div className="bg-card/30 border border-border/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
        <CirculationStepper steps={steps} currentStep={currentStep} />
      </div>

      <main className="bg-card/50 border border-border/10 rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 relative overflow-hidden transition-all duration-200">
        {/* Header Action Bar */}
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
