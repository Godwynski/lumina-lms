import { NextResponse } from "next/server";
import { logAuditActivity } from "@/lib/audit";
import { withAuthApi } from "@/lib/api-utils";

export const POST = withAuthApi(async (_req, { supabase, user }) => {
  // Perform massive update: Reset all student accounts to SUSPENDED
  // This effectively deactivates them for the new school year until manually re-approved
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ status: "SUSPENDED" })
    .eq("role", "student");

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Also update library cards to SUSPENDED status but ONLY for students
  const { data: students, error: studentsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student");

  if (!studentsError && students && students.length > 0) {
    const studentIds = students.map(s => s.id);
    const CHUNK_SIZE = 100;
    for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
      const chunk = studentIds.slice(i, i + CHUNK_SIZE);
      const { error: cardError } = await supabase
        .from("library_cards")
        .update({ status: "SUSPENDED" })
        .in("user_id", chunk);

      if (cardError) {
        console.error("Failed to update student library cards chunk:", cardError);
      }
    }
  }

  // Log the mass action
  await logAuditActivity(
    user.id,
    "system",
    null,
    "annual_reset",
    "Mass suspension of all student accounts for the new school year.",
    { 
      affectedCount: students?.length || 0,
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
