'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationList } from '@/components/notifications/NotificationList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'

export default function NotificationsPage() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    loading
  } = useNotifications()

  const [search, setSearch] = React.useState('')

  const filteredNotifications = notifications.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) || 
    n.content.toLowerCase().includes(search.toLowerCase())
  )

  const unreadNotifications = filteredNotifications.filter(n => !n.is_read)
  const readNotifications = filteredNotifications.filter(n => n.is_read)

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2 px-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-black tracking-tight text-foreground/90">
            Notifications
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            {notifications.length} recent events
          </p>
        </div>
        
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={markAllAsRead} 
            className="h-8 px-3 rounded-lg border-border/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            Clear unread
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="w-full space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/10 p-1.5 rounded-xl border border-border/5">
          <TabsList className="bg-transparent h-8 p-0 rounded-lg gap-1">
            <TabsTrigger 
              value="all" 
              className="rounded-md px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] font-black uppercase tracking-widest transition-all h-full"
            >
              All
            </TabsTrigger>
            <TabsTrigger 
              value="unread"
              className="rounded-md px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] font-black uppercase tracking-widest transition-all h-full relative"
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="read"
              className="rounded-md px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] font-black uppercase tracking-widest transition-all h-full"
            >
              History
            </TabsTrigger>
          </TabsList>

          <div className="relative flex-1 md:max-w-xs group w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Filter events..."
              className="pl-8 h-8 bg-background border-border/40 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-lg text-[11px] font-medium transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/20 overflow-hidden shadow-sm">
          <TabsContent value="all" className="m-0 focus-visible:outline-none">
             <NotificationList 
               notifications={filteredNotifications} 
               loading={loading}
               onMarkRead={markAsRead}
               onDelete={deleteNotification}
               emptyMessage={search ? 'No matches found' : undefined}
             />
          </TabsContent>
          <TabsContent value="unread" className="m-0 focus-visible:outline-none">
             <NotificationList 
               notifications={unreadNotifications} 
               loading={loading}
               onMarkRead={markAsRead}
               onDelete={deleteNotification}
               emptyMessage="No unread notifications"
             />
          </TabsContent>
          <TabsContent value="read" className="m-0 focus-visible:outline-none">
             <NotificationList 
               notifications={readNotifications} 
               loading={loading}
               onMarkRead={markAsRead}
               onDelete={deleteNotification}
               emptyMessage="No historical data"
             />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
