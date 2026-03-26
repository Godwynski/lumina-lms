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
    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-500">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          {isCheckout ? <FileText className="h-5 w-5 text-primary" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          {isCheckout ? 'Review Checkout' : 'Review Return'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isCheckout 
            ? 'Verify the borrower and item details below.' 
            : 'Confirm the item being returned and its current status.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Borrower</p>
                <p className="text-base font-bold">{studentName}</p>
              </div>
            </div>
            
            <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
               <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                 <ShieldAlert className="h-3.5 w-3.5" />
                 ID VERIFICATION
               </p>
               <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-foreground/90">
                 {studentId}
               </p>
               <p className="text-[10px] text-muted-foreground mt-1 underline underline-offset-2">
                 Verify this manually before proceeding
               </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4 h-full">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resource Details</p>
              <p className="text-sm font-semibold mt-1 leading-tight">{bookTitle}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              {borrowedAt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Borrowed
                  </span>
                  <span className="font-medium">{borrowedAt}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Due Date
                </span>
                <span className={`font-bold ${isCheckout ? 'text-primary' : 'text-emerald-600'}`}>
                  {dueDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
         <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
         <div className="text-xs text-amber-900/80 leading-relaxed font-medium">
           <strong>Final Check:</strong> Once you confirm, this transaction will be recorded in the system audit logs. Ensure you are processing the correct physical copy.
         </div>
      </div>
    </div>
  );
}
