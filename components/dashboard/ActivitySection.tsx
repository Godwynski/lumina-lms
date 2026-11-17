'use client';

import { BookOpen, Bookmark, XCircle, Ticket, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CardButton } from '@/components/ui/card-action';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useState } from 'react';
import { BorrowingRecord } from '@/lib/actions/history';
import { computeOverdueFine } from '@/lib/fines';
import { Reservation } from '@/lib/types';

function ActivityItemCover({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgSrc = failed || !src ? "/images/default-book-cover.png" : src;

  return (
    <span className="relative flex h-full w-full items-center justify-center bg-primary/5 text-primary/40">
      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <Image
        src={imgSrc}
        alt=""
        fill
        className={`object-cover transition-opacity duration-200 ${loaded || failed || !src ? 'opacity-100' : 'opacity-0'}`}
        unoptimized
        onLoad={(e) => {
          const img = e.currentTarget;
          if (src && !failed && (img.naturalWidth <= 1 || img.naturalHeight <= 1)) {
            setFailed(true);
          } else {
            setLoaded(true);
          }
        }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

interface ActivityProps {
  activeBorrows: BorrowingRecord[];
  reservations: Reservation[];
  attendanceLogs: { id: string; check_in_at: string; check_out_at: string | null }[];
  onOpenBook: (id: string) => void;
  onCancelReservation: (id: string, title: string) => void;
  isPending: boolean;
  mounted: boolean;
}

export function ActivitySection({
  activeBorrows,
  reservations,
  attendanceLogs,
  onOpenBook,
  onCancelReservation,
  isPending,
  mounted
}: ActivityProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* My Active Borrows */}
      <section className="min-w-0 overflow-hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Current Borrows
          </h2>
        </div>
        {activeBorrows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/40 rounded-xl bg-muted/10 text-muted-foreground">
            <BookOpen size={24} className="mb-2 text-muted-foreground/60" />
            <p className="text-xs font-medium">No active borrows</p>
          </div>
        ) : (
          <div className="grid gap-2 min-w-0">
            {activeBorrows.map((borrow) => {
              const fineOwed = computeOverdueFine(borrow);
              const isReturnedUnsettled = borrow.status === 'RETURNED' && fineOwed > 0 && !borrow.fine_settled_at;
              const isOverdue = !isReturnedUnsettled && (borrow.status === 'OVERDUE' || (mounted && new Date(borrow.due_date) < new Date()));
              return (
                <CardButton
                  key={borrow.id}
                  onClick={() => onOpenBook(borrow.books?.id || '')}
                  aria-label={`Open details for ${borrow.books?.title || 'this book'}`}
                  className="min-w-0 overflow-hidden border-border/30 bg-card/40 shadow-none transition-all hover:bg-muted/30 hover:border-primary/20 cursor-pointer group"
                >
                  <CardContent className="flex min-w-0 items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md bg-muted/30 overflow-hidden relative shadow-sm ring-1 ring-border/15 group-hover:ring-primary/25 transition-all">
                        <ActivityItemCover src={borrow.books?.cover_url} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{borrow.books?.title || 'Unknown Book'}</p>
                        <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
                          {isReturnedUnsettled
                            ? `Returned ${mounted && borrow.returned_at ? new Date(borrow.returned_at).toLocaleDateString() : '...'}`
                            : `Due ${mounted ? new Date(borrow.due_date).toLocaleDateString() : '...'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {fineOwed > 0 && (
                        <span className="text-xs font-bold text-destructive tabular-nums whitespace-nowrap">
                          ₱{fineOwed.toFixed(2)}
                        </span>
                      )}
                      <Badge variant={isReturnedUnsettled || isOverdue ? 'destructive' : 'outline'} className="text-xs px-2 py-0.5 whitespace-nowrap">
                        {isReturnedUnsettled ? 'Fine owed' : isOverdue ? 'Overdue' : 'Active'}
                      </Badge>
                    </div>
                  </CardContent>
                </CardButton>
              );
            })}
          </div>
        )}
      </section>

      {/* My Reservations & Holds */}
      <section className="min-w-0 overflow-hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
            <Ticket className="h-3.5 w-3.5" />
            Reservations
          </h2>
        </div>

        {reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/40 rounded-xl bg-muted/10 text-muted-foreground">
            <Bookmark className="h-5 w-5 text-muted-foreground/60 mb-2" />
            <p className="text-xs font-medium">No active reservations</p>
          </div>
        ) : (
          <div className="grid gap-2 min-w-0">
            {reservations.map((res) => {
              const isReady = res.status === 'READY';
              return (
                <Card key={res.id} className={`relative min-w-0 overflow-hidden border shadow-none transition-all ${isReady ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/30 bg-card/40'}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${isReady ? 'bg-emerald-500' : 'bg-primary/30'}`} />
                  <CardContent className="pl-4 pr-3 py-3 flex min-w-0 gap-3 items-center">
                    <button
                      type="button"
                      onClick={() => onOpenBook(res.books?.id ?? '')}
                      aria-label={`Open details for ${res.books?.title || 'this book'}`}
                      className="shrink-0 group cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="relative block h-10 w-7 rounded bg-muted/30 overflow-hidden shadow-sm ring-1 ring-border/15 group-hover:ring-primary/30 transition-all">
                        <ActivityItemCover src={res.books?.cover_url} />
                      </span>
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground leading-tight">
                        {res.books?.title || 'Unknown Book'}
                      </p>
                      <p className={`truncate text-xs font-medium ${isReady ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {isReady ? 'Ready for Pickup' : `Queue Position #${res.queue_position}`}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button type="button" aria-label={`Cancel reservation for ${res.books?.title || 'this book'}`} onClick={() => onCancelReservation(res.id, res.books?.title || 'Unknown Book')} disabled={isPending} className="min-h-11 sm:min-h-0 px-2 sm:px-0 text-xs font-medium text-muted-foreground hover:text-destructive inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-40">
                        <XCircle size={13} /> Cancel
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Attendance */}
      <section className="min-w-0 overflow-hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Recent Attendance
          </h2>
          <a href="/attendance" className="min-h-11 sm:min-h-0 px-1 sm:px-0 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap">
            View all <ArrowRight size={12} />
          </a>
        </div>

        {attendanceLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/40 rounded-xl bg-muted/10 text-muted-foreground">
            <Clock className="h-5 w-5 text-muted-foreground/60 mb-2" />
            <p className="text-xs font-medium">No logs yet</p>
          </div>
        ) : (
          <div className="grid gap-2 min-w-0">
            {attendanceLogs.map((log) => (
              <Card key={log.id} className="min-w-0 overflow-hidden border-border/30 bg-card/40 shadow-none">
                <CardContent className="p-3 flex items-center justify-between gap-2 min-w-0">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {mounted ? new Date(log.check_in_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '...'}
                    </p>
                    <div className="flex items-center gap-2.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground whitespace-nowrap">
                          {mounted ? new Date(log.check_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '--:--'}
                        </span>
                        <span className="text-2xs font-semibold text-emerald-700 uppercase">In</span>
                      </div>
                      <div className="h-4 w-px bg-border/60" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground whitespace-nowrap">
                          {log.check_out_at ? (mounted ? new Date(log.check_out_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '--:--') : 'Active'}
                        </span>
                        <span className="text-2xs font-semibold text-amber-700 uppercase">Out</span>
                      </div>
                    </div>
                  </div>
                  {log.check_out_at ? (
                    <Badge variant="outline" className="text-xs bg-muted/30 border-border/40 font-semibold shrink-0 whitespace-nowrap">
                      {(() => {
                        const start = new Date(log.check_in_at);
                        const end = new Date(log.check_out_at);
                        const diffMs = end.getTime() - start.getTime();
                        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        return `${diffHrs}h ${diffMins}m`;
                      })()}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-none text-xs font-semibold shrink-0 whitespace-nowrap">
                      Live
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
