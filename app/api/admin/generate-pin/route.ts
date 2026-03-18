import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role - only librarians and admins can generate PINs
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { user_id } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ error: "Target user_id is required" }, { status: 400 });
    }

    // Generate random 6-digit numeric PIN
    const plainPin = Math.floor(100000 + Math.random() * 900000).toString();
    const pinHash = await bcrypt.hash(plainPin, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    // Save to OfflinePin
    const { error: dbError } = await supabase
      .from("offline_pins")
      .insert({
        user_id,
        pin_hash: pinHash,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) throw dbError;

    // Return the plain PIN only once
    return NextResponse.json({ 
      success: true, 
      pin: plainPin, 
      expires_at: expiresAt.toISOString() 
    });

  } catch (error: unknown) {
    console.error("PIN generation error:", error);
    return NextResponse.json({ error: "Failed to generate PIN" }, { status: 500 });
  }
}
