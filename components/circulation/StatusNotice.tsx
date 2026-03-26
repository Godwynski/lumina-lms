'use client';

import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusNoticeProps {
  notice: {
    tone: 'ok' | 'warn' | 'error';
    text: string;
  } | null;
  className?: string;
}

export function StatusNotice({ notice, className }: StatusNoticeProps) {
  if (!notice) return null;

  const toneStyles = {
    ok: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700',
    warn: 'bg-amber-500/10 border-amber-500/20 text-amber-700',
    error: 'bg-destructive/10 border-destructive/20 text-destructive',
  };

  const Icon = {
    ok: CheckCircle2,
    warn: Info,
    error: AlertCircle,
  }[notice.tone];

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl border animate-in fade-in zoom-in-95 duration-300",
        toneStyles[notice.tone],
        className
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium leading-none">{notice.text}</span>
    </div>
  );
}
