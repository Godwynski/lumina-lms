'use client'

import React from 'react'
import { Bell, Search, CheckCircle2 } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationItem } from '@/components/notifications/notification-bell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    loading,
    refresh
  } = useNotifications()

  const [search, setSearch] = React.useState('')

  const filteredNotifications = notifications.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) || 
    n.content.toLowerCase().includes(search.toLowerCase())
  )

  const unreadNotifications = filteredNotifications.filter(n => !n.is_read)
  const readNotifications = filteredNotifications.filter(n => n.is_read)

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Manage your alerts and system announcements.
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={refresh}>
             Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{notifications.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unread</span>
                <span className="font-medium text-primary">{unreadCount}</span>
              </div>
            </CardContent>
          </Card>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <Card className="min-h-[600px]">
            <Tabs defaultValue="all" className="w-full">
              <CardHeader className="p-0 border-b">
                <div className="px-4 pt-4 flex justify-between items-center">
                  <TabsList className="bg-transparent h-auto p-0 gap-4">
                    <TabsTrigger 
                      value="all" 
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2 h-auto"
                    >
                      All
                    </TabsTrigger>
                    <TabsTrigger 
                      value="unread"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2 h-auto"
                    >
                      Unread
                      {unreadCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary text-[10px] text-primary-foreground">
                          {unreadCount}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="read"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2 h-auto"
                    >
                      Archived
                    </TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <TabsContent value="all" className="m-0">
                   {renderList(filteredNotifications)}
                </TabsContent>
                <TabsContent value="unread" className="m-0">
                   {renderList(unreadNotifications)}
                </TabsContent>
                <TabsContent value="read" className="m-0">
                   {renderList(readNotifications)}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  )

  function renderList(list: typeof notifications) {
    if (loading) {
      return (
        <div className="divide-y">
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
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="p-4 rounded-full bg-muted">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">No notifications found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? 'Try adjusting your search criteria.' : "You're all caught up!"}
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="divide-y">
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
