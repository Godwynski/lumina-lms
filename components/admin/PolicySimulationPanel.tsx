'use client';

import { Calendar, BookOpen, Clock, Ticket } from 'lucide-react';
import { addDays, format } from 'date-fns';

interface SimulationProps {
  formData: Record<string, string>;
}

export function PolicySimulationPanel({ formData }: SimulationProps) {
  const borrowPeriod = parseInt(formData.loan_period_days || '14');
  const holdExpiry = parseInt(formData.hold_expiry_days || '7');
  const maxBorrow = parseInt(formData.max_borrow_limit || '5');
  const renewalPeriod = parseInt(formData.renewal_period_days || '14');

  const today = new Date();
  const dueDate = addDays(today, borrowPeriod);
  const renewalDate = addDays(dueDate, renewalPeriod);

  return (
    <div className="space-y-8 sticky top-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Timeline</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Estimated borrowing lifecycle.
        </p>
      </div>

      <div className="space-y-8 relative pl-4 border-l border-border">
        <div className="relative">
          <div className="absolute -left-[20.5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Checkout</span>
            <p className="text-sm font-medium text-foreground">{format(today, 'MMM dd, yyyy')}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <BookOpen className="h-3 w-3" />
              <span>Limit: {maxBorrow}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-[20.5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Due Date</span>
            <p className="text-sm font-medium text-foreground">{format(dueDate, 'MMM dd, yyyy')}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Calendar className="h-3 w-3" />
              <span>{borrowPeriod} days</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-[20.5px] top-1.5 h-2 w-2 rounded-full border border-border bg-background" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Renewal</span>
            <p className="text-sm font-medium text-foreground">{format(renewalDate, 'MMM dd, yyyy')}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Clock className="h-3 w-3" />
              <span>+{renewalPeriod} days</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <div className="flex items-start gap-3">
           <Ticket className="h-4 w-4 mt-0.5 text-muted-foreground/60" />
           <div>
              <span className="text-xs font-medium text-foreground">Hold Expiry</span>
              <p className="text-xs text-muted-foreground">{holdExpiry} days on shelf</p>
           </div>
        </div>
      </div>
    </div>
  );
}
