'use client'

import React from 'react'
import { Megaphone, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export function SystemAnnouncement() {
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [target, setTarget] = React.useState<'all' | 'students'>('students')
  const [loading, setLoading] = React.useState(false)
  const supabase = createClient()

  async function handleSend() {
    if (!title || !content) {
      toast.error('Title and content are required')
      return
    }

    setLoading(true)
    try {
      let query = supabase.from('profiles').select('id')
      if (target === 'students') {
        query = query.eq('role', 'student')
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const userIds = data.map(u => u.id)
      if (userIds.length === 0) {
        toast.error('No users found in target group')
        return
      }

      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, title, content, type: 'SYSTEM', priority: 'high' })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to send notifications')
      }

      toast.success(`Announcement sent to ${userIds.length} users`)
      setTitle('')
      setContent('')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-1">
            Target Group
          </label>
          <Select value={target} onValueChange={(v: 'all' | 'students') => setTarget(v)}>
            <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background/50 backdrop-blur-sm text-xs font-medium focus:ring-primary/20 transition-all">
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/40 shadow-2xl backdrop-blur-xl bg-background/95">
              <SelectItem value="students">All Students</SelectItem>
              <SelectItem value="all">Everyone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-1">
            Subject
          </label>
          <Input
            placeholder="e.g. Schedule Change"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-xl border-border/40 bg-background/50 backdrop-blur-sm text-xs font-medium focus-visible:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-1">
          Message Content
        </label>
        <Textarea
          placeholder="What would you like to announce?"
          className="min-h-[120px] rounded-xl border-border/40 bg-background/50 backdrop-blur-sm text-xs font-medium p-4 focus-visible:ring-primary/20 resize-none transition-all"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <Button
        className="h-11 w-full rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98] bg-primary hover:bg-primary/90"
        disabled={loading || !title || !content}
        onClick={handleSend}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : (
          <Megaphone className="w-3.5 h-3.5 mr-2" />
        )}
        Dispatch Announcement
      </Button>
    </div>
  )
}
