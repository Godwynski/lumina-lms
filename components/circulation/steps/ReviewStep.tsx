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
  studentId: string;
  bookTitle: string;
  dueDate: string;
  borrowedAt?: string;
}

export function ReviewStep({ 
  type, 
  studentName, 
  studentId, 
  bookTitle, 
  dueDate, 
  borrowedAt 
}: ReviewStepProps) {
  const isCheckout = type === 'checkout';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          {isCheckout ? <FileText className="h-4 w-4 text-primary" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {isCheckout ? 'Review Checkout' : 'Review Return'}
        </h3>
        <p className="text-[11px] text-muted-foreground uppercase tracking-tight font-medium">
          {isCheckout 
            ? 'Verify borrower and item details.' 
            : 'Confirm item return details.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Borrower</p>
                <p className="text-sm font-bold text-foreground">{studentName}</p>
              </div>
            </div>
            
            <div className="bg-background rounded-xl p-4 border border-border/40 shadow-sm">
               <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest">
                 <ShieldAlert className="h-3 w-3" />
                 ID Verification
               </p>
               <p className="mt-1 font-mono text-xl font-bold tracking-widest text-foreground">
                 {studentId}
               </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 space-y-4 h-full">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Resource</p>
              <p className="text-xs font-bold mt-1 text-foreground leading-tight">{bookTitle}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-border/20">
              {borrowedAt && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Calendar className="h-3 w-3" />
                    BORROWED
                  </span>
                  <span className="font-bold text-foreground">{borrowedAt}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3 w-3" />
                  DUE DATE
                </span>
                <span className={`font-black ${isCheckout ? 'text-primary' : 'text-emerald-600'}`}>
                  {dueDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex items-start gap-3">
         <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
         <p className="text-[10px] text-amber-900/60 font-medium leading-normal uppercase tracking-tight">
           Once confirmed, this transaction is recorded. Ensure the physical copy matches.
         </p>
      </div>
    </div>
  );
}
