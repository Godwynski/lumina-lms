"use client";

import { m } from "framer-motion";
import { BookMarked, UserCircle, MoveRight, Receipt, Clock, Undo2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface ActivityEvent {
  id: string;
  type: "checkout" | "return" | "overdue";
  bookTitle: string;
  userName: string;
  timestamp: string;
}

interface OperationalPulseFeedProps {
  activities: ActivityEvent[];
}

export function OperationalPulseFeed({ activities }: OperationalPulseFeedProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-2 mb-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/90">
          Operational Pulse
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-500/20 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live Feed
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {activities.map((event, idx) => (
          <m.div
            key={event.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: idx * 0.1, duration: 0.4 }}
            className="group flex items-start gap-4 rounded-xl border border-border/40 bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:bg-muted/30"
          >
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-inset ${
              event.type === 'checkout' ? 'bg-indigo-50 text-indigo-600 ring-indigo-500/10' :
              event.type === 'return' ? 'bg-emerald-50 text-emerald-600 ring-emerald-500/10' :
              'bg-amber-50 text-amber-600 ring-amber-500/10'
            }`}>
              {event.type === 'checkout' && <Receipt className="h-5 w-5" />}
              {event.type === 'return' && <Undo2 className="h-5 w-5" />}
              {event.type === 'overdue' && <Clock className="h-5 w-5" />}
            </div>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <p className="truncate text-xs font-heavy text-foreground group-hover:text-primary transition-colors">
                  {event.bookTitle}
                </p>
                <time className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground/60">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </time>
              </div>

              <div className="mt-1 flex items-center gap-2 overflow-hidden text-[11px] text-muted-foreground/80">
                <UserCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate italic">{event.userName}</span>
                <MoveRight className="h-3 w-3 shrink-0 opacity-40" />
                <span className={`font-bold uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded shadow-sm ring-1 ring-inset ${
                  event.type === 'checkout' ? 'bg-indigo-100 text-indigo-700 ring-indigo-500/10' :
                  event.type === 'return' ? 'bg-emerald-100 text-emerald-700 ring-emerald-500/10' :
                  'bg-amber-100 text-amber-700 ring-amber-500/10'
                }`}>
                  {event.type}
                </span>
              </div>
            </div>
          </m.div>
        ))}

        {activities.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center text-xs text-muted-foreground/60">
            <BookMarked className="mb-2 h-8 w-8 opacity-20" />
            Waiting for activity pulse...
          </div>
        )}
      </div>
    </div>
  );
}
