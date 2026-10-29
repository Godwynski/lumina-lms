'use client'

import React, { useState } from 'react'
import { Megaphone, Loader2, Users, Send, Target, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export interface AnnouncementDraft {
  title: string
  content: string
  target: 'all' | 'students'
}

interface SystemAnnouncementProps {
  draft?: AnnouncementDraft
  onDraftChange?: (draft: AnnouncementDraft) => void
  onClearDraft?: () => void
}

/**
 * Minimalist component for broadcasting system-wide announcements to users.
 */
export function SystemAnnouncement({
  draft,
  onDraftChange,
  onClearDraft,
}: SystemAnnouncementProps = {}) {
  const [localTitle, setLocalTitle] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [localTarget, setLocalTarget] = useState<'all' | 'students'>('students')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const title = draft ? draft.title : localTitle
  const content = draft ? draft.content : localContent
  const target = draft ? draft.target : localTarget

  const setTitle = (val: string) => {
    if (draft && onDraftChange) {
      onDraftChange({ ...draft, title: val })
    } else {
      setLocalTitle(val)
    }
  }

  const setContent = (val: string) => {
    if (draft && onDraftChange) {
      onDraftChange({ ...draft, content: val })
    } else {
      setLocalContent(val)
    }
  }

  const setTarget = (val: 'all' | 'students') => {
    if (draft && onDraftChange) {
      onDraftChange({ ...draft, target: val })
    } else {
      setLocalTarget(val)
    }
  }

  const handleReset = () => {
    if (onClearDraft) {
      onClearDraft()
    } else {
      setLocalTitle('')
      setLocalContent('')
      setLocalTarget('students')
    }
  }

  /**
   * Dispatches the announcement to the selected audience.
   */
  async function handleSend() {
    if (!title.trim() || !content.trim()) {
      toast.error('Subject and message content are required')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target, 
          title: title.trim(), 
          content: content.trim(), 
          type: 'SYSTEM', 
          priority: 'high' 
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send announcement')
      }

      toast.success(`Announcement sent to ${data.count ?? 'all'} users`)
      handleReset()
      setConfirmOpen(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const isDirty = title.trim().length > 0 || content.trim().length > 0
  const isFormValid = title.trim().length > 0 && content.trim().length > 0

  return (
    <div className="w-full space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            Target Audience
          </label>
          <Select value={target} onValueChange={(v: 'all' | 'students') => setTarget(v)}>
            <SelectTrigger className="h-10 rounded-xl border-border bg-background text-xs font-medium focus:ring-2 focus:ring-primary/20 transition-all">
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border shadow-xl">
              <SelectItem value="students" className="py-2.5 px-3 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Students Only</span>
                </div>
              </SelectItem>
              <SelectItem value="all" className="py-2.5 px-3 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>All Registered Users (Students, Staff, Faculty)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Subject
          </label>
          <Input
            placeholder="e.g. Scheduled Library Maintenance This Weekend"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="h-10 rounded-xl border-border bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-foreground">
            Announcement Message
          </label>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {content.length}/500
          </span>
        </div>
        <Textarea
          placeholder="Write the announcement message here. It will be pushed directly to active student and staff dashboards..."
          maxLength={500}
          className="min-h-[120px] rounded-xl border-border bg-background text-sm font-medium p-3.5 focus:ring-2 focus:ring-primary/20 resize-none transition-all placeholder:text-muted-foreground/40 shadow-xs"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        {isDirty ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={loading}
            className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
          >
            Discard Draft
          </Button>
        ) : (
          <div />
        )}
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={loading || !isFormValid}
          className="h-10 px-6 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition-all"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5 mr-2" />
          )}
          Send Announcement
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl border-border bg-background p-0 shadow-xl sm:max-w-md overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  Confirm Announcement Broadcast
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Verify the announcement before sending.
                </DialogDescription>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1.5 text-xs">
              <p className="font-semibold text-foreground">
                Subject: <span className="font-normal text-muted-foreground">{title}</span>
              </p>
              <p className="font-semibold text-foreground">
                Audience: <span className="font-normal text-muted-foreground">{target === 'all' ? 'All Users (Everyone)' : 'Students Only'}</span>
              </p>
              <p className="text-muted-foreground/80 line-clamp-3 italic pt-1 border-t border-border/30">
                &ldquo;{content}&rdquo;
              </p>
            </div>
          </div>

          <div className="p-6 pt-0 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
              className="flex-1 h-10 rounded-xl text-xs font-semibold uppercase tracking-wider border-border hover:bg-muted/50 transition-all"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className="flex-[1.5] h-10 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition-all"
            >
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : "Confirm & Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
