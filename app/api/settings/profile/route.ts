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

    const body = (await request.json()) as { 
      displayName?: string; 
      address?: string; 
      phone?: string;
      department?: string;
    };
    
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const department = typeof body.department === "string" ? body.department.trim() : "";

    if (!displayName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    // Check current profile to see if we need to reset status
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role, status, full_name, address, phone, department")
      .eq("id", user.id)
      .single();

    let nextStatus = currentProfile?.status;

    // Change Request Logic:
    // If the user is a student and is changing critical info, reset to PENDING
    if (currentProfile?.role === 'student' && currentProfile?.status === 'ACTIVE') {
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
