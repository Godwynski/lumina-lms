import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Types for graduation cleanup
interface GraduationCleanupResult {
  success: boolean;
  deactivatedCount: number;
  skippedCount: number;
  errorCount: number;
  details: Array<{
    userId: string;
    email: string;
    status: "deactivated" | "skipped" | "error";
    reason?: string;
  }>;
}

async function getSystemSetting(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value || null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { dryRun = false } = body;

    // Get all student profiles
    const { data: students, error: studentError } = await supabase
      .from("profiles")
      .select("id, email, full_name, status")
      .eq("role", "student");

    if (studentError) throw studentError;

    const result: GraduationCleanupResult = {
      success: true,
      deactivatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      details: [],
    };

    if (!students || students.length === 0) {
      return NextResponse.json(result);
    }

    // For each student, check their status (would normally sync with MS Graph)
    // For now, we'll deactivate students who don't have active borrowing records
    for (const student of students) {
      try {
        // Check if student has active borrowings
        const { count: activeBorrows } = await supabase
          .from("borrowing_records")
          .select("*", { count: "exact" })
          .eq("user_id", student.id)
          .eq("status", "ACTIVE");

        // If no active borrows and status is active, candidate for deactivation
        const activeBorrowCount = activeBorrows ?? 0;
        if (activeBorrowCount === 0 && student.status === "active") {
          if (!dryRun) {
            // Deactivate student
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ status: "graduated" })
              .eq("id", student.id);

            if (updateError) throw updateError;

            // Deactivate library card
            await supabase
              .from("library_cards")
              .update({ status: "expired" })
              .eq("user_id", student.id);

            // Log audit entry
            await supabase.from("audit_logs").insert([
              {
                admin_id: user.user.id,
                entity_type: "profile",
                entity_id: student.id,
                action: "update",
                old_value: JSON.stringify({ status: "active" }),
                new_value: JSON.stringify({ status: "graduated" }),
                reason: "Batch graduation cleanup - no active borrows",
              },
            ]);
          }

          result.deactivatedCount++;
          result.details.push({
            userId: student.id,
            email: student.email || "unknown",
            status: "deactivated",
            reason: "No active borrowing records",
          });
        } else {
          result.skippedCount++;
          result.details.push({
            userId: student.id,
            email: student.email || "unknown",
            status: "skipped",
            reason: activeBorrowCount > 0 ? "Has active borrows" : "Already inactive",
          });
        }
      } catch (err) {
        result.errorCount++;
        result.details.push({
          userId: student.id,
          email: student.email || "unknown",
          status: "error",
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      ...result,
      dryRun,
      totalProcessed: result.deactivatedCount + result.skippedCount + result.errorCount,
    });
  } catch (error) {
    console.error("Graduation cleanup error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", success: false },
      { status: 500 }
    );
  }
}
