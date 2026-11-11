'use client'

import React from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Notification } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getTargetUrl, typeConfig } from './NotificationItem'

interface NotificationDetailsDialogProps {
  notification: Notification | null
  onClose: () => void
}

export function NotificationDetailsDialog({ notification, onClose }: NotificationDetailsDialogProps) {
  // Keep the last notification rendered while the close animation plays.
  const [shown, setShown] = React.useState(notification)
  if (notification && notification !== shown) setShown(notification)

  const config = typeConfig[shown?.type as keyof typeof typeConfig] || typeConfig.SYSTEM
  const Icon = config.icon
  const targetUrl = shown ? getTargetUrl(shown.type) : null

  return (
    <Dialog open={notification !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {shown && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", config.bg, config.color)}>
                  <Icon className="h-3.5 w-3.5" />
                  {shown.type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(shown.created_at), { addSuffix: true })}
                </span>
              </div>
              <DialogTitle className="break-words leading-snug pr-6">{shown.title}</DialogTitle>
            </DialogHeader>
            <DialogDescription className="max-h-[50vh] overflow-y-auto whitespace-pre-line break-words text-foreground/80">
              {shown.content}
            </DialogDescription>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              {targetUrl && (
                <Button asChild>
                  <Link href={targetUrl} onClick={onClose}>Open</Link>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
