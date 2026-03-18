import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface ReservationRequest {
  bookId: string;
  userId: string;
}

async function getSystemSetting(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ReservationRequest = await request.json();
    const { bookId, userId } = body;

    if (!bookId || !userId) {
      return NextResponse.json(
        { ok: false, message: "bookId and userId are required" },
        { status: 400 }
      );
    }

    // Get hold_expiry_days policy
    const holdExpiryDays = parseInt(
      (await getSystemSetting(supabase, "hold_expiry_days")) || "7"
    );

    // Check if book exists
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, available_copies")
      .eq("id", bookId)
      .single();

    if (bookError) {
      return NextResponse.json(
        { ok: false, message: "Book not found" },
        { status: 404 }
      );
    }

    // Check if user already has a reservation for this book
    const { data: existing } = await supabase
      .from("reservations")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .eq("status", "ACTIVE")
      .single();

    if (existing) {
      return NextResponse.json(
        { ok: false, message: "User already has an active reservation for this book" },
        { status: 400 }
      );
    }

    // Get queue position (count existing reservations + 1)
    const { count: queueCount } = await supabase
      .from("reservations")
      .select("*", { count: "exact" })
      .eq("book_id", bookId)
      .eq("status", "ACTIVE");

    const queuePosition = (queueCount || 0) + 1;

    // Calculate hold expiry date
    const holdExpiresAt = new Date();
    holdExpiresAt.setDate(holdExpiresAt.getDate() + holdExpiryDays);

    // Create reservation
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert([
        {
          user_id: userId,
          book_id: bookId,
          status: "ACTIVE",
          reserved_at: new Date().toISOString(),
          hold_expires_at: holdExpiresAt.toISOString(),
          queue_position: queuePosition,
        },
      ])
      .select()
      .single();

    if (reservationError) throw reservationError;

    // Log audit entry
    await supabase.from("audit_logs").insert([
      {
        admin_id: user.user.id,
        entity_type: "reservation",
        entity_id: reservation.id,
        action: "create",
        new_value: JSON.stringify({
          user_id: userId,
          book_id: bookId,
          queue_position: queuePosition,
        }),
        reason: "User made a book reservation",
      },
    ]);

    return NextResponse.json({
      ok: true,
      reservation_id: reservation.id,
      queue_position: queuePosition,
      hold_expires_at: holdExpiresAt.toISOString(),
      hold_expiry_days: holdExpiryDays,
    });
  } catch (error) {
    console.error("Reservation error:", error);
    return NextResponse.json(
      { error: "Reservation failed", ok: false },
      { status: 500 }
    );
  }
}

// GET: Get reservations for a book or user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get("bookId");
    const userId = searchParams.get("userId");

    let query = supabase.from("reservations").select("*").eq("status", "ACTIVE");

    if (bookId) {
      query = query.eq("book_id", bookId);
    }
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.order("queue_position");

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Get reservations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}
