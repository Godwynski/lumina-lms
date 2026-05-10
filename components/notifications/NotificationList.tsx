'use client'

import React from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Notification } from '@/hooks/use-notifications'
import { NotificationItem } from './NotificationItem'

interface NotificationListProps {
  notifications: Notification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  variant?: 'compact' | 'full'
  emptyMessage?: string
}

export function NotificationList({
  notifications,
  loading,
  onMarkRead,
  onDelete,
  variant = 'full',
  emptyMessage = "You're all caught up"
}: NotificationListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 text-primary/40 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
          Syncing...
        </span>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-muted/5 flex items-center justify-center border border-border/5">
          <Bell className="w-5 h-5 text-muted-foreground/20" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-muted-foreground/60">
            {emptyMessage}
          </p>
          <p className="text-[9px] uppercase tracking-[0.2em] font-black text-muted-foreground/20">
            System Idle
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {notifications.map((notification) => (
        <NotificationItem 
          key={notification.id} 
          notification={notification} 
          onMarkRead={onMarkRead}
          onDelete={onDelete}
          variant={variant}
        />
      ))}
    </div>
  )
}
