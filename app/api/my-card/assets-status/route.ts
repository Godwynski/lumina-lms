import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";
import { ensureStaticLibraryCardAssets } from "@/lib/library-card-assets.server";
import {
  isDeterministicProfileUrl,
  resolveStudentId,
} from "@/lib/library-card-assets";

export const GET = withAuthApi(async (request, { user, profile }) => {
  const studentId = resolveStudentId({
    studentId: profile.student_id as string,
    email: profile.email as string,
    fallbackEmail: user.email,
    userId: user.id,
    role: profile.role as string,
  });

  if (!studentId) {
    return apiError("Unable to resolve student ID", "STUDENT_ID_MISSING", 400);
  }

  // Ensure assets exist (idempotent — creates only if missing)
  const status = await ensureStaticLibraryCardAssets({
    userId: user.id,
    fallbackEmail: user.email,
    fallbackAvatarUrl: profile.avatar_url as string,
  });

  const profileUrl = status.profileUrl;

  return apiSuccess({
    student_id: studentId,
    qr_url: status.qrUrl,
    profile_url: profileUrl,
    qr_exists: status.qrExists,
    profile_exists: status.profileExists,
    profile_is_deterministic: isDeterministicProfileUrl(profile.avatar_url as string),
    ready: status.qrExists && status.profileExists,
  });
});
