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

    // Get expired reservations (hold_expires_at < now())
    const { data: expiredReservations, error: fetchError } = await supabase
      .from("reservations")
      .select("id, user_id, book_id, queue_position")
      .eq("status", "ACTIVE")
      .lt("hold_expires_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredReservations || expiredReservations.length === 0) {
      return NextResponse.json({
        success: true,
        expiredCount: 0,
        message: "No expired reservations found",
      });
    }

    const expiredIds = expiredReservations.map((r) => r.id);

    // Mark expired reservations as EXPIRED
    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: "EXPIRED" })
      .in("id", expiredIds);

    if (updateError) throw updateError;

    // For each expired reservation, update queue positions of remaining reservations
    const bookIds = [...new Set(expiredReservations.map((r) => r.book_id))];

    for (const bookId of bookIds) {
      const { data: activeReservations } = await supabase
        .from("reservations")
        .select("id")
        .eq("book_id", bookId)
        .eq("status", "ACTIVE")
        .order("queue_position");

      // Update queue positions
      if (activeReservations) {
        for (let i = 0; i < activeReservations.length; i++) {
          await supabase
            .from("reservations")
            .update({ queue_position: i + 1 })
            .eq("id", activeReservations[i].id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      expiredCount: expiredIds.length,
      message: `Marked ${expiredIds.length} expired reservations as EXPIRED and updated queue positions`,
    });
  } catch (error) {
    console.error("Reservation expiry cleanup error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", success: false },
      { status: 500 }
    );
  }
}
