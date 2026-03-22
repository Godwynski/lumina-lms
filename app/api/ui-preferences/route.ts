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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ui_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle<UiPreferencesRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data?.preferences ?? {} });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("ui_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle<UiPreferencesRow>();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: nextPreferences });
}
