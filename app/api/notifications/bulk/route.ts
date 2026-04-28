import { createClient } from '@/lib/supabase/server'
import { sendBulkNotifications } from '@/lib/notifications'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // 1. Verify if the requester is an admin/librarian
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'librarian') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Parse request body
    const { userIds, title, content, type, priority, metadata } = await request.json()

    if (!userIds || !Array.isArray(userIds) || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 3. Send bulk notifications
    const result = await sendBulkNotifications(userIds, {
      title,
      content,
      type: type || 'SYSTEM',
      priority: priority || 'high',
      metadata: metadata || {}
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: userIds.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
