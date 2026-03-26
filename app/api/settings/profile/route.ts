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

    const body = (await request.json()) as { displayName?: string; address?: string; phone?: string };
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!displayName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    if (displayName.length > 120) {
      return NextResponse.json({ error: "Display name is too long" }, { status: 400 });
    }

    if (address.length > 500) {
      return NextResponse.json({ error: "Address is too long" }, { status: 400 });
    }

    if (phone.length > 50) {
      return NextResponse.json({ error: "Phone number is too long" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ 
        full_name: displayName, 
        address, 
        phone, 
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
