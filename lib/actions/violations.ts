'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ViolationSchema, ResolutionSchema } from '../validations/violations'

export type ViolationWithProfile = {
  id: string
  user_id: string
  violation_type: string
  severity: string
  points: number
  description: string
  incident_date: string
  status: string
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  profiles: {
    full_name: string
    student_id: string
  } | null
}

export type ViolationStats = {
  total: number
  active: number
  resolved: number
  totalPoints: number
}

async function assertStaffAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single()

  if (error || !profile || !['admin', 'librarian', 'staff'].includes(String(profile.role))) {
    throw new Error('Forbidden')
  }

  return { supabase, userId: user.id, role: profile.role }
}

export async function getViolations(options?: {
  status?: string
  violationType?: string
}): Promise<{ violations: ViolationWithProfile[]; stats: ViolationStats }> {
  const { supabase } = await assertStaffAccess()

  let query = supabase
    .from('violations')
    .select(`
      id, user_id, violation_type, severity, points, description, incident_date, status, resolved_at, resolution_notes, created_at,
      profiles:user_id(full_name, student_id)
    `)
    .order('created_at', { ascending: false })

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  if (options?.violationType && options.violationType !== 'all') {
    query = query.eq('violation_type', options.violationType)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const stats: ViolationStats = { total: 0, active: 0, resolved: 0, totalPoints: 0 }
  data?.forEach((v) => {
    stats.total++
    stats.totalPoints += v.points
    if (v.status === 'active') stats.active++
    else if (v.status === 'resolved') stats.resolved++
  })

  return { violations: (data as unknown) as ViolationWithProfile[], stats }
}

export async function searchStudents(query: string) {
  const { supabase } = await assertStaffAccess()

  if (query.length < 2) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, student_id, role')
    .or(`full_name.ilike.%${query}%,student_id.ilike.%${query}%`)
    .eq('role', 'student')
    .limit(20)

  if (error) throw new Error(error.message)
  return data || []
}

export async function createViolation(rawInput: unknown) {
  const { supabase, userId } = await assertStaffAccess()

  const validated = ViolationSchema.parse(rawInput)

  const { error } = await supabase.from('violations').insert({
    user_id: validated.userId,
    violation_type: validated.violationType,
    severity: validated.severity,
    points: validated.points,
    description: validated.description,
    incident_date: validated.incidentDate,
    status: 'active',
    created_by: userId,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/protected/violations')
  return { success: true }
}

export async function deleteViolation(violationId: string) {
  await assertStaffAccess()

  const supabase = await createClient()
  const { error } = await supabase
    .from('violations')
    .delete()
    .eq('id', violationId)

  if (error) throw new Error(error.message)

  revalidatePath('/protected/violations')
  return { success: true }
}

export async function resolveViolation(violationId: string, notes?: string) {
  await assertStaffAccess()

  const validated = ResolutionSchema.parse({ violationId, notes })

  const supabase = await createClient()
  const { error } = await supabase
    .from('violations')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_notes: validated.notes || null
    })
    .eq('id', validated.violationId)

  if (error) throw new Error(error.message)

  revalidatePath('/protected/violations')
  return { success: true }
}
