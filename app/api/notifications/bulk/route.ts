import { createClient } from '@/lib/supabase/server'
import { sendBulkNotifications } from '@/lib/notifications'
import { NextResponse } from 'next/server'
import { BulkNotificationSchema } from '@/lib/validations/api'

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

    if (profile?.role !== 'super_admin' && profile?.role !== 'librarian') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Parse request body
    let rawBody: unknown;
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = BulkNotificationSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Missing required fields' },
        { status: 400 }
      )
    }

    const { userIds, target, title, content, type, priority, metadata } = parseResult.data

    let resolvedUserIds = userIds || []
    if (target) {
      let query = supabase.from('profiles').select('id')
      if (target === 'students') {
        query = query.eq('role', 'student')
      }
      const { data: targetUsers, error: targetError } = await query
      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 400 })
      }
      resolvedUserIds = (targetUsers || []).map((u) => u.id)
    }

    if (resolvedUserIds.length === 0) {
      return NextResponse.json({ error: 'No recipients found for notification' }, { status: 400 })
    }

    // 3. Send bulk notifications
    const result = await sendBulkNotifications(resolvedUserIds, {
      title,
      content,
      type: type || 'SYSTEM',
      priority: priority || 'high',
      metadata: metadata || {}
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: resolvedUserIds.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
