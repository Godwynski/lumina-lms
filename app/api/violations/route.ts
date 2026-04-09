import { createClient } from '@/lib/supabase/server'
import { sanitizeFilterInput } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const ViolationCreateSchema = z.object({
  action: z.literal('create'),
  userId: z.string().uuid(),
  violationType: z.string().min(1),
  severity: z.enum(['minor', 'moderate', 'severe']).default('minor'),
  points: z.coerce.number().int().min(1).default(1),
  description: z.string().min(1),
  incidentDate: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
})

const ViolationResolveSchema = z.object({
  action: z.literal('resolve'),
  violationId: z.string().uuid(),
  resolutionNotes: z.string().optional(),
})

const ViolationDeleteSchema = z.object({
  action: z.literal('delete'),
  violationId: z.string().uuid(),
})

const ViolationActionSchema = z.discriminatedUnion('action', [
  ViolationCreateSchema,
  ViolationResolveSchema,
  ViolationDeleteSchema,
])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')
  const violationType = searchParams.get('violationType')
  const search = searchParams.get('search')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'librarian', 'staff'].includes(String(profile.role))) {
    if (userId) {
      const { data, error } = await supabase
        .from('violations')
        .select('id, user_id, violation_type, severity, points, description, incident_date, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) {
        return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
      }
      return NextResponse.json({ success: true, violations: data })
    }
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }, { status: 403 })
  }

  if (search) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, role')
      .or(`full_name.ilike.%${sanitizeFilterInput(search)}%,student_id.ilike.%${sanitizeFilterInput(search)}%`)
      .eq('role', 'student')
      .limit(20)

    if (error) {
      return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
    }
    return NextResponse.json({ success: true, students: data })
  }

  let query = supabase
    .from('violations')
    .select(`
      id, user_id, violation_type, severity, points, description, incident_date, status, created_at,
      profiles:user_id(full_name, student_id)
    `)
    .order('created_at', { ascending: false })

  if (userId) {
    query = query.eq('user_id', userId)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (violationType && violationType !== 'all') {
    query = query.eq('violation_type', violationType)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
  }

  return NextResponse.json({ success: true, violations: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'librarian', 'staff'].includes(String(profile.role))) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 })
  }

  const result = ViolationActionSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: result.error.format() } }, { status: 400 })
  }

  const validated = result.data

  if (validated.action === 'create') {
    const { data, error } = await supabase
      .from('violations')
      .insert({
        user_id: validated.userId,
        violation_type: validated.violationType,
        severity: validated.severity,
        points: validated.points,
        description: validated.description,
        incident_date: validated.incidentDate,
        status: 'active',
        created_by: user.id,
      })
      .select('id, user_id, violation_type, severity, points, description, status')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
    }
    return NextResponse.json({ success: true, violation: data })
  }

  if (validated.action === 'resolve') {
    const { data, error } = await supabase
      .from('violations')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: validated.resolutionNotes || null,
      })
      .eq('id', validated.violationId)
      .select('id, status, resolved_at, resolved_by')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
    }
    return NextResponse.json({ success: true, violation: data })
  }

  if (validated.action === 'delete') {
    const { error } = await supabase
      .from('violations')
      .delete()
      .eq('id', validated.violationId)

    if (error) {
      return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: error.message } }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: false, error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 })
}
