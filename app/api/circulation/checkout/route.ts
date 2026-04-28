import { logger } from "@/lib/logger";
import { logAuditActivity } from "@/lib/audit";
import { z } from "zod";
import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";

const CheckoutSchema = z.object({
  studentCardQr: z.string().min(1),
  bookQr: z.string().min(1),
  idempotencyKey: z.string().optional(),
  previewOnly: z.boolean().optional().default(false),
});

export const POST = withAuthApi(async (request, { supabase, profile }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON payload", "INVALID_JSON", 400);
  }

  const result = CheckoutSchema.safeParse(body);
  if (!result.success) {
    return apiError("Invalid request data", "VALIDATION_ERROR", 400, result.error.format());
  }

  const validated = result.data;
  const studentCardQr = validated.studentCardQr.trim();
  const bookQr = validated.bookQr.trim();

  const { data, error } = await supabase.rpc("process_qr_checkout", {
    p_librarian_id: String(profile.id),
    p_card_qr: studentCardQr,
    p_book_qr: bookQr,
    p_idempotency_key: validated.idempotencyKey ?? null,
    p_preview_only: validated.previewOnly,
  });

  if (error) {
    logger.error("circulation", "Checkout RPC error", { error: error.message, studentCardQr, bookQr });
    const pgCode = (error as { code?: string }).code;
    
    // Check for concurrency errors
    if (pgCode === "55P03" || pgCode === "P2034") {
      return apiError(
        "This book copy was just checked out by another session. Please try a different copy.",
        "COPY_LOCKED",
        409
      );
    }

    return apiError(error.message || "Checkout failed.", "CHECKOUT_FAILED", 500);
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
    
    return apiError(rpcResult.message || "Checkout failed.", rpcResult.code, status);
  }

  if (!validated.previewOnly) {
    logger.info("circulation", "Checkout successful", { studentCardQr, bookQr, librarianId: String(profile.id) });
    await logAuditActivity(
      String(profile.id),
      "borrowing_record",
      rpcResult.borrowing_id || null,
      "checkout",
      `Checked out book '${rpcResult.book_title}' to ${rpcResult.student_name} (QR: ${bookQr})`
    );
  }
  
  return apiSuccess(rpcResult);
}, { requireStaff: true });

