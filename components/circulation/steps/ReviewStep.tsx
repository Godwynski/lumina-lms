'use client';

import { 
    AlertCircle, 
    Calendar, 
    CheckCircle2, 
    FileText, 
    ShieldAlert, 
    User 
} from 'lucide-react';

interface ReviewStepProps {
  type: 'checkout' | 'return';
  studentName: string;
  studentId?: string;
  copyCode: string;
  bookTitle: string;
  dueDate: string;
  borrowedAt?: string;
  fineAmount?: number;
  overdueDays?: number;
}

export function ReviewStep({ 
  type, 
  studentName, 
  studentId,
  copyCode,
  bookTitle, 
  dueDate, 
  borrowedAt,
  fineAmount,
  overdueDays,
}: ReviewStepProps) {
  const isCheckout = type === 'checkout';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          {isCheckout ? <FileText className="h-4 w-4 text-primary" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {isCheckout ? 'Review Checkout' : 'Review Return'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isCheckout 
            ? 'Verify borrower and item details.' 
            : 'Confirm item return details.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/20 bg-muted/10 p-5 space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Borrower</p>
                <p className="text-sm font-bold text-foreground">{studentName}</p>
              </div>
            </div>
            
            {studentId && <div className="bg-background rounded-xl p-4 border border-border/20 shadow-sm">
               <p className="text-2xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                 <ShieldAlert className="h-3 w-3" />
                 Patron ID
               </p>
               <p className="mt-1 font-mono text-xl font-bold tracking-widest text-foreground">
                 {studentId}
               </p>
            </div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/20 bg-muted/10 p-5 space-y-4 h-full">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Book / Item</p>
              <p className="text-base font-bold mt-1 text-foreground leading-tight">{bookTitle}</p>
              <p className="mt-2 text-sm text-muted-foreground">Item ID <span className="font-mono text-foreground break-all">{copyCode}</span></p>
            </div>

            <div className="space-y-2 pt-3 border-t border-border/10">
              {borrowedAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    Borrowed
                  </span>
                  <span className="font-semibold text-foreground">{borrowedAt}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  Due date
                </span>
                <span className={`font-bold ${isCheckout ? 'text-primary' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {dueDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {type === 'return' && (fineAmount ?? 0) > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive font-semibold leading-relaxed">
            Overdue Penalty: ₱{Number(fineAmount).toFixed(2)} ({overdueDays || 1} day(s) overdue)
          </p>
        </div>
      )}

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
         <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
         <p className="text-xs text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
           Check the copy ID against the label on the book before confirming.
         </p>
      </div>
    </div>
  );
}
