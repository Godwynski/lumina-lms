'use client'

import React, { useState } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useNotifications, type Notification } from '@/hooks/use-notifications'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NotificationList } from './NotificationList'
import { NotificationDetailsDialog } from './NotificationDetailsDialog'

export function NotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    loading,
    error,
    refresh
  } = useNotifications()
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState<Notification | null>(null)

  const handleOpen = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id)
    setSelected(notification)
  }

  return (
    <>
    <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-xl hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-0.5 -right-0.5 h-5 min-w-5 flex items-center justify-center p-1 text-[11px] font-black rounded-lg border-2 border-background animate-in zoom-in-50 duration-300"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      {/* Adaptive width: full on mobile (via padding/margins), 320px on sm+ */}
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[90dvh] w-[calc(100vw-2rem)] sm:max-w-sm p-0 gap-0 overflow-y-auto rounded-2xl border-border/40 shadow-2xl backdrop-blur-md bg-card/95"
      >
        <div className="pl-5 pr-12 py-4 flex items-center justify-between bg-muted/5">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-sm font-bold text-foreground">Notifications</DialogTitle>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold text-primary tracking-wider italic">{unreadCount} new events</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button 
              className="text-[11px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-all"
              onClick={markAllAsRead}
            >
              Mark all read
            </button>
          )}
        </div>
        
        <hr className="m-0 opacity-50" />
        
        <div className="max-h-[350px] overflow-y-auto">
          <NotificationList 
            notifications={notifications}
            loading={loading}
            onMarkRead={markAsRead}
            onOpen={handleOpen}
            error={error}
            onRetry={() => void refresh()}
            variant="compact"
          />
        </div>
        
        <hr className="m-0 opacity-50" />
        
        <div className="p-3 bg-muted/5">
          <Link 
            href="/notifications" onClick={() => setMenuOpen(false)}
            className="block w-full py-2 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all text-center"
          >
            Expand Activity Log
          </Link>
        </div>
      </DialogContent>
    </Dialog>

    <NotificationDetailsDialog notification={selected} onClose={() => setSelected(null)} />
    </>
  )
}
