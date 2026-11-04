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

  // Only the user's own folder in this project's avatars bucket (what AvatarManager uploads to);
  // the URL is later downloaded server-side for the library card.
  const ownAvatarPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (!url.startsWith(ownAvatarPrefix) || url.includes("..")) {
    throw new Error("Invalid avatar URL.");
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

  // Sync library card assets
  try {
    const { ensureStaticLibraryCardAssets } = await import("@/lib/library-card-assets.server");
    await ensureStaticLibraryCardAssets({
      userId: user.id,
      fallbackEmail: user.email,
      fallbackAvatarUrl: url,
    });
  } catch (err) {
    console.error("Failed to sync static library card assets:", err);
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
