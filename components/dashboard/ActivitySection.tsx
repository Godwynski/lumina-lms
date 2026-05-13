'use client';

import { Library, BookOpen, Bookmark, XCircle, Ticket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { BorrowingRecord } from '@/lib/actions/history';
import { Reservation } from '@/lib/types';

interface ActivityProps {
  activeBorrows: BorrowingRecord[];
  reservations: Reservation[];
  onOpenBook: (id: string) => void;
  onCancelReservation: (id: string, title: string) => void;
  isPending: boolean;
  mounted: boolean;
}

export function ActivitySection({ 
  activeBorrows, 
  reservations, 
  onOpenBook, 
  onCancelReservation, 
  isPending,
  mounted 
}: ActivityProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* My Active Borrows */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <BookOpen className="h-3 w-3 text-primary" />
            Current Loans
          </h2>
        </div>
        {activeBorrows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/20 rounded-2xl bg-muted/5 opacity-50">
             <BookOpen size={24} className="mb-2" />
             <p className="text-[10px] font-bold uppercase tracking-widest">No active loans</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {activeBorrows.map((borrow) => (
              <Card 
                key={borrow.id} 
                role="button"
                onClick={() => onOpenBook(borrow.books?.id || '')}
                className="border-border/20 bg-card/10 shadow-none transition-all hover:bg-muted/20 hover:border-primary/10 backdrop-blur-sm cursor-pointer group"
              >
                <CardContent className="flex items-center justify-between gap-4 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded-md bg-muted/20 overflow-hidden relative shadow-sm ring-1 ring-border/5 group-hover:ring-primary/20 transition-all">
                      {borrow.books?.cover_url ? (
                        <Image src={borrow.books.cover_url} alt="" fill className="object-cover" unoptimized />
                      ) : (
                        <Library size={12} className="text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors">{borrow.books?.title || 'Unknown Book'}</p>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-tight" suppressHydrationWarning>
                        Due {mounted ? new Date(borrow.due_date).toLocaleDateString() : '...'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={borrow.status === 'OVERDUE' || (mounted && new Date(borrow.due_date) < new Date()) ? 'destructive' : 'outline'} className="text-[9px] px-1.5 py-0">
                    {borrow.status === 'OVERDUE' || (mounted && new Date(borrow.due_date) < new Date()) ? 'Overdue' : 'Active'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* My Reservations & Holds */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
            <Ticket className="h-3 w-3" />
            Reservations
          </h2>
        </div>

        {reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/20 rounded-2xl bg-muted/5 opacity-50">
            <Bookmark className="h-5 w-5 text-muted-foreground/20 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No active reservations</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {reservations.map((res) => {
              const isReady = res.status === 'READY';
              return (
                <Card key={res.id} className={`relative overflow-hidden border shadow-none transition-all ${isReady ? 'border-emerald-500/20 bg-emerald-50/5' : 'border-border/20 bg-card/10 backdrop-blur-sm'}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${isReady ? 'bg-emerald-500' : 'bg-primary/30'}`} />
                  <CardContent className="pl-4 pr-3 py-3 flex gap-3 items-center">
                    <div 
                      role="button"
                      onClick={() => onOpenBook(res.books?.id ?? '')}
                      className="shrink-0 group cursor-pointer"
                    >
                      <div className="relative h-10 w-7 rounded bg-muted/20 overflow-hidden shadow-sm ring-1 ring-border/10 group-hover:ring-primary/30 transition-all">
                        {res.books?.cover_url ? (
                          <Image src={res.books.cover_url} alt="" fill className="object-cover" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Library size={12} className="text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-black text-foreground/90 leading-tight">
                        {res.books?.title || 'Unknown Book'}
                      </p>
                      <p className={`text-[9px] font-bold uppercase ${isReady ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {isReady ? 'Ready for Pickup' : `Queue Position #${res.queue_position}`}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button onClick={() => onCancelReservation(res.id, res.books?.title || 'Unknown Book')} disabled={isPending} className="text-[9px] font-bold text-muted-foreground/50 hover:text-destructive flex items-center gap-1 disabled:opacity-30">
                        <XCircle size={12} /> Cancel
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
