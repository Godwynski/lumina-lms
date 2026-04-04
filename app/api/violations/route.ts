import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
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
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, violations: data })
    }
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 })
  }

  if (search) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, role')
      .or(`full_name.ilike.%${search}%,student_id.ilike.%${search}%`)
      .eq('role', 'student')
      .limit(20)

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, students: data })
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
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, violations: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'librarian', 'staff'].includes(String(profile.role))) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { action, violationId, userId, violationType, severity, points, description, incidentDate } = body

  if (action === 'create' && userId && violationType && description) {
    const { data, error } = await supabase
      .from('violations')
      .insert({
        user_id: userId,
        violation_type: violationType,
        severity: severity || 'minor',
        points: parseInt(points) || 1,
        description,
        incident_date: incidentDate || new Date().toISOString().split('T')[0],
        status: 'active',
        created_by: user.id,
      })
      .select('id, user_id, violation_type, severity, points, description, status')
      .single()

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, violation: data })
  }

  if (action === 'resolve' && violationId) {
    const { data, error } = await supabase
      .from('violations')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: body.resolutionNotes || null,
      })
      .eq('id', violationId)
      .select('id, status, resolved_at, resolved_by')
      .single()

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, violation: data })
  }

  if (action === 'delete' && violationId) {
    const { error } = await supabase
      .from('violations')
      .delete()
      .eq('id', violationId)

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, message: 'Invalid action' }, { status: 400 })
}
