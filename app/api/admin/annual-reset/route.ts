import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  
  // Verify admin authorization
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
  }

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
    const { error: cardError } = await supabase
      .from("library_cards")
      .update({ status: "SUSPENDED" })
      .in("user_id", studentIds)
      .is("deleted_at", null);

    if (cardError) {
      console.error("Failed to update student library cards:", cardError);
    }
  }

  return NextResponse.json({ 
    success: true, 
    message: "Annual reset complete. All student accounts have been suspended." 
  });
}
