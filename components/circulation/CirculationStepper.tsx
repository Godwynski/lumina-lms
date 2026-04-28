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
    <div className="w-full">
      <div className="flex items-center justify-between w-full max-w-2xl mx-auto relative px-4">
        {/* Background Connection Line */}
        <div className="absolute top-1/2 left-8 right-8 h-[1px] bg-border/40 -translate-y-1/2 z-0" />
        
        {steps.map((step) => {
          const active = currentStep === step.id;
          const done = currentStep > step.id;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 group">
              <div 
                className={`flex h-8 w-8 items-center justify-center rounded-full border bg-background transition-colors duration-200 ${
                  done 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : active 
                      ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/10' 
                      : 'border-border bg-muted/30 text-muted-foreground'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : active ? (
                  <ScanLine className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              
              <span className={`text-[9px] font-bold uppercase tracking-wider text-center absolute -bottom-6 w-max ${
                active || done ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
