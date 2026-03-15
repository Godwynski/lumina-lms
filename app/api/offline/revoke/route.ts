import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await supabase
      .from("offline_pins")
      .update({ is_revoked: true })
      .eq("is_revoked", false);

    const response = NextResponse.json({ success: true });
    response.cookies.delete("offline_session");
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
