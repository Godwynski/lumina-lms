import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UiPreferencesRow = {
  preferences: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";

export const GET = withAuthApi(async (req, { user, supabase }) => {
  const { data, error } = await supabase
    .from("ui_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle<UiPreferencesRow>();

  if (error) {
    return apiError(error.message, "DATABASE_ERROR", 500);
  }

  return apiSuccess({ preferences: data?.preferences ?? {} });
});

export const PATCH = withAuthApi(async (request, { user, supabase }) => {
  const payload = await request.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return apiError("Invalid payload", "INVALID_PAYLOAD", 400);
  }

  const { data: existing, error: existingError } = await supabase
    .from("ui_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle<UiPreferencesRow>();

  if (existingError) {
    return apiError(existingError.message, "DATABASE_ERROR", 500);
  }

  const currentPreferences = asRecord(existing?.preferences);
  const incomingPreferences = asRecord(payload);

  const nextPreferences: Record<string, unknown> = {
    ...currentPreferences,
    ...incomingPreferences,
  };

  if (incomingPreferences.readProgress !== undefined) {
    nextPreferences.readProgress = {
      ...asRecord(currentPreferences.readProgress),
      ...asRecord(incomingPreferences.readProgress),
    };
  }

  const { error } = await supabase.from("ui_preferences").upsert(
    {
      user_id: user.id,
      preferences: nextPreferences,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return apiError(error.message, "DATABASE_ERROR", 500);
  }

  return apiSuccess({ preferences: nextPreferences });
});
