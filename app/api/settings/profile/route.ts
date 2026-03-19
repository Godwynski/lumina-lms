import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { displayName?: unknown };
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!displayName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    if (displayName.length > 120) {
      return NextResponse.json({ error: "Display name is too long" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, displayName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
