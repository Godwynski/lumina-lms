import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";
import { checkStaticLibraryCardAssets } from "@/lib/library-card-assets.server";
import {
  getDeterministicProfileUrl,
  isDeterministicProfileUrl,
  resolveStudentId,
} from "@/lib/library-card-assets";



export const GET = withAuthApi(async (request, { user, profile }) => {
  const studentId = resolveStudentId({
    studentId: profile.student_id as string,
    email: profile.email as string,
    fallbackEmail: user.email,
    userId: user.id,
  });

  if (!studentId) {
    return apiError("Unable to resolve student ID", "STUDENT_ID_MISSING", 400);
  }

  const status = await checkStaticLibraryCardAssets({ studentId });
  const profileUrl = (profile.avatar_url as string) || getDeterministicProfileUrl(studentId);

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

