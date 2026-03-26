import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type CheckoutRequest = {
  studentCardQr: string;
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

  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 });
  }

  const studentCardQr = body.studentCardQr?.trim();
  const bookQr = body.bookQr?.trim();

  if (!studentCardQr || !bookQr) {
    return NextResponse.json(
      { ok: false, message: "Both student card and book QR values are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("process_qr_checkout", {
    p_librarian_id: profile.id,
    p_card_qr: studentCardQr,
    p_book_qr: bookQr,
    p_idempotency_key: body.idempotencyKey ?? null,
    p_preview_only: !!body.previewOnly,
  });

  if (error) {
    logger.error("circulation", "Checkout RPC error", { error: error.message, studentCardQr, bookQr });
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "55P03" || pgCode === "P2034") {
      return NextResponse.json(
        {
          ok: false,
          code: "COPY_LOCKED",
          message: "This book copy was just checked out by another session. Please try a different copy.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, code: "CHECKOUT_FAILED", message: error.message || "Checkout failed." },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as { ok?: boolean; code?: string; message?: string };
  if (!result.ok) {
    logger.warn("circulation", `Checkout failed: ${result.message}`, { studentCardQr, bookQr, code: result.code });
    const conflictCodes = new Set(["COPY_LOCKED", "COPY_UNAVAILABLE"]);
    const status = conflictCodes.has(result.code ?? "") ? 409 : 400;
    return NextResponse.json(result, { status });
  }

  logger.info("circulation", "Checkout successful", { studentCardQr, bookQr, librarianId: profile.id });
  return NextResponse.json(result, { status: 200 });
}
