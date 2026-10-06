import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ProfilePatchSchema } from "@/lib/validations/api";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = ProfilePatchSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Display name is required" },
        { status: 400 }
      );
    }

    const { displayName, address, phone, department } = parseResult.data;

    // Check current profile to see if we need to reset status
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role, status, full_name, address, phone, department")
      .eq("id", user.id)
      .single();

    let nextStatus = currentProfile?.status;

    // Change Request Logic:
    // If the user is a student and is changing critical info, reset to PENDING
    if (currentProfile?.role === 'student' && currentProfile?.status?.toUpperCase() === 'ACTIVE') {
      const isChanged = 
        displayName !== currentProfile.full_name ||
        address !== currentProfile.address ||
        phone !== currentProfile.phone ||
        department !== currentProfile.department;

      if (isChanged) {
        nextStatus = 'PENDING';
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({ 
        full_name: displayName, 
        address, 
        phone, 
        department,
        status: nextStatus,
        updated_at: new Date().toISOString() 
      })
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
