'use client';

import * as React from 'react';
import Image from 'next/image';
import { UserCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { getBookAdminDetails } from '@/lib/actions/catalog';

export type ReservationQueueEntry = Awaited<ReturnType<typeof getBookAdminDetails>>['queue'][number];

export function formatRelativeTime(dateStr: string | null, mounted: boolean): string {
  if (!dateStr || !mounted) return '...';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h remaining`;
  return 'Less than 1h';
}

export interface ReservationQueuePanelProps {
  queue: ReservationQueueEntry[];
  mounted: boolean;
  className?: string;
}

export function ReservationQueuePanel({
  queue,
  mounted,
  className,
}: ReservationQueuePanelProps) {
  if (!queue || queue.length === 0) return null;

  const reserver = (entry: ReservationQueueEntry) => {
    const p = entry.profiles;
    const profile = Array.isArray(p) ? p[0] : p;
    return profile as {
      full_name: string | null;
      student_id: string | null;
      avatar_url: string | null;
    } | null;
  };

  return (
    <div className={cn("rounded-xl border border-border/40 bg-muted/5 flex flex-col h-full transition-all", className)}>
      <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Queue</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/10 border-none">
            {queue.length}
          </Badge>
        </div>
      </div>
      <div className="divide-y divide-border/20 overflow-y-auto custom-scrollbar flex-1 max-h-[160px]">
        {queue.map((entry) => {
          const r = reserver(entry);
          return (
            <div key={entry.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border/40">
                  {r?.avatar_url ? (
                    <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/40">
                      <UserCircle2 size={10} className="text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate leading-tight text-foreground">{r?.full_name ?? 'Unknown'}</p>
                  <p className="text-[9px] text-muted-foreground/60">Position {entry.queue_position}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  entry.status === 'READY' ? "text-emerald-500" : "text-muted-foreground/40"
                )}>
                  {entry.status === 'READY' ? 'Ready' : 'Waiting'}
                </span>
                {entry.hold_expires_at && entry.status === 'READY' && (
                  <p className="text-[8px] font-medium text-amber-500/80 mt-0.5">{formatRelativeTime(entry.hold_expires_at, mounted)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
