'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CopyMeterProps {
  available: number;
  total: number;
  className?: string;
}

/**
 * Visual progress meter illustrating the ratio of available copies on shelf versus borrowed copies.
 */
export function CopyMeter({ available, total, className }: CopyMeterProps) {
  const pct = total === 0 ? 0 : Math.round((available / total) * 100);
  const borrowed = Math.max(0, total - available);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
        <span className="uppercase tracking-widest">Copy Availability</span>
        <span>{available}/{total} free</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-3 text-[10px] font-bold">
        <span className="flex items-center gap-1 text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          {available} on shelf
        </span>
        <span className="flex items-center gap-1 text-amber-600">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          {borrowed} borrowed
        </span>
      </div>
    </div>
  );
}
