import { createClient } from '@/lib/supabase/server'
import { sanitizeFilterInput } from '@/lib/utils'
import { withAuthApi, apiSuccess, apiError } from '@/lib/api-utils'
import { z } from 'zod'

const ViolationCreateSchema = z.object({
  action: z.literal('create'),
  userId: z.string().uuid(),
  violationType: z.enum(['Unreturned Book', 'Damaged Book']),
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

export const GET = withAuthApi(async (request, { user, role }) => {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')
  const violationType = searchParams.get('violationType')
  const search = searchParams.get('search')

  const supabase = await createClient()
  const isStaff = ['admin', 'librarian', 'staff'].includes(role)

  if (!isStaff) {
    // Students can only see their own active violations
    const { data, error } = await supabase
      .from('violations')
      .select('id, user_id, violation_type, description, incident_date, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (error) {
      return apiError(error.message, 'DATABASE_ERROR', 500)
    }
    return apiSuccess({ violations: data })
  }

  // Staff search logic
  if (search) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, role')
      .or(`full_name.ilike.%${sanitizeFilterInput(search)}%,student_id.ilike.%${sanitizeFilterInput(search)}%`)
      .eq('role', 'student')
      .limit(20)

    if (error) {
      return apiError(error.message, 'DATABASE_ERROR', 500)
    }
    return apiSuccess({ students: data })
  }

  let query = supabase
    .from('violations')
    .select(`
      id, user_id, violation_type, description, incident_date, status, created_at,
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
    return apiError(error.message, 'DATABASE_ERROR', 500)
  }

  return apiSuccess({ violations: data })
})

export const POST = withAuthApi(async (request, { user }) => {
  const supabase = await createClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON', 'INVALID_JSON', 400)
  }

  const result = ViolationActionSchema.safeParse(body)
  if (!result.success) {
    return apiError('Invalid request data', 'VALIDATION_ERROR', 400, result.error.format())
  }

  const validated = result.data

  if (validated.action === 'create') {
    const { data, error } = await supabase
      .from('violations')
      .insert({
        user_id: validated.userId,
        violation_type: validated.violationType,
        description: validated.description,
        incident_date: validated.incidentDate,
        status: 'active',
        created_by: user.id,
      })
      .select('id, user_id, violation_type, description, status')
      .single()

    if (error) {
      return apiError(error.message, 'DATABASE_ERROR', 500)
    }
    return apiSuccess({ violation: data })
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
      return apiError(error.message, 'DATABASE_ERROR', 500)
    }
    return apiSuccess({ violation: data })
  }

  if (validated.action === 'delete') {
    const { error } = await supabase
      .from('violations')
      .delete()
      .eq('id', validated.violationId)

    if (error) {
      return apiError(error.message, 'DATABASE_ERROR', 500)
    }
    return apiSuccess({ success: true })
  }

  return apiError('Invalid action', 'INVALID_ACTION', 400)
}, { requireStaff: true })

