'use client'

import React from 'react'
import { Bell, Search, CheckCircle2 } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationItem } from '@/components/notifications/notification-bell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
    <div className="container max-w-2xl py-8 mx-auto space-y-6">
      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-4 gap-4">
          <TabsList className="bg-transparent h-auto p-0 gap-6">
            <TabsTrigger 
              value="all" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 h-auto text-sm font-medium"
            >
              All
            </TabsTrigger>
            <TabsTrigger 
              value="unread"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 h-auto text-sm font-medium"
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary text-[10px] text-primary-foreground font-semibold">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="read"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 h-auto text-sm font-medium"
            >
              Archived
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-muted/30 border-transparent focus-visible:border-primary h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-9 text-xs text-muted-foreground hover:text-foreground shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only sm:ml-2">Mark all as read</span>
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-[400px]">
          <TabsContent value="all" className="m-0">
             {renderList(filteredNotifications)}
          </TabsContent>
          <TabsContent value="unread" className="m-0">
             {renderList(unreadNotifications)}
          </TabsContent>
          <TabsContent value="read" className="m-0">
             {renderList(readNotifications)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )

  function renderList(list: typeof notifications) {
    if (loading) {
      return (
        <div className="divide-y border border-transparent">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      )
    }

    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="p-3 rounded-full bg-muted/50">
            <Bell className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'No notifications match your search' : "You're all caught up"}
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="divide-y divide-border/50 border rounded-lg overflow-hidden bg-card">
        {list.map((notification) => (
          <NotificationItem 
            key={notification.id} 
            notification={notification} 
            onMarkRead={markAsRead}
            onDelete={deleteNotification}
          />
        ))}
      </div>
    )
  }
}
