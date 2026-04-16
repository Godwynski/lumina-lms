import { withAuthApi, apiSuccess } from "@/lib/api-utils";
import { ensureStaticLibraryCardAssets } from "@/lib/library-card-assets.server";

export const POST = withAuthApi(async (request, { user }) => {
  const assets = await ensureStaticLibraryCardAssets({
    userId: user.id,
    fallbackEmail: user.email,
    fallbackAvatarUrl:
      (user.user_metadata?.avatar_url as string | undefined) || null,
    forceQrRegeneration: true,
  });

  return apiSuccess({
    student_id: assets.studentId,
    qr_url: assets.qrUrl,
    profile_url: assets.profileUrl,
  });
});

