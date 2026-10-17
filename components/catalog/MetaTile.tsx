'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MetaTileProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  subvalue?: string;
  variant?: 'compact' | 'tile' | 'stacked';
  className?: string;
}

/**
 * Reusable metadata presentation item with icon, label, primary value, and optional secondary note.
 */
export function MetaTile({
  icon: Icon,
  label,
  value,
  subvalue,
  variant = 'compact',
  className,
}: MetaTileProps) {
  if (variant === 'stacked') {
    return (
      <div className={cn("group rounded-2xl border border-border/40 bg-card/20 p-4 shadow-none transition-all hover:border-primary/20 hover:bg-muted/30 backdrop-blur-sm", className)}>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">
          <Icon className="h-3 w-3" />
          {label}
        </p>
        <p className="text-sm font-black text-foreground uppercase tracking-tight leading-snug">{value || '—'}</p>
        {subvalue && <p className="text-[10px] font-semibold text-muted-foreground/70 mt-1">{subvalue}</p>}
      </div>
    );
  }

  if (variant === 'tile') {
    return (
      <div className={cn("flex items-center gap-3.5 rounded-2xl border border-border/40 bg-card/40 p-3.5 backdrop-blur-sm transition-all hover:bg-card/70 hover:border-border/60", className)}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">{label}</p>
          <p className="truncate text-xs font-bold text-foreground mt-0.5">{value || '—'}</p>
          {subvalue && <p className="text-[10px] font-semibold text-muted-foreground/70">{subvalue}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border/30 bg-card/20 p-2.5 backdrop-blur-sm", className)}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-muted-foreground/60">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">{label}</p>
        <p className="truncate text-xs font-bold text-foreground/90">{value || '—'}</p>
        {subvalue && <p className="text-[9px] font-semibold text-muted-foreground/60">{subvalue}</p>}
      </div>
    </div>
  );
}
