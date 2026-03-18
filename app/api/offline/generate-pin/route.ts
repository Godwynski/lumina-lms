import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST() {
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
    // Generate 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const pinHash = await bcrypt.hash(pin, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // Invalidate any currently active PINs (set expires_at to now)
    await supabase
      .from("offline_pins")
      .update({ expires_at: new Date().toISOString() })
      .gt("expires_at", new Date().toISOString());

    // Also revoke all active offline sessions tied to stale PINs
    await supabase
      .from("offline_sessions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: dbError } = await supabase
      .from("offline_pins")
      .insert({
        pin_hash: pinHash,
        expires_at: expiresAt.toISOString(),
        user_id: user.id // Standardizing to user_id as per schema
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, pin, expiresAt: expiresAt.toISOString() });
  } catch (error: unknown) {
    console.error("PIN generation error:", error);
    return NextResponse.json({ error: "Failed to generate PIN" }, { status: 500 });
  }
}
