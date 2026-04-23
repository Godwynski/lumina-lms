'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
    return JSON.parse(data.value) as string[];
  } catch {
    return ["Information Technology", "Computer Science", "Business Administration", "Engineering"];
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

  const { error } = await supabase
    .from('profiles')
    .update({
      address: formData.address,
      phone: formData.phone,
      department: formData.department,
      onboarding_completed: true,
      status: 'PENDING', // Ensure they are pending for verification
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return { success: true };
}
