'use client';

import { Calendar, BookOpen, Clock, Ticket } from 'lucide-react';
import { addDays, format } from 'date-fns';

interface SimulationProps {
  formData: Record<string, string>;
}

export function PolicySimulationPanel({ formData }: SimulationProps) {
  const loanPeriod = parseInt(formData.loan_period_days || '14');
  const holdExpiry = parseInt(formData.hold_expiry_days || '7');
  const maxBorrow = parseInt(formData.max_borrow_limit || '5');
  const renewalPeriod = parseInt(formData.renewal_period_days || '14');

  const today = new Date();
  const dueDate = addDays(today, loanPeriod);
  const renewalDate = addDays(dueDate, renewalPeriod);

  return (
    <div className="rounded-3xl border border-border bg-card/50 p-6 shadow-sm backdrop-blur-sm sticky top-8">
      <div className="space-y-6">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Live Flow Simulation
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Visualizing how your current rules impact the standard borrowing lifecycle.
          </p>
        </div>

        {/* Borrowing Timeline */}
        <div className="space-y-4 pt-2">
          <div className="relative pl-6 border-l border-primary/20 space-y-8">
            {/* Step 1: Borrow */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Checkout Day</span>
                <p className="text-[11px] font-medium text-foreground">{format(today, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <BookOpen className="h-3 w-3" />
                  <span>Limit: Borrow up to {maxBorrow} books</span>
                </div>
              </div>
            </div>

            {/* Step 2: Due Date */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Due Date</span>
                <p className="text-[11px] font-medium text-foreground">{format(dueDate, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Initial Period: {loanPeriod} days</span>
                </div>
              </div>
            </div>

            {/* Step 3: Renewal */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/30 bg-background" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">After Renewal</span>
                <p className="text-[11px] font-medium text-foreground">{format(renewalDate, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Extended by {renewalPeriod} days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Ticket className="h-4 w-4" />
             </div>
             <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Hold Logic</span>
                <p className="text-[11px] text-muted-foreground">{holdExpiry} day shelf expiry per reservation</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
