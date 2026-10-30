'use client';

import { CheckCircle2, Circle, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  label: string;
}

interface CirculationStepperProps {
  steps: Step[];
  currentStep: number;
}

export function CirculationStepper({ steps, currentStep }: CirculationStepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-between w-full max-w-xl mx-auto px-2 sm:px-4">
        {steps.map((step, idx) => {
          const active = currentStep === step.id;
          const done = currentStep > step.id;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className={cn("flex items-start", !isLast && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                <div 
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border bg-background transition-colors duration-200 shrink-0",
                    done 
                      ? "bg-primary/10 border-primary text-primary" 
                      : active 
                        ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/10" 
                        : "border-border bg-muted/30 text-muted-foreground"
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : active ? (
                    <ScanLine className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                
                <span className={cn(
                  "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-center transition-colors max-w-[80px] sm:max-w-[120px] leading-tight",
                  active || done ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div className="flex-1 flex items-center px-2 pt-4">
                  <div className={cn(
                    "h-[1.5px] w-full rounded-full transition-colors duration-300",
                    done ? "bg-primary" : "bg-border/60"
                  )} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
