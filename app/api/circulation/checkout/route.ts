import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { logAuditActivity } from "@/lib/audit";
import { z } from "zod";

const CheckoutSchema = z.object({
  studentCardQr: z.string().min(1),
  bookQr: z.string().min(1),
  idempotencyKey: z.string().optional(),
  previewOnly: z.boolean().optional().default(false),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 });
  }

  const result = CheckoutSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, message: "Invalid request data" }, { status: 400 });
  }

  const validated = result.data;
  const studentCardQr = validated.studentCardQr.trim();
  const bookQr = validated.bookQr.trim();

  const { data, error } = await supabase.rpc("process_qr_checkout", {
    p_librarian_id: profile.id,
    p_card_qr: studentCardQr,
    p_book_qr: bookQr,
    p_idempotency_key: validated.idempotencyKey ?? null,
    p_preview_only: validated.previewOnly,
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

  const rpcResult = (data ?? {}) as { 
    ok?: boolean; 
    code?: string; 
    message?: string;
    borrowing_id?: string;
    book_title?: string;
    student_name?: string;
  };

  if (!rpcResult.ok) {
    logger.warn("circulation", `Checkout failed: ${rpcResult.message}`, { studentCardQr, bookQr, code: rpcResult.code });
    const conflictCodes = new Set(["COPY_LOCKED", "COPY_UNAVAILABLE"]);
    const status = conflictCodes.has(rpcResult.code ?? "") ? 409 : 400;
    return NextResponse.json({ 
      ok: false, 
      code: rpcResult.code, 
      message: rpcResult.message || "Checkout failed." 
    }, { status });
  }

  logger.info("circulation", "Checkout successful", { studentCardQr, bookQr, librarianId: profile.id });
  
  if (!validated.previewOnly) {
    await logAuditActivity(
      profile.id,
      "borrowing_record",
      rpcResult.borrowing_id || null,
      "checkout",
      `Checked out book '${rpcResult.book_title}' to ${rpcResult.student_name} (QR: ${bookQr})`
    );
  }
  
  return NextResponse.json({ ok: true, ...rpcResult }, { status: 200 });
}
