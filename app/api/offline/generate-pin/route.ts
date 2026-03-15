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

    // Invalidate existing pins first
    await supabase
      .from("offline_pins")
      .update({ is_revoked: true })
      .filter("is_revoked", "eq", false);

    const { data: newPin, error: dbError } = await supabase
      .from("offline_pins")
      .insert({
        pin_hash: pinHash,
        expires_at: expiresAt.toISOString(),
        created_by: user.id
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, pin, expiresAt: expiresAt.toISOString() });
  } catch (error: any) {
    console.error("PIN generation error:", error);
    return NextResponse.json({ error: "Failed to generate PIN" }, { status: 500 });
  }
}
