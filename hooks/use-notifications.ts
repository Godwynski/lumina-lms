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

export function useNotifications() {
  const [supabase] = useState(() => createClient())
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Unread notifications older than the 50 loaded ones (the badge must count them too)
  const [olderUnread, setOlderUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  // Cache userId to avoid redundant getUser() network calls
  const userIdRef = useRef<string | null>(null)

  const fetchNotifications = useCallback(async (userId: string) => {
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false),
    ])

    if (error) {
      console.error('Error fetching notifications:', error)
    } else {
      const loaded = data || []
      setNotifications(loaded)
      setOlderUnread(Math.max(0, (count ?? 0) - loaded.filter(n => !n.is_read).length))
    }
    setLoading(false)
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
            setNotifications(prev => [newNotification, ...prev])
            
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
        .subscribe()
    }

    setupNotifications()

    return () => {
      active = false
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
    loading,
    markAsRead,
    markAllAsRead,
    refresh: async () => {
        // Use cached userId instead of re-fetching from auth endpoint
        const userId = userIdRef.current
        if (userId) await fetchNotifications(userId)
    }
  }
}
