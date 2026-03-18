import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only librarians and admins can revoke sessions
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Expire all active PINs
    await supabase
      .from("offline_pins")
      .update({ expires_at: new Date().toISOString() })
      .gt("expires_at", new Date().toISOString());

    // 2. Revoke all active offline sessions (mark revoked_at so middleware rejects them)
    //    We delete them outright for instant invalidation — the middleware check will fail.
    await supabase
      .from("offline_sessions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all sessions

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke error:", error);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
