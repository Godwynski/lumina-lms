'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AnimatePresence, m } from 'framer-motion';
import { Zap, BookOpen, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LibraryEvent {
  id: string;
  type: 'borrow' | 'return' | 'book_add' | 'user_add';
  title: string;
  timestamp: string;
}

export function LiveActivityTicker() {
  const [events, setEvents] = useState<LibraryEvent[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('live-tickers')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borrowing_records' }, async (payload) => {
        // Fetch book info for the title
        const { data: book } = await supabase.from('books').select('title').eq('id', payload.new.book_id).single();
        const event: LibraryEvent = {
          id: payload.new.id,
          type: payload.new.status === 'RETURNED' ? 'return' : 'borrow',
          title: book?.title || 'Resource',
          timestamp: new Date().toISOString(),
        };
        setEvents(prev => [event, ...prev].slice(0, 3));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'books' }, (payload) => {
        const event: LibraryEvent = {
          id: payload.new.id,
          type: 'book_add',
          title: payload.new.title,
          timestamp: new Date().toISOString(),
        };
        setEvents(prev => [event, ...prev].slice(0, 3));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 overflow-hidden pointer-events-none sticky bottom-14 left-0 right-0 z-50 p-6 md:absolute md:bottom-auto md:top-6 md:right-6 md:left-auto md:p-0 md:max-w-xs">
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <m.div
            key={event.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-2xl border backdrop-blur-md shadow-lg",
              "bg-background/80 border-border/50 shadow-primary/5"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl text-white",
              event.type === 'borrow' ? "bg-primary" : 
              event.type === 'return' ? "bg-emerald-500" : "bg-amber-500"
            )}>
              {event.type === 'borrow' ? <BookOpen size={14} /> : 
               event.type === 'return' ? <History size={14} /> : <Zap size={14} />}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                  {event.type === 'borrow' ? 'Loan Processed' : 
                   event.type === 'return' ? 'Return Confirmed' : 'New Arrival'}
               </p>
               <p className="text-xs font-bold truncate pr-4 text-foreground/90">{event.title}</p>
            </div>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
