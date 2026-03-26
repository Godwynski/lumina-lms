'use client';

import { CheckCircle2, Circle, ScanLine } from 'lucide-react';

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
    <div className="flex flex-col space-y-3">
      <div className="flex flex-col space-y-1.5 text-xs">
        {steps.map((step, index) => {
          const active = currentStep === step.id;
          const done = currentStep > step.id;
          
          return (
            <div key={step.id} className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <span 
                  className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-300 ${
                    done 
                      ? 'bg-primary/20 border-primary text-primary' 
                      : active 
                        ? 'border-primary/40 bg-primary/10 text-primary animate-pulse' 
                        : 'border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : active ? (
                    <ScanLine className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </span>
                {index < steps.length - 1 && (
                  <span className={`my-0.5 h-4 w-px transition-colors duration-300 ${done ? 'bg-primary/40' : 'bg-border'}`} />
                )}
              </div>
              <p className={`pt-0.5 transition-colors duration-300 ${active || done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
