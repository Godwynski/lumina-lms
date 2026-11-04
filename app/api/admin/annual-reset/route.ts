import { NextResponse } from "next/server";
import { logAuditActivity } from "@/lib/audit";
import { withAuthApi } from "@/lib/api-utils";

export const POST = withAuthApi(async (_req, { supabase, user }) => {
  // One SQL function suspends every student and their library card. Reading the ids back in the
  // app was capped at 1,000 rows, so cards past that stayed active (M8).
  const { data: affectedCount, error } = await supabase.rpc("annual_student_reset");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditActivity(
    user.id,
    "system",
    null,
    "annual_reset",
    "Mass suspension of all student accounts for the new school year.",
    {
      affectedCount: affectedCount ?? 0,
      role: "student",
      action: "SUSPENDED"
    },
    { status: "ACTIVE" },
    { status: "SUSPENDED" }
  );

  return NextResponse.json({
    success: true,
    message: "Annual reset complete. All student accounts have been suspended."
  });
}, { allowedRoles: ["super_admin"] });
