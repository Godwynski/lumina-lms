'use client'

import React from 'react'
import { Bell, Check, Trash2, Circle } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications, Notification } from '@/hooks/use-notifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function NotificationItem({ 
  notification, 
  onMarkRead, 
  onDelete 
}: { 
  notification: Notification,
  onMarkRead: (id: string) => void,
  onDelete: (id: string) => void
}) {
  return (
    <div className={cn(
      "group flex flex-col gap-1 p-4 transition-colors hover:bg-muted/50 relative",
      !notification.is_read && "bg-primary/5"
    )}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex gap-2">
          {notification.type === 'DUE_SOON' && <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
          {notification.type === 'OVERDUE' && <div className="mt-1 h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />}
          {notification.type === 'RESERVATION' && <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
          {notification.type === 'RESERVATION_EXPIRED' && <div className="mt-1 h-2 w-2 rounded-full bg-gray-500 shrink-0" />}
          
          <h4 className={cn(
            "text-sm font-semibold leading-none",
            !notification.is_read ? "text-primary" : "text-foreground/70"
          )}>
            {notification.title}
          </h4>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {notification.content}
      </p>
      
      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs" 
            onClick={(e) => {
              e.stopPropagation()
              onMarkRead(notification.id)
            }}
          >
            <Check className="w-3 h-3 mr-1" />
            Mark read
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-xs text-destructive hover:text-destructive" 
          onClick={(e) => {
            e.stopPropagation()
            onDelete(notification.id)
          }}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>
      
      {!notification.is_read && (
        <Circle className="absolute left-1.5 top-1.5 w-1.5 h-1.5 fill-primary text-primary" />
      )}
    </div>
  )
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, loading } = useNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full border-2 border-background"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
        <DropdownMenuLabel className="p-4 flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-xs text-primary hover:bg-transparent"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
                onMarkRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))
          )}
        </div>
        
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem className="p-0">
          <Link href="/notifications" className="w-full">
            <Button variant="ghost" className="w-full rounded-none h-10 text-xs font-medium">
              View all notifications
            </Button>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
