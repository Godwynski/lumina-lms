'use client'

import React, { memo } from 'react'
import { 
  Check, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Bookmark, 
  CalendarOff, 
  Info,
  MoreVertical 
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Notification } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  variant?: 'compact' | 'full'
}

const typeConfig = {
  OVERDUE: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-500/10'
  },
  DUE_SOON: {
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  RESERVATION: {
    icon: Bookmark,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  RESERVATION_EXPIRED: {
    icon: CalendarOff,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10'
  },
  SYSTEM: {
    icon: Info,
    color: 'text-slate-500',
    bg: 'bg-slate-500/10'
  }
}

export const NotificationItem = memo(({ 
  notification, 
  onMarkRead, 
  onDelete,
  variant = 'full'
}: NotificationItemProps) => {
  const config = typeConfig[notification.type as keyof typeof typeConfig] || typeConfig.SYSTEM
  const Icon = config.icon

  return (
    <div className={cn(
      "group relative flex items-start gap-3 transition-all duration-200 border-b border-border/40 last:border-0",
      notification.is_read 
        ? "bg-transparent" 
        : "bg-primary/[0.03]",
      variant === 'compact' ? "p-3 px-4" : "p-4 px-5"
    )}>
      {/* Subtle Status Indicator */}
      <div className={cn(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all duration-300",
        notification.is_read ? "bg-muted-foreground/20" : "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]"
      )} />

      {/* Content Section */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Icon className={cn("h-4 w-4 shrink-0", notification.is_read ? "text-muted-foreground/50" : config.color)} />
            <h4 className={cn(
              "text-sm font-medium truncate transition-colors",
              !notification.is_read ? "text-foreground" : "text-muted-foreground"
            )}>
              {notification.title}
            </h4>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </span>
        </div>
        
        <p className={cn(
          "text-xs leading-relaxed font-medium transition-colors",
          notification.is_read ? "text-muted-foreground/60" : "text-muted-foreground",
          variant === 'compact' ? "line-clamp-1" : "line-clamp-2"
        )}>
          {notification.content}
        </p>

        {/* Inline Actions (Desktop Only) */}
        {!notification.is_read && (
          <div className="hidden sm:flex items-center gap-4 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onMarkRead(notification.id)}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3 h-3" />
              Mark as read
            </button>
            <button 
              onClick={() => onDelete(notification.id)}
              className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Compact Actions (Dropdown) - Subtle Trigger */}
      <div className="flex items-center self-start pt-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md opacity-0 group-hover:opacity-100 sm:opacity-0 transition-opacity text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!notification.is_read && (
              <DropdownMenuItem 
                onClick={() => onMarkRead(notification.id)}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Mark read
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => onDelete(notification.id)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})

NotificationItem.displayName = 'NotificationItem'
