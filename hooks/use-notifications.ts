'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface Notification {
  id: string
  user_id: string
  title: string
  content: string
  type: 'SYSTEM' | 'CIRCULATION' | 'RESERVATION' | 'OVERDUE' | 'ACCOUNT' | 'DUE_SOON' | 'RESERVATION_EXPIRED'
  priority: 'low' | 'medium' | 'high'
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

const PAGE_SIZE = 50

export function useNotifications() {
  const [supabase] = useState(() => createClient())
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Unread notifications older than the loaded ones (the badge must count them too)
  const [olderUnread, setOlderUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Cache userId to avoid redundant getUser() network calls
  const userIdRef = useRef<string | null>(null)

  const fetchNotifications = useCallback(async (userId: string) => {
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false),
    ])

    if (error) {
      console.error('Error fetching notifications:', error)
      setError("Notifications couldn't be loaded.")
    } else {
      const loaded = data || []
      setError(null)
      setNotifications(loaded)
      setHasMore(loaded.length === PAGE_SIZE)
      setOlderUnread(Math.max(0, (count ?? 0) - loaded.filter(n => !n.is_read).length))
    }
    setLoading(false)
  }, [supabase])

  // Load the next page of older notifications.
  const loadMore = useCallback(async () => {
    const userId = userIdRef.current
    const oldest = notifications[notifications.length - 1]
    if (!userId || !oldest || loadingMore) return

    setLoadingMore(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    setLoadingMore(false)

    if (error) {
      toast.error("Couldn't load older notifications")
      return
    }
    const page = (data || []) as Notification[]
    setNotifications(prev => {
      const seen = new Set(prev.map(n => n.id))
      return [...prev, ...page.filter(n => !seen.has(n.id))]
    })
    setOlderUnread(prev => Math.max(0, prev - page.filter(n => !n.is_read).length))
    setHasMore(page.length === PAGE_SIZE)
  }, [supabase, notifications, loadingMore])

  // Search every notification on the server, not just the loaded page.
  const searchNotifications = useCallback(async (term: string): Promise<Notification[] | null> => {
    const userId = userIdRef.current
    // Strip characters that have meaning in PostgREST filter syntax.
    const clean = term.replace(/[,()%*\\:]/g, ' ').trim()
    if (!userId || !clean) return []
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${clean}%,content.ilike.%${clean}%`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return null
    return (data || []) as Notification[]
  }, [supabase])

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function setupNotifications() {
      // getSession() reads the session locally (no network round-trip). It is only used for
      // the user id; it is not a security check, since RLS verifies the token on every query.
      // proxy.ts and the browser client keep the token refreshed.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !active) {
        if (active) setLoading(false)
        return
      }
      const user = session.user

      // Cache userId for use in markAllAsRead/refresh without re-fetching
      userIdRef.current = user.id

      await fetchNotifications(user.id)
      if (!active) return

      // Subscribe to new notifications with a unique channel name to avoid collisions
      const channelName = `notifications-${user.id}-${crypto.randomUUID()}`
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!active) return
            const newNotification = payload.new as Notification
            setNotifications(prev => prev.some(n => n.id === newNotification.id) ? prev : [newNotification, ...prev])
            
            // Show toast (deduplicated by notification ID)
            toast.info(newNotification.title, {
              id: `notification-${newNotification.id}`,
              description: newNotification.content,
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!active) return
            const updated = payload.new as Notification
            setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n))
          }
        )
        .subscribe((status) => {
          // Reload after joining/rejoining to recover messages missed while disconnected.
          if (active && status === 'SUBSCRIBED') void fetchNotifications(user.id);
        })
    }

    setupNotifications()
    const refreshVisible = () => {
      if (active && document.visibilityState === 'visible' && userIdRef.current) {
        void fetchNotifications(userIdRef.current);
      }
    };
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);

    return () => {
      active = false
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase, fetchNotifications])

  const unreadCount = olderUnread + notifications.filter(n => !n.is_read).length

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update notification')
    } else {
      // An unread item that isn't loaded (e.g. from search) was counted in olderUnread.
      if (!notifications.some(n => n.id === id)) setOlderUnread(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    }
  }

  const markAllAsRead = async () => {
    // Use cached userId instead of re-fetching from auth endpoint
    const userId = userIdRef.current
    if (!userId) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      toast.error('Failed to update notifications')
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setOlderUnread(0)
    }
  }


  return {
    notifications,
    unreadCount,
    olderUnread,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    searchNotifications,
    markAsRead,
    markAllAsRead,
    refresh: async () => {
        // Use cached userId instead of re-fetching from auth endpoint
        const userId = userIdRef.current
        if (userId) {
          setLoading(true)
          await fetchNotifications(userId)
        }
    }
  }
}
