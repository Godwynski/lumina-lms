import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditActivity } from "@/lib/audit";
import { ReservationCreateSchema } from "@/lib/validations/api";
import { isStaff, type Role } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parseResult = ReservationCreateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parseResult.error.issues[0]?.message || "Invalid reservation data",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { bookId, userId } = parseResult.data;

    if (userId && userId !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      const isStaffUser = Boolean(profile && isStaff(profile.role as Role, profile));
      if (!isStaffUser) {
        return NextResponse.json(
          { ok: false, message: "Only staff members can reserve books on behalf of other users", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
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

    // Log successful reservation
    await logAuditActivity(
      user.id,
      "borrowing_record",
      result.reservation_id || null,
      "reserve",
      `Placed reservation for book (ID: ${bookId})${userId ? ` for user ${userId}` : ""}`,
      { 
        status: result.status, 
        queuePosition: result.queue_position,
        targetUserId: userId || user.id
      },
      null,
      { status: result.status, queue_position: result.queue_position }
    );

    const { revalidateTag, revalidatePath } = await import('next/cache');
    revalidateTag('public-books', 'max');
    revalidateTag(`book-${bookId}`, 'max');
    revalidatePath('/student-catalog', 'page');
    revalidatePath('/dashboard', 'page');

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
      .select("role, status")
      .eq("id", user.id)
      .single();

    const isStaffUser = Boolean(profile && isStaff(profile.role as Role, profile));

    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get("bookId");
    const userId = searchParams.get("userId");

    let query = supabase.from("reservations").select("*").eq("status", "ACTIVE");

    if (bookId) {
      query = query.eq("book_id", bookId);
    }
    if (userId) {
      if (!isStaffUser && userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("user_id", userId);
    } else if (!isStaffUser) {
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
