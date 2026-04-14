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
    <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-in zoom-in-95 fade-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
        <div className="relative h-24 w-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="h-12 w-12 text-white" />
        </div>
      </div>

      <div className="text-center space-y-2 max-w-sm">
        <h3 className="text-2xl font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {message}
        </p>
      </div>

      {reservationReady && (
        <div className="w-full max-w-md bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-700">
          <div className="bg-primary rounded-xl p-2.5 text-white shadow-lg shadow-primary/30">
            <Bookmark className="h-5 w-5 fill-white" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Hold Fulfillment</p>
            <p className="text-sm font-bold text-primary leading-tight mt-0.5">Place on Hold Shelf for:</p>
            <p className="text-xs font-medium text-primary/80 truncate">{reservedFor || 'Reserved Student'}</p>
          </div>
        </div>
      )}

      <Button 
        onClick={onReset}
        className="h-10 rounded-xl px-6 bg-primary shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Process Another
      </Button>
    </div>
  );
}
