'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { OverflowActionsMenu } from '@/components/common/OverflowActionsMenu'
import { useNotifications, type Notification } from '@/hooks/use-notifications'
import { NotificationList } from '@/components/notifications/NotificationList'
import { NotificationDetailsDialog } from '@/components/notifications/NotificationDetailsDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TYPE_GROUPS: Record<string, Notification['type'][]> = {
  circulation: ['CIRCULATION', 'DUE_SOON', 'OVERDUE'],
  reservation: ['RESERVATION', 'RESERVATION_EXPIRED'],
  system: ['SYSTEM', 'ACCOUNT'],
}
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
    clearRead,
    loading,
    error,
    refresh,
    hasMore,
    loadingMore,
    loadMore,
    searchNotifications,
  } = useNotifications()

  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [selected, setSelected] = React.useState<Notification | null>(null)
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

  const handleOpen = React.useCallback((n: Notification) => {
    if (!n.is_read) handleMarkRead(n.id)
    setSelected(n)
  }, [handleMarkRead])

  const handleClearRead = () => {
    if (window.confirm('Delete all read notifications? This cannot be undone.')) void clearRead()
  }

  const isSearching = searchResults !== null || searching
  const allowedTypes = TYPE_GROUPS[typeFilter]
  const source = (searchResults ?? notifications).filter(n => !allowedTypes || allowedTypes.includes(n.type))
  const hasRead = notifications.some(n => n.is_read)
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
    <>
      <Tabs defaultValue="all" className="w-full space-y-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TabsList aria-label="Filter notifications" className="group-data-[orientation=horizontal]/tabs:h-auto">
            <TabsTrigger value="all" className="min-h-11 min-w-[44px] md:min-w-0 md:min-h-0 px-2 sm:px-3 text-xs sm:text-sm">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="min-h-11 md:min-h-0 px-2 sm:px-3 text-xs sm:text-sm">
              Unread
              {unreadCount > 0 && (
                <span className="ml-1.5 sm:ml-2 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
              {unreadCount > 0 && <span className="sr-only"> ({unreadCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="read" className="min-h-11 md:min-h-0 px-2 sm:px-3 text-xs sm:text-sm">
              History
            </TabsTrigger>
          </TabsList>

          <OverflowActionsMenu
            label="Notification actions"
            className="ml-auto lg:hidden"
            actions={[
              ...(unreadCount > 0 ? [{ id: 'clear-unread', label: 'Clear unread', onSelect: markAllAsRead }] : []),
              ...(hasRead ? [{ id: 'clear-read', label: 'Clear read', onSelect: handleClearRead }] : []),
            ]}
          />
          <div className="relative w-full min-w-0 lg:ml-auto lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search all notifications"
              placeholder="Filter events..."
              className="h-11 md:h-9 pl-9 rounded-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger aria-label="Filter by type" className="h-11 w-auto max-w-full shrink-0 rounded-lg text-xs lg:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="circulation">Circulation</SelectItem>
              <SelectItem value="reservation">Reservation</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="hidden h-9 shrink-0 rounded-lg px-3 text-xs font-semibold lg:inline-flex"
            >
              Clear unread
            </Button>
          )}
          {hasRead && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearRead}
              className="hidden h-9 shrink-0 rounded-lg px-3 text-xs font-semibold lg:inline-flex"
            >
              Clear read
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-xs overflow-hidden">
          <TabsContent value="all" className="m-0 focus-visible:outline-none">
             <NotificationList
               notifications={source}
               loading={listLoading}
               onMarkRead={handleMarkRead}
               onOpen={handleOpen}
               error={listError}
               onRetry={() => void refresh()}
               emptyMessage={search ? 'No matches found. Try another search keyword.' : "You're all caught up. Borrowing reminders and hold alerts will appear here."}
             />
             {loadMoreButton}
          </TabsContent>
          <TabsContent value="unread" className="m-0 focus-visible:outline-none">
             <NotificationList
               notifications={unreadNotifications}
               loading={listLoading}
               onMarkRead={handleMarkRead}
               onOpen={handleOpen}
               error={listError}
               onRetry={() => void refresh()}
               emptyMessage={!isSearching && olderUnread > 0 ? 'Load older notifications to see the rest.' : 'No unread notifications right now.'}
             />
             {loadMoreButton}
          </TabsContent>
          <TabsContent value="read" className="m-0 focus-visible:outline-none">
             <NotificationList
               notifications={readNotifications}
               loading={listLoading}
               onMarkRead={handleMarkRead}
               onOpen={handleOpen}
               error={listError}
               onRetry={() => void refresh()}
               emptyMessage="No read notification history yet."
             />
             {loadMoreButton}
          </TabsContent>
        </div>
      </Tabs>
      <NotificationDetailsDialog notification={selected} onClose={() => setSelected(null)} />
    </>
  )
}
