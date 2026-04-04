import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

import {
  checkStaticLibraryCardAssets,
  getDeterministicProfileUrl,
  isDeterministicProfileUrl,
  resolveStudentId,
} from "@/lib/library-card-assets";

type ProfileRow = {
  student_id: string | null;
  email: string | null;
  avatar_url: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rawProfile, error: profileError } = await supabase
      .from("profiles")
      .select("student_id, email, avatar_url")
      .eq("id", user.id)
      .single();

    if (profileError || !rawProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profile = rawProfile as ProfileRow;
    const studentId = resolveStudentId({
      studentId: profile.student_id,
      email: profile.email,
      fallbackEmail: user.email,
      userId: user.id,
    });

    if (!studentId) {
      return NextResponse.json(
        { error: "Unable to resolve student ID" },
        { status: 400 }
      );
    }

    const status = await checkStaticLibraryCardAssets({ studentId });
    const profileUrl = profile.avatar_url || getDeterministicProfileUrl(studentId);

    return NextResponse.json({
      student_id: studentId,
      qr_url: status.qrUrl,
      profile_url: profileUrl,
      qr_exists: status.qrExists,
      profile_exists: status.profileExists,
      profile_is_deterministic: isDeterministicProfileUrl(profile.avatar_url),
      ready: status.qrExists && status.profileExists,
    });
  } catch (error) {
    console.error("Error checking card asset status:", error);
    return NextResponse.json(
      { error: "Failed to check card asset status" },
      { status: 500 }
    );
  }
}
