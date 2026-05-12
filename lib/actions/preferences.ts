"use server";

import { createSafeAction } from "./action-utils";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const UpdateUiPreferenceSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export const updateUiPreference = createSafeAction(
  UpdateUiPreferenceSchema,
  async (data, { supabase, userId }) => {
    // Get existing preferences
    const { data: existing } = await supabase
      .from("ui_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();

    const currentPreferences = (existing?.preferences as Record<string, unknown>) || {};
    const nextPreferences = {
      ...currentPreferences,
      [data.key]: data.value,
    };

    const { error } = await supabase
      .from("ui_preferences")
      .upsert(
        {
          user_id: userId,
          preferences: nextPreferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    
    return { success: true, preferences: nextPreferences };
  }
);
