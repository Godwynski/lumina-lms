import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role - only librarians and admins can revoke sessions
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Revoke all offline sessions
    const { error: deleteError } = await supabase
      .from("offline_sessions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete everything

    if (deleteError) throw deleteError;

    // Optional: Also invalidate all current pins
    await supabase
      .from("offline_pins")
      .update({ expires_at: new Date().toISOString() })
      .gt("expires_at", new Date().toISOString());

    return NextResponse.json({ 
      success: true, 
      message: "All offline sessions have been revoked and active PINs invalidated." 
    });

  } catch (error: any) {
    console.error("Session revocation error:", error);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
