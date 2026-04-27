'use client'

import React from 'react'
import { Megaphone, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
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

      // 2. Send notifications (via server action or utility)
      // Since sendBulkNotifications is a server-side utility using Admin Client, 
      // I should ideally call it from a Server Action.
      // For now, I'll use a dynamic import or a simpler approach if I can't call it directly from client.
      
      // I'll create a server action for this.
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
    <Card className="border-border/40 bg-card/20 shadow-none backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <CardTitle>System Announcement</CardTitle>
        </div>
        <CardDescription>
          Send a priority notification to users. This will appear in their notification bell.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Target Audience</label>
          <Select value={target} onValueChange={(v: 'all' | 'students') => setTarget(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="students">All Students</SelectItem>
              <SelectItem value="all">All Registered Users</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input 
            placeholder="e.g. Library Closure Notice" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Message Content</label>
          <Textarea 
            placeholder="Write your announcement here..." 
            className="min-h-[100px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          disabled={loading || !title || !content}
          onClick={handleSend}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Broadcast Announcement
        </Button>
      </CardFooter>
    </Card>
  )
}
