'use server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeFilterInput } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { ViolationSchema, ResolutionSchema } from '../validations/violations'
import { isAbortError } from '../error-utils'
import { SupabaseClient } from '@supabase/supabase-js'

export type ViolationWithProfile = {
  id: string
  user_id: string
  violation_type: string
  description: string
  incident_date: string
  status: string
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  case_number: string | null
  action_taken: string | null
  evidence_url: string | null
  profiles: {
    full_name: string
    email: string
    student_id: string | null
  } | null
}

export type ViolationStats = {
  total: number
  active: number
  referred: number
  resolved: number
}

async function getAccessInfo() {
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

  if (error || !profile) {
    throw new Error('Forbidden')
  }

  return { supabase, userId: user.id, role: profile.role }
}

async function assertStaffAccess() {
  const { supabase, userId, role } = await getAccessInfo()

  if (!['admin', 'librarian', 'staff'].includes(String(role))) {
    throw new Error('Forbidden')
  }

  return { supabase, userId, role }
}

export async function getViolations(options?: {
  status?: string
  violationType?: string
  preFetchedAuth?: { supabase: SupabaseClient; userId: string; role: string }
}): Promise<{ violations: ViolationWithProfile[]; stats: ViolationStats; role: string }> {
  const { supabase, userId, role } = options?.preFetchedAuth || await getAccessInfo()
  const isStudent = role === 'student'

  let query = supabase
    .from('violations')
    .select(`
      id, user_id, violation_type, description, incident_date, status, resolved_at, resolution_notes, created_at,
      case_number, action_taken, evidence_url,
      profiles:user_id(full_name, email, student_id)
    `)
    .order('created_at', { ascending: false })

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status.toUpperCase())
  }

  if (options?.violationType && options.violationType !== 'all') {
    query = query.eq('violation_type', options.violationType)
  }

  if (isStudent) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
  if (error) {
    if (isAbortError(error)) {
      return { violations: [], stats: { total: 0, active: 0, referred: 0, resolved: 0 }, role: String(role) }
    }
    console.error("[VIOLATIONS] Failed to fetch violations:", error);
    throw error;
  }

  const stats: ViolationStats = { total: 0, active: 0, referred: 0, resolved: 0 };
  (data as { status: string }[] | null)?.forEach((v: { status: string }) => {
    stats.total++
    if (v.status === 'ACTIVE') stats.active++
    else if (v.status === 'REFERRED') stats.referred++
    else if (v.status === 'RESOLVED') stats.resolved++
  })

  return { violations: (data as unknown) as ViolationWithProfile[], stats, role: String(role) }
}

export async function searchStudents(query: string) {
  const { supabase } = await assertStaffAccess()

  if (query.length < 2) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .or(`full_name.ilike.%${sanitizeFilterInput(query)}%,email.ilike.%${sanitizeFilterInput(query)}%`)
    .eq('role', 'student')
    .limit(20)

  if (error) throw new Error(error.message)
  return data || []
}

export async function createViolation(rawInput: unknown) {
  const { supabase, userId } = await assertStaffAccess()

  const validated = ViolationSchema.parse(rawInput)

  // Generate Case Number: REF-YYYY-0001
  const currentYear = new Date().getFullYear()
  const { count } = await supabase
    .from('violations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${currentYear}-01-01`)
  
  const caseNumber = `REF-${currentYear}-${String((count || 0) + 1).padStart(4, '0')}`

  const { error } = await supabase.from('violations').insert({
    user_id: validated.userId,
    violation_type: validated.violationType,
    description: validated.description,
    incident_date: validated.incidentDate,
    status: 'ACTIVE',
    created_by: userId,
    case_number: caseNumber,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/violations')
  return { success: true, caseNumber }
}

export async function deleteViolation(violationId: string) {
  await assertStaffAccess()

  const supabase = await createClient()
  const { error } = await supabase
    .from('violations')
    .delete()
    .eq('id', violationId)

  if (error) throw new Error(error.message)

  revalidatePath('/violations')
  return { success: true }
}

export async function resolveViolation(violationId: string, notes?: string) {
  await assertStaffAccess()

  const validated = ResolutionSchema.parse({ violationId, notes })

  const supabase = await createClient()
  const { error } = await supabase
    .from('violations')
    .update({
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
      resolution_notes: validated.notes || null
    })
    .eq('id', validated.violationId)

  if (error) throw new Error(error.message)

  revalidatePath('/violations')
  return { success: true }
}
export async function referToGuidance(violationId: string) {
  await assertStaffAccess()

  const supabase = await createClient()
  const { error } = await supabase
    .from('violations')
    .update({
      status: 'REFERRED',
    })
    .eq('id', violationId)

  if (error) throw new Error(error.message)

  revalidatePath('/violations')
  return { success: true }
}
