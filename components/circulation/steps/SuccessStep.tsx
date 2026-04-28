'use client';

import { CheckCircle2, RefreshCcw, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessStepProps {
  title: string;
  message: string;
  onReset: () => void;
  reservationReady?: boolean;
  reservedFor?: string;
}

export function SuccessStep({ title, message, onReset, reservationReady, reservedFor }: SuccessStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      <div className="relative">
        <div className="h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
      </div>

      <div className="text-center space-y-2 max-w-sm">
        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
          {message}
        </p>
      </div>

      {reservationReady && (
        <div className="w-full max-w-sm bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-primary/10 rounded-xl p-2.5 text-primary border border-primary/20">
            <Bookmark className="h-5 w-5 fill-primary/20" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60">Hold Fulfillment</p>
            <p className="text-[11px] font-black text-primary leading-tight mt-0.5 uppercase">Place on Hold Shelf</p>
            <p className="text-[10px] font-medium text-primary/80 truncate">{reservedFor || 'Reserved Student'}</p>
          </div>
        </div>
      )}

      <Button 
        onClick={onReset}
        className="h-11 rounded-xl px-8 bg-primary shadow-lg shadow-primary/20 font-bold text-[11px] uppercase tracking-widest"
      >
        <RefreshCcw className="mr-2 h-3.5 w-3.5" />
        Process Another
      </Button>
    </div>
  );
}
