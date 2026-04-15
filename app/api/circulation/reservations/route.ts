import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ReservationRequest {
  bookId: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ReservationRequest = await request.json();
    const { bookId, userId } = body;

    if (!bookId) {
      return NextResponse.json(
        { ok: false, message: "bookId is required" },
        { status: 400 }
      );
    }

    if (!UUID_RE.test(bookId)) {
      return NextResponse.json(
        { ok: false, message: "bookId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (userId && !UUID_RE.test(userId)) {
      return NextResponse.json(
        { ok: false, message: "userId must be a valid UUID" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("create_reservation_atomic", {
      p_actor_id: user.id,
      p_book_id: bookId,
      p_target_user_id: userId ?? null,
    });

    if (error) throw error;

    const result = (data ?? {}) as {
      ok?: boolean;
      code?: string;
      message?: string;
      reservation_id?: string;
      status?: 'READY' | 'ACTIVE';
      queue_position?: number;
      copy_id?: string;
      hold_expires_at?: string;
      hold_expiry_days?: number;
    };

    if (!result.ok) {
      const statusByCode: Record<string, number> = {
        INVALID_INPUT: 400,
        FORBIDDEN: 403,
        UNAUTHORIZED: 401,
        TARGET_USER_NOT_FOUND: 404,
        BOOK_NOT_FOUND: 404,
        DUPLICATE: 409,
        DUPLICATE_ACTIVE_RESERVATION: 409,
        RESERVATION_LIMIT: 409,
        SUSPENDED: 403,
      };

      return NextResponse.json(
        { ok: false, message: result.message || "Reservation failed", code: result.code },
        { status: statusByCode[result.code ?? ""] ?? 400 }
      );
    }

    return NextResponse.json(result);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isStaff = Boolean(profile && ["admin", "librarian", "staff"].includes(profile.role));

    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get("bookId");
    const userId = searchParams.get("userId");

    let query = supabase.from("reservations").select("*").eq("status", "ACTIVE");

    if (bookId) {
      query = query.eq("book_id", bookId);
    }
    if (userId) {
      if (!isStaff && userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("user_id", userId);
    } else if (!isStaff) {
      query = query.eq("user_id", user.id);
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
