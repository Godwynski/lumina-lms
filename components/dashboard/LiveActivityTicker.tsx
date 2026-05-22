'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AnimatePresence, m } from 'framer-motion';
import { Zap, BookOpen, History, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LibraryEvent {
  id: string;
  type: 'borrow' | 'return' | 'book_add' | 'user_add';
  title: string;
  timestamp: string;
}

interface ToastItemProps {
  event: LibraryEvent;
  onDismiss: (id: string) => void;
}

function ToastItem({ event, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(event.id);
    }, 8000); // 8 seconds auto-dismiss
    return () => clearTimeout(timer);
  }, [event.id, onDismiss]);

  return (
    <m.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl border backdrop-blur-md shadow-lg pointer-events-auto",
        "bg-background/80 border-border/50 shadow-primary/5"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl text-white shrink-0",
        event.type === 'borrow' ? "bg-primary" : 
        event.type === 'return' ? "bg-emerald-500" : "bg-amber-500"
      )}>
        {event.type === 'borrow' ? <BookOpen size={14} /> : 
         event.type === 'return' ? <History size={14} /> : <Zap size={14} />}
      </div>
      <div className="flex-1 min-w-0 pr-1">
         <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
            {event.type === 'borrow' ? 'Borrow Processed' : 
             event.type === 'return' ? 'Return Confirmed' : 'New Arrival'}
         </p>
         <p className="text-xs font-bold truncate text-foreground/90">{event.title}</p>
      </div>
      <button
        onClick={() => onDismiss(event.id)}
        className="p-1 rounded-lg hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </m.div>
  );
}

export function LiveActivityTicker() {
  const [events, setEvents] = useState<LibraryEvent[]>([]);
  const [supabase] = useState(() => createClient());

  const handleDismiss = useCallback((id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('live-tickers')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borrowing_records' }, async (payload) => {
        const bookCopyId = payload.new.book_copy_id;
        if (!bookCopyId) return;

        const { data: copy } = await supabase
          .from('book_copies')
          .select('books(title)')
          .eq('id', bookCopyId)
          .single();

        const bookTitle = (copy?.books as unknown as { title: string } | null)?.title || 'Resource';
        const event: LibraryEvent = {
          id: payload.new.id,
          type: payload.new.status === 'RETURNED' ? 'return' : 'borrow',
          title: bookTitle,
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
  }, [supabase]);

  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 overflow-hidden pointer-events-none fixed bottom-4 right-4 z-50 p-4 md:p-0 w-full max-w-[calc(100vw-2rem)] md:max-w-xs">
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <ToastItem key={event.id} event={event} onDismiss={handleDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

