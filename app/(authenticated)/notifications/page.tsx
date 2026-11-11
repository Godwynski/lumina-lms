'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { useNotifications, type Notification } from '@/hooks/use-notifications'
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
    olderUnread,
    markAsRead,
    markAllAsRead,
    loading,
    error,
    refresh,
    hasMore,
    loadingMore,
    loadMore,
    searchNotifications,
  } = useNotifications()

  const [search, setSearch] = React.useState('')
  // Server results for the current search; null when not searching.
  const [searchResults, setSearchResults] = React.useState<Notification[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const searchRequestRef = React.useRef(0)

  React.useEffect(() => {
    const term = search.trim()
    const requestId = ++searchRequestRef.current
    if (!term) {
      setSearchResults(null)
      setSearching(false)
      setSearchError(null)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const results = await searchNotifications(term)
      if (requestId !== searchRequestRef.current) return
      setSearching(false)
      if (results === null) {
        setSearchError("Search couldn't be completed.")
        setSearchResults([])
      } else {
        setSearchError(null)
        setSearchResults(results)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, searchNotifications])

  // Keep search results in sync when an item is marked read.
  const handleMarkRead = React.useCallback((id: string) => {
    void markAsRead(id)
    setSearchResults(prev => prev?.map(n => (n.id === id ? { ...n, is_read: true } : n)) ?? null)
  }, [markAsRead])

  const isSearching = searchResults !== null || searching
  const source = searchResults ?? notifications
  const unreadNotifications = source.filter(n => !n.is_read)
  const readNotifications = source.filter(n => n.is_read)
  const listLoading = loading || searching
  const listError = isSearching ? searchError : error

  const loadMoreButton = !isSearching && hasMore && !loading && (
    <div className="flex flex-col items-center gap-1 border-t border-border/40 p-3">
      <Button variant="ghost" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
        {loadingMore ? 'Loading...' : 'Load older notifications'}
      </Button>
      {olderUnread > 0 && (
        <span className="text-xs text-muted-foreground">
          {olderUnread} older unread {olderUnread === 1 ? 'notification' : 'notifications'} not shown yet
        </span>
      )}
    </div>
  )

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
          <TabsList aria-label="Filter notifications">
            <TabsTrigger value="all">
              All
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && (
                <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
              {unreadCount > 0 && <span className="sr-only"> ({unreadCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="read">
              History
            </TabsTrigger>
          </TabsList>

          <div className="relative flex-1 md:max-w-xs group w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search all notifications"
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
               notifications={source}
               loading={listLoading}
               onMarkRead={handleMarkRead}
               error={listError}
               onRetry={() => void refresh()}
               emptyMessage={search ? 'No matches found' : undefined}
             />
             {loadMoreButton}
          </TabsContent>
          <TabsContent value="unread" className="m-0 focus-visible:outline-none">
             <NotificationList
               notifications={unreadNotifications}
               loading={listLoading}
               onMarkRead={handleMarkRead}
               error={listError}
               onRetry={() => void refresh()}
               emptyMessage={!isSearching && olderUnread > 0 ? 'Load older notifications to see the rest' : 'No unread notifications'}
             />
             {loadMoreButton}
          </TabsContent>
          <TabsContent value="read" className="m-0 focus-visible:outline-none">
             <NotificationList
               notifications={readNotifications}
               loading={listLoading}
               onMarkRead={handleMarkRead}
               error={listError}
               onRetry={() => void refresh()}
               emptyMessage="No historical data"
             />
             {loadMoreButton}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
