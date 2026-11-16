import { z } from "zod";
import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";

const MAX_PREFERENCES_BODY_BYTES = 16 * 1024; // 16 KB
const MAX_STORED_PREFERENCES_BYTES = 32 * 1024; // 32 KB
const MAX_READ_PROGRESS_ENTRIES = 200;
const FORBIDDEN_RECORD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const UiPreferencesPatchSchema = z
  .object({
    theme: z.enum(["light", "dark", "system", "sepia"]).optional(),
    sidebarCollapsed: z.boolean().optional(),
    readProgress: z
      .record(
        z
          .string()
          .min(1)
          .max(128)
          .refine((k) => !FORBIDDEN_RECORD_KEYS.has(k), "Invalid readProgress key"),
        z.number().finite().min(0).max(100)
      )
      .refine(
        (obj) => Object.keys(obj).length <= MAX_READ_PROGRESS_ENTRIES,
        `readProgress cannot exceed ${MAX_READ_PROGRESS_ENTRIES} entries`
      )
      .optional(),
  })
  .strict();

type UiPreferencesRow = {
  preferences: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}



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
  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return apiError("Invalid JSON body", "BAD_REQUEST", 400);
  }

  if (rawText.length > MAX_PREFERENCES_BODY_BYTES) {
    return apiError("Preferences payload too large", "PAYLOAD_TOO_LARGE", 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return apiError("Invalid JSON body", "BAD_REQUEST", 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return apiError("Invalid payload", "INVALID_PAYLOAD", 400);
  }

  const parsed = UiPreferencesPatchSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message || "Invalid preferences payload",
      "VALIDATION_ERROR",
      400
    );
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
  const incomingPreferences = parsed.data;

  const nextPreferences: Record<string, unknown> = {
    ...currentPreferences,
    ...incomingPreferences,
  };

  if (incomingPreferences.readProgress !== undefined) {
    const mergedReadProgress = {
      ...asRecord(currentPreferences.readProgress),
      ...incomingPreferences.readProgress,
    };
    if (Object.keys(mergedReadProgress).length > MAX_READ_PROGRESS_ENTRIES) {
      return apiError(
        `readProgress cannot exceed ${MAX_READ_PROGRESS_ENTRIES} entries`,
        "VALIDATION_ERROR",
        400
      );
    }
    nextPreferences.readProgress = mergedReadProgress;
  }

  if (JSON.stringify(nextPreferences).length > MAX_STORED_PREFERENCES_BYTES) {
    return apiError("Stored preferences size limit exceeded", "PAYLOAD_TOO_LARGE", 400);
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
