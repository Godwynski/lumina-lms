import { sendBulkNotifications } from '@/lib/notifications'
import { NextResponse } from 'next/server'
import { BulkNotificationSchema } from '@/lib/validations/api'
import { withAuthApi } from '@/lib/api-utils'

export const POST = withAuthApi(async (request, { supabase }) => {
  try {
    // Parse request body
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

    // A whole audience is one INSERT … SELECT in SQL: reading the ids into the app stopped at 1,000 (M8).
    if (target) {
      const { data: count, error: rpcError } = await supabase.rpc('send_bulk_notifications_by_target', {
        p_target: target,
        p_title: title,
        p_content: content,
        p_type: type || 'SYSTEM',
        p_priority: priority || 'high',
        p_metadata: metadata || {},
      })
      if (rpcError) {
        return NextResponse.json({ error: rpcError.message }, { status: 500 })
      }
      if (!count) {
        return NextResponse.json({ error: 'No recipients found for notification' }, { status: 400 })
      }
      return NextResponse.json({ success: true, count })
    }

    const resolvedUserIds = userIds || []
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
}, { allowedRoles: ['super_admin', 'librarian'] })
