'use client'

import React from 'react'
import { NotificationsContext, useNotificationsState } from '@/hooks/use-notifications'

/**
 * Shares a single notification fetch, realtime channel, and window listeners
 * across the mobile bell, desktop bell, and notifications page.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const value = useNotificationsState(true)
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}
