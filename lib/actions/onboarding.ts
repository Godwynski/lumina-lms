'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAuditActivity } from "@/lib/audit";
import { parseStudentIdFromEmail, resolveStudentId, generateFacultyId } from "@/lib/library-card-assets";

export async function getAcademicPrograms() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'academic_programs')
    .single();

  if (error || !data) {
    return ["Information Technology", "Computer Science", "Business Administration", "Engineering"];
  }

  try {
    // Try JSON first
    if (data.value.startsWith('[') && data.value.endsWith(']')) {
      return JSON.parse(data.value) as string[];
    }
    // Fallback to comma-separated
    return data.value.split(',').map((s: string) => s.trim()).filter(Boolean);
  } catch {
    return data.value.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
}

export async function submitOnboarding(formData: {
  address: string;
  phone: string;
  department: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Fetch current profile to check existing student_id and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('student_id, role, email')
    .eq('id', user.id)
    .single();

  // Derive student_id from email if not already set
  let studentId = profile?.student_id ?? null;
  if (!studentId) {
    // Try to parse from their STI email (e.g. lastname.376536@alabang.sti.edu.ph)
    studentId = parseStudentIdFromEmail(profile?.email ?? user.email ?? null);
  } else {
    // Normalize existing value to ensure correct prefix
    studentId = resolveStudentId({
      studentId,
      email: profile?.email ?? user.email,
      role: profile?.role,
    });
  }

  // Ensure uniqueness for generated faculty IDs if we're assigning a new one
  if (studentId && studentId.startsWith("FAC-") && !profile?.student_id) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (!existing) {
        isUnique = true;
      } else {
        studentId = generateFacultyId();
        attempts++;
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    address: formData.address,
    phone: formData.phone,
    department: formData.department,
    onboarding_completed: true,
    status: 'PENDING',
    updated_at: new Date().toISOString(),
  };

  // Only set student_id if we resolved one and it's not already set
  if (studentId && !profile?.student_id) {
    updatePayload.student_id = studentId;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);

  if (error) throw new Error(error.message);

  await logAuditActivity(
    user.id,
    "profile",
    user.id,
    "onboarding_completed",
    "Completed onboarding and profile setup.",
    { ...formData, student_id_assigned: studentId }
  );

  revalidatePath('/');
  return { success: true };
}
