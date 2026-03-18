import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface HardDeleteRequest {
  userId: string;
  reason?: string;
  confirmationCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: HardDeleteRequest = await request.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Verify the user exists
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .single();

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Execute hard delete via database function
    const { data, error } = await supabase.rpc(
      "hard_delete_user_profile",
      {
        p_user_id: userId,
        p_reason: reason || `Deletion requested by ${profile.id}`,
      }
    );

    if (error) throw error;

    // Log the deletion action in our app
    await supabase.from("audit_logs").insert([
      {
        admin_id: user.user.id,
        entity_type: "profile_deletion",
        entity_id: userId,
        action: "hard_delete",
        reason: `GDPR RTE: ${reason || "User-initiated deletion"}`,
      },
    ]);

    return NextResponse.json({
      success: true,
      message: "User profile anonymized successfully",
      result: data,
    });
  } catch (error) {
    console.error("Hard delete error:", error);
    return NextResponse.json(
      { error: "Hard delete failed", success: false },
      { status: 500 }
    );
  }
}
