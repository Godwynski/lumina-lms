'use client'

import { Ticket, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SimulationProps {
  formData: Record<string, string>;
}

/**
 * Component for simulating policy changes and visualizing the projected borrowing lifecycle.
 */
export function PolicySimulationPanel({ formData }: SimulationProps) {
  const holdExpiry = parseInt(formData.hold_expiry_days || '7')

  return (
    <TooltipProvider>
      <div className="w-full space-y-10 p-1">
        <div className="p-5 rounded-xl border border-primary/10 bg-primary/[0.02] flex items-start gap-4">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shrink-0">
            <Ticket className="h-4 w-4" />
          </div>
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center gap-1.5">
              <h4 className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Hold Period</h4>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/40 hover:text-foreground transition-colors p-0.5" aria-label="Hold Period info">
                    <HelpCircle className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs font-normal">
                  If a reserved book is not picked up within this window, the hold automatically cancels and the book moves to the next student or back to the shelf.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs font-bold text-foreground/80">
              {holdExpiry} Day Reservation
            </p>
            <p className="text-[10px] text-muted-foreground/50 font-medium leading-relaxed">
              Items are held for {holdExpiry} days before expiration.
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
