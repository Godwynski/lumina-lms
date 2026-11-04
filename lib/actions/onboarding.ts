'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAuditActivity } from "@/lib/audit";

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

  // student_id is not set here: the sign-up trigger and card provisioning assign it,
  // and the profile guard trigger rejects users setting it themselves.
  const { error } = await supabase
    .from('profiles')
    .update({
      address: formData.address,
      phone: formData.phone,
      department: formData.department,
      onboarding_completed: true,
      status: 'PENDING',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) throw new Error(error.message);

  await logAuditActivity(
    user.id,
    "profile",
    user.id,
    "onboarding_completed",
    "Completed onboarding and profile setup.",
    { ...formData }
  );

  revalidatePath('/');
  return { success: true };
}
