'use client'

import { useEffect, useState, useCallback } from 'react'
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
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching notifications:', error)
    } else {
      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.is_read).length || 0)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function setupNotifications() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) {
        if (active) setLoading(false)
        return
      }

      await fetchNotifications(user.id)
      if (!active) return

      // Subscribe to new notifications with a unique channel name to avoid collisions
      const channelName = `notifications-${user.id}-${Math.random().toString(36).slice(2, 9)}`
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
            
            // Show toast
            toast.info(newNotification.title, {
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
        .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              if (!active) return
              setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
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

  // Recalculate unread count whenever notifications change
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.is_read).length)
  }, [notifications])

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      toast.error('Failed to update notifications')
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete notification')
    } else {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await fetchNotifications(user.id)
    }
  }
}
