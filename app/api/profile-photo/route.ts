import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";
import { ensureStaticLibraryCardAssets } from "@/lib/library-card-assets.server";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export const POST = withAuthApi(async (req, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return apiError("No file uploaded", "FILE_MISSING", 400);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return apiError(
      "Invalid file type. Only JPEG, PNG, and WebP are allowed.",
      "INVALID_FILE_TYPE",
      400
    );
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return apiError(
      "File too large. Maximum upload size is 5MB.",
      "FILE_TOO_LARGE",
      400
    );
  }

  const bytes = await file.arrayBuffer();
  const uploadedProfileBuffer = Buffer.from(bytes);

  const assets = await ensureStaticLibraryCardAssets({
    userId: user.id,
    fallbackEmail: user.email,
    uploadedProfileBuffer,
    forceQrRegeneration: false,
  });

  return apiSuccess({
    avatar_url: assets.profileUrl,
    qr_url: assets.qrUrl,
    student_id: assets.studentId,
  });
});

