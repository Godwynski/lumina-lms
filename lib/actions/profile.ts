'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAuditActivity } from "@/lib/audit";

/**
 * Updates the current user's profile avatar URL.
 */
export async function updateAvatarUrl(url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      avatar_url: url,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) {
    console.error("Error updating avatar URL:", error);
    throw new Error("Failed to update profile picture.");
  }

  // Log the activity
  await logAuditActivity(
    user.id,
    "profile",
    user.id,
    "avatar_updated",
    "Updated profile picture.",
    { avatar_url: url }
  );

  revalidatePath('/profile');
  return { success: true };
}
