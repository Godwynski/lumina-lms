'use client'

import React from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useNotifications } from '@/hooks/use-notifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NotificationList } from './NotificationList'

export function NotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    loading 
  } = useNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-xl hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-0.5 -right-0.5 h-5 min-w-5 flex items-center justify-center p-1 text-[10px] font-black rounded-lg border-2 border-background animate-in zoom-in-50 duration-300"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      {/* Adaptive width: full on mobile (via padding/margins), 320px on sm+ */}
      <DropdownMenuContent 
        align="end" 
        className="w-[calc(100vw-2rem)] sm:w-80 p-0 overflow-hidden rounded-2xl border-border/40 shadow-2xl backdrop-blur-md bg-card/95"
      >
        <DropdownMenuLabel className="px-5 py-4 flex items-center justify-between bg-muted/5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground/80">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[9px] font-bold text-primary/60 tracking-wider italic">{unreadCount} new events</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button 
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-all"
              onClick={markAllAsRead}
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="m-0 opacity-50" />
        
        <div className="max-h-[350px] overflow-y-auto">
          <NotificationList 
            notifications={notifications}
            loading={loading}
            onMarkRead={markAsRead}
            onDelete={deleteNotification}
            variant="compact"
          />
        </div>
        
        <DropdownMenuSeparator className="m-0 opacity-50" />
        
        <div className="p-3 bg-muted/5">
          <Link href="/notifications" className="block">
            <button 
              className="w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-primary transition-all text-center"
            >
              Expand Activity Log
            </button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
