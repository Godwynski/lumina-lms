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
      // 1. Fetch user IDs
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

      // 2. Send notifications via bulk API route (uses Admin Client server-side)
      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds,
          title,
          content,
          type: 'SYSTEM',
          priority: 'high'
        })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">System Broadcast</h2>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mt-1">
            Priority notification dispatch
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Target Audience</label>
            <Select value={target} onValueChange={(v: 'all' | 'students') => setTarget(v)}>
              <SelectTrigger className="rounded-xl border-border/40 bg-muted/10 h-11 focus:ring-primary/20">
                <SelectValue placeholder="Select target" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40 shadow-2xl">
                <SelectItem value="students">All Students</SelectItem>
                <SelectItem value="all">All Registered Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Broadcast Title</label>
            <Input 
              placeholder="e.g. Library Closure Notice" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border-border/40 bg-muted/10 h-11 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Message Payload</label>
          <Textarea 
            placeholder="Write your announcement here..." 
            className="min-h-[120px] rounded-2xl border-border/40 bg-muted/10 p-4 focus-visible:ring-primary/20 resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <Button 
          className="w-full h-12 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-[0.98]" 
          disabled={loading || !title || !content}
          onClick={handleSend}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
             <Megaphone className="w-4 h-4 mr-2" />
          )}
          Dispatch Broadcast
        </Button>
      </div>
    </div>
  )
}
