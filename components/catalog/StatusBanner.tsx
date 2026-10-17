'use client';

import * as React from 'react';
import { Sparkles, Ticket, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BookDetail, AvailabilityStatus } from './types';

export interface StatusBannerProps {
  book: Pick<BookDetail, 'available_copies'>;
  availability: AvailabilityStatus;
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Reusable banner displaying the real-time reservation and shelf status of a book.
 * Handles: Ready for Pickup, In Waiting Queue, Available on Shelf, and Unavailable states.
 */
export function StatusBanner({
  book,
  availability,
  variant = 'full',
  className,
}: StatusBannerProps) {
  const isAvailable = book.available_copies > 0;
  const isCompact = variant === 'compact';

  // State 1: Ready for pickup (held copy)
  if (availability.isReady) {
    const deadline = availability.holdExpiresAt
      ? new Date(availability.holdExpiresAt).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;

    if (isCompact) {
      return (
        <div className={cn("flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5", className)}>
          <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-700 uppercase tracking-tight">Ready for Pickup</p>
            {deadline && <p className="text-[10px] font-bold text-emerald-600/70 mt-0.5">Claim by {deadline}</p>}
          </div>
          <span className="ml-auto animate-pulse inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.4)]" />
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 backdrop-blur-sm", className)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 shadow-inner">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-emerald-700 uppercase tracking-tight leading-tight">Copy Ready for Pickup</p>
          {deadline && (
            <p className="mt-0.5 text-[11px] font-bold text-emerald-600/70">
              Claim at the desk by <span className="text-emerald-700 font-black underline decoration-emerald-500/30 underline-offset-2">{deadline}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 animate-pulse">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.4)]" />
        </div>
      </div>
    );
  }

  // State 2: Has active queue reservation
  if (availability.hasReservation && availability.queuePosition) {
    if (isCompact) {
      return (
        <div className={cn("flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5", className)}>
          <Ticket className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-black text-primary uppercase tracking-tight">Queue Position #{availability.queuePosition}</p>
            <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">We&apos;ll notify you when assigned.</p>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 backdrop-blur-sm", className)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
          <Ticket className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-primary uppercase tracking-tight leading-tight">
            Queue Position #{availability.queuePosition}
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-muted-foreground/70">
            We&apos;ll notify you when a copy is assigned to you.
          </p>
        </div>
      </div>
    );
  }

  // State 3: Available on shelf
  if (isAvailable) {
    if (isCompact) {
      return (
        <div className={cn("flex items-center gap-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2.5", className)}>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-700 uppercase tracking-tight">
              {book.available_copies} {book.available_copies === 1 ? 'copy' : 'copies'} on shelf
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-4 backdrop-blur-sm", className)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-inner">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-emerald-700 uppercase tracking-tight leading-tight">
            {book.available_copies} {book.available_copies === 1 ? 'copy' : 'copies'} on shelf
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-muted-foreground/70">
            Reserve to secure this title for your next visit.
          </p>
        </div>
      </div>
    );
  }

  // State 4: Currently unavailable
  const returnDate = availability.nextAvailableDate
    ? new Date(availability.nextAvailableDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  if (isCompact) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2.5", className)}>
        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-black text-amber-700 uppercase tracking-tight">Currently Unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border border-amber-500/10 bg-amber-500/5 px-4 py-4 backdrop-blur-sm", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-inner">
        <Clock className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-amber-700 uppercase tracking-tight leading-tight">Currently Unavailable</p>
        <p className="mt-0.5 text-[11px] font-bold text-amber-600/70">
          {returnDate ? (
            <>Estimated availability <span className="text-amber-700 font-black">{returnDate}</span></>
          ) : (
            'Join the queue to be first in line when a copy returns.'
          )}
        </p>
      </div>
    </div>
  );
}
