'use client'

import React from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Notification } from '@/hooks/use-notifications'
import { NotificationItem } from './NotificationItem'

interface NotificationListProps {
  notifications: Notification[]
  loading: boolean
  onMarkRead: (id: string) => void
  variant?: 'compact' | 'full'
  emptyMessage?: string
}

export function NotificationList({
  notifications,
  loading,
  onMarkRead,
  variant = 'full',
  emptyMessage = "You're all caught up"
}: NotificationListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        <span className="text-sm text-muted-foreground">
          Loading...
        </span>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Bell className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {emptyMessage}
        </p>
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
          variant={variant}
        />
      ))}
    </div>
  )
}
