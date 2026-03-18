import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RenewalRequest {
  borrowingRecordId: string;
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!["admin", "librarian", "staff"].includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: RenewalRequest = await request.json();
    const { borrowingRecordId } = body;

    if (!borrowingRecordId) {
      return NextResponse.json(
        { ok: false, message: "borrowingRecordId is required" },
        { status: 400 }
      );
    }

    if (!UUID_RE.test(borrowingRecordId)) {
      return NextResponse.json(
        { ok: false, message: "borrowingRecordId must be a valid UUID" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("renew_borrowing_atomic", {
      p_actor_id: user.id,
      p_borrowing_record_id: borrowingRecordId,
    });

    if (error) throw error;

    const result = (data ?? {}) as {
      ok?: boolean;
      code?: string;
      message?: string;
      renewal_id?: string;
      new_due_date?: string;
      renewal_count?: number;
    };

    if (!result.ok) {
      const statusByCode: Record<string, number> = {
        INVALID_INPUT: 400,
        FORBIDDEN: 403,
        BORROW_NOT_FOUND: 404,
        BORROW_NOT_ACTIVE: 400,
        MAX_RENEWAL_EXCEEDED: 409,
      };

      return NextResponse.json(
        { ok: false, message: result.message || "Renewal failed", code: result.code },
        { status: statusByCode[result.code ?? ""] ?? 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Renewal error:", error);
    return NextResponse.json(
      { error: "Renewal failed", ok: false },
      { status: 500 }
    );
  }
}
