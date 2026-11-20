'use client';

import { Megaphone, X } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';

// Shows the newest unread announcement; dismissing marks it read for this user only.
export function AnnouncementBanner() {
  const { notifications, markAsRead } = useNotifications();
  const announcement = notifications.find(n => !n.is_read && n.metadata?.announcement === true);
  if (!announcement) return null;

  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground break-words">{announcement.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-line break-words">{announcement.content}</p>
      </div>
      <button
        type="button"
        onClick={() => void markAsRead(announcement.id)}
        aria-label="Dismiss announcement"
        className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
