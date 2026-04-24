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
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4 sticky top-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
            Flow Simulation
          </h3>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Visualizing the borrowing lifecycle.
          </p>
        </div>

        <div className="space-y-4 pt-1">
          <div className="relative pl-5 border-l border-primary/20 space-y-6">
            <div className="relative">
              <div className="absolute -left-[25.5px] top-0 h-2 w-2 rounded-full border-2 border-primary bg-background" />
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Checkout</span>
                <p className="text-[10px] font-black text-foreground">{format(today, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <BookOpen className="h-2.5 w-2.5" />
                  <span>Max {maxBorrow} books</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-[25.5px] top-0 h-2 w-2 rounded-full border-2 border-primary bg-background" />
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Due Date</span>
                <p className="text-[10px] font-black text-foreground">{format(dueDate, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5" />
                  <span>{loanPeriod} day term</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-[25.5px] top-0 h-2 w-2 rounded-full border-2 border-muted-foreground/30 bg-background" />
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Renewal</span>
                <p className="text-[10px] font-black text-foreground">{format(renewalDate, 'MMM dd, yyyy')}</p>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  <span>+{renewalPeriod} days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/40">
          <div className="flex items-center gap-2">
             <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Ticket className="h-3 w-3" />
             </div>
             <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground">Hold Logic</span>
                <p className="text-[10px] text-muted-foreground">{holdExpiry} day shelf expiry</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
