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
    <div className="space-y-6">
      <div className="flex justify-end gap-4">
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={markAllAsRead} 
          >
            Clear unread
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="w-full space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">
              All
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && (
                <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="read">
              History
            </TabsTrigger>
          </TabsList>

          <div className="relative flex-1 md:max-w-xs group w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter events..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border bg-card text-card-foreground shadow-sm">
          <TabsContent value="all" className="m-0 focus-visible:outline-none">
             <NotificationList 
               notifications={filteredNotifications} 
               loading={loading}
               onMarkRead={markAsRead}
               emptyMessage={search ? 'No matches found' : undefined}
             />
          </TabsContent>
          <TabsContent value="unread" className="m-0 focus-visible:outline-none">
             <NotificationList 
               notifications={unreadNotifications} 
               loading={loading}
               onMarkRead={markAsRead}
               emptyMessage="No unread notifications"
             />
          </TabsContent>
          <TabsContent value="read" className="m-0 focus-visible:outline-none">
             <NotificationList 
               notifications={readNotifications} 
               loading={loading}
               onMarkRead={markAsRead}
               emptyMessage="No historical data"
             />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
