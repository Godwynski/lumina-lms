import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { logAuditActivity } from "@/lib/audit";

type ReturnRequest = {
  bookQr: string;
  idempotencyKey?: string;
  previewOnly?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian", "staff"].includes(profile.role)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  let body: ReturnRequest;
  try {
    body = (await request.json()) as ReturnRequest;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 });
  }

  const bookQr = body.bookQr?.trim();

  if (!bookQr) {
    return NextResponse.json({ ok: false, message: "Book QR value is required." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("process_qr_return", {
    p_librarian_id: profile.id,
    p_book_qr: bookQr,
    p_idempotency_key: body.idempotencyKey ?? null,
    p_preview_only: !!body.previewOnly,
  });

  if (error) {
    logger.error("circulation", "Return RPC error", { error: error.message, bookQr });
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "55P03" || pgCode === "P2034") {
      return NextResponse.json(
        {
          ok: false,
          code: "COPY_LOCKED",
          message: "This book copy is being processed by another session. Please try again.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, code: "RETURN_FAILED", message: error.message || "Return failed." },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as { 
    ok?: boolean; 
    code?: string; 
    message?: string;
    book_title?: string;
    student_name?: string;
    reservation_ready?: boolean;
    reserved_for?: string;
  };

  if (!result.ok) {
    logger.warn("circulation", `Return failed: ${result.message}`, { bookQr, code: result.code });
    const conflictCodes = new Set(["COPY_LOCKED"]);
    const status = conflictCodes.has(result.code ?? "") ? 409 : 400;
    return NextResponse.json(result, { status });
  }

  logger.info("circulation", "Return successful", { bookQr, librarianId: profile.id });
  
  if (!body.previewOnly) {
    await logAuditActivity(
      profile.id,
      "book_copy",
      null, 
      "return",
      `Returned book '${result.book_title}' from ${result.student_name} (QR: ${bookQr})${result.reservation_ready ? ` — reserved for ${result.reserved_for}` : ''}`
    );
  }
  
  // Reservation intercept is now handled atomically inside process_qr_return RPC.
  // The result already contains reservation_ready + reserved_for for the UI to display.
  return NextResponse.json(result, { status: 200 });
}
