'use client'

import React, { useState } from 'react'
import { Megaphone, Loader2, Users, Send, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Component for broadcasting system-wide announcements to users.
 */
export function SystemAnnouncement() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [target, setTarget] = useState<'all' | 'students'>('students')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  /**
   * Handles sending the announcement to the selected target group.
   */
  async function handleSend() {
    if (!title.trim() || !content.trim()) {
      toast.error('Subject and message content are required')
      return
    }

    setLoading(true)
    try {
      // 1. Fetch target user IDs
      let query = supabase.from('profiles').select('id')
      if (target === 'students') {
        query = query.eq('role', 'student')
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const userIds = data.map(u => u.id)
      if (userIds.length === 0) {
        toast.error('No users found in the selected target group')
        return
      }

      // 2. Send bulk notifications via API
      const response = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userIds, 
          title: title.trim(), 
          content: content.trim(), 
          type: 'SYSTEM', 
          priority: 'high' 
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to dispatch notifications')
      }

      toast.success(`Announcement successfully dispatched to ${userIds.length} users`)
      setTitle('')
      setContent('')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = title.trim() && content.trim()

  return (
    <div className="w-full space-y-8 p-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2.5">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 ml-1 flex items-center gap-2">
            <Target className="h-3 w-3" />
            Target Audience
          </label>
          <Select value={target} onValueChange={(v: 'all' | 'students') => setTarget(v)}>
            <SelectTrigger className="h-12 rounded-2xl border-border/20 bg-muted/5 backdrop-blur-sm text-xs font-bold focus:ring-4 focus:ring-primary/5 transition-all duration-300">
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/40 shadow-2xl backdrop-blur-xl bg-background/95">
              <SelectItem value="students" className="py-3 px-4 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 opacity-40" />
                  All Students Only
                </div>
              </SelectItem>
              <SelectItem value="all" className="py-3 px-4 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 opacity-40" />
                  Universal Broadcast (Everyone)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2.5">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 ml-1">
            Subject Heading
          </label>
          <Input
            placeholder="e.g. Mandatory System Maintenance"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 rounded-2xl border-border/20 bg-muted/5 backdrop-blur-sm text-xs font-bold focus-visible:ring-4 focus-visible:ring-primary/5 transition-all duration-300 placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 ml-1">
          Detailed Message Payload
        </label>
        <Textarea
          placeholder="Craft your system announcement here. Use clear and concise language..."
          className="min-h-[160px] rounded-[1.5rem] border-border/20 bg-muted/5 backdrop-blur-sm text-xs font-medium p-5 focus-visible:ring-4 focus-visible:ring-primary/5 resize-none transition-all duration-500 shadow-inner"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          className={cn(
            "h-14 flex-1 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-500",
            isFormValid ? "shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01]" : "opacity-50 grayscale",
            "active:scale-95"
          )}
          disabled={loading || !isFormValid}
          onClick={handleSend}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2.5 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2.5" />
          )}
          Dispatch Protocol
        </Button>
      </div>
    </div>
  )
}

