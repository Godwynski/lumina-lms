import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { safeCompare } from "@/lib/server-utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Allow either authenticated user or internal/cron call
    // Use constant-time comparison to prevent timing attacks
    const authHeader = request.headers.get("authorization") || "";
    const cronSecret = process.env.INTERNAL_CRON_SECRET;
    const hasInternalAuth = Boolean(
      cronSecret &&
        authHeader.startsWith("Bearer ") &&
        safeCompare(authHeader.substring(7), cronSecret)
    );

    if (!user?.id && !hasInternalAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasInternalAuth && user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["admin", "librarian"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Use the centralized cleanup logic
    const { cleanupAndReassignReservations } = await import('@/lib/actions/reservations');
    await cleanupAndReassignReservations();

    return NextResponse.json({
      success: true,
      message: "Successfully cleaned up expired reservations and reassigned holds.",
    });
  } catch (error) {
    console.error("Reservation expiry cleanup error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", success: false },
      { status: 500 }
    );
  }
}
