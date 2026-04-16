import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { logAuditActivity } from "@/lib/audit";

type ReturnRequest = {
  bookQr: string;
  idempotencyKey?: string;
  previewOnly?: boolean;
};

export const POST = withAuthApi(async (request, { supabase, profile }) => {
  let body: ReturnRequest;
  try {
    body = (await request.json()) as ReturnRequest;
  } catch {
    return apiError("Invalid JSON payload", "INVALID_JSON", 400);
  }

  const bookQr = body.bookQr?.trim();

  if (!bookQr) {
    return apiError("Book QR value is required.", "QR_REQUIRED", 400);
  }

  const { data, error } = await supabase.rpc("process_qr_return", {
    p_librarian_id: String(profile.id),
    p_book_qr: bookQr,
    p_idempotency_key: body.idempotencyKey ?? null,
    p_preview_only: !!body.previewOnly,
  });

  if (error) {
    logger.error("circulation", "Return RPC error", {
      error: error.message,
      bookQr,
    });
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "55P03" || pgCode === "P2034") {
      return apiError(
        "This book copy is being processed by another session. Please try again.",
        "COPY_LOCKED",
        409
      );
    }

    return apiError(error.message || "Return failed.", "RETURN_FAILED", 500);
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
    logger.warn("circulation", `Return failed: ${result.message}`, {
      bookQr,
      code: result.code,
    });
    const conflictCodes = new Set(["COPY_LOCKED"]);
    const status = conflictCodes.has(result.code ?? "") ? 409 : 400;
    return apiError(result.message || "Return failed.", result.code, status);
  }

  logger.info("circulation", "Return successful", {
    bookQr,
    librarianId: String(profile.id),
  });

  if (!body.previewOnly) {
    await logAuditActivity(
      String(profile.id),
      "book_copy",
      null,
      "return",
      `Returned book '${result.book_title}' from ${
        result.student_name
      } (QR: ${bookQr})${
        result.reservation_ready
          ? ` — reserved for ${result.reserved_for}`
          : ""
      }`
    );
  }

  return apiSuccess(result);
}, { requireStaff: true });

