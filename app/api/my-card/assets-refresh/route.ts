import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureStaticLibraryCardAssets } from "@/lib/library-card-assets.server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assets = await ensureStaticLibraryCardAssets({
      userId: user.id,
      fallbackEmail: user.email,
      fallbackAvatarUrl:
        (user.user_metadata?.avatar_url as string | undefined) || null,
      forceQrRegeneration: true,
    });

    return NextResponse.json({
      success: true,
      student_id: assets.studentId,
      qr_url: assets.qrUrl,
      profile_url: assets.profileUrl,
    });
  } catch (error) {
    console.error("Error refreshing my-card assets:", error);
    return NextResponse.json(
      { error: "Failed to refresh card assets" },
      { status: 500 }
    );
  }
}
