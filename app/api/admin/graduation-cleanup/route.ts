import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditActivity } from "@/lib/audit";

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
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

    const studentIds = students.map((s) => s.id);

    // Batch fetch active borrowing records
    const { data: activeBorrowsData, error: borrowsError } = await supabase
      .from("borrowing_records")
      .select("user_id")
      .in("user_id", studentIds)
      .eq("status", "ACTIVE");

    if (borrowsError) {
      throw borrowsError;
    }

    // Set of student IDs that have active borrows
    const studentsWithActiveBorrows = new Set(
      activeBorrowsData?.map((record) => record.user_id) || []
    );

    const studentsToDeactivate = [];
    const studentsToSkip = [];

    for (const student of students) {
      const hasActiveBorrows = studentsWithActiveBorrows.has(student.id);

      if (!hasActiveBorrows && student.status === "ACTIVE") {
        studentsToDeactivate.push(student);
      } else {
        studentsToSkip.push({
          student,
          reason: hasActiveBorrows ? "Has active borrows" : "Already inactive",
        });
      }
    }

    if (!dryRun && studentsToDeactivate.length > 0) {
      try {
        const deactivatedStudentIds = studentsToDeactivate.map((s) => s.id);

        // Bulk update profiles
        const { error: updateProfilesError } = await supabase
          .from("profiles")
          .update({ status: "GRADUATED" })
          .in("id", deactivatedStudentIds);

        if (updateProfilesError) throw updateProfilesError;

        // Bulk update library cards
        const { error: updateCardsError } = await supabase
          .from("library_cards")
          .update({ status: "EXPIRED" })
          .in("user_id", deactivatedStudentIds);

        if (updateCardsError) throw updateCardsError;

      } catch (err) {
        // If bulk update fails, all candidates fail
        for (const student of studentsToDeactivate) {
          result.errorCount++;
          result.details.push({
            userId: student.id,
            email: student.email || "unknown",
            status: "error",
            reason: err instanceof Error ? err.message : "Bulk update failed",
          });
        }
        studentsToDeactivate.length = 0; // Clear successfully deactivated candidates
      }

      // Log audit entries individually to preserve existing behavior
      for (const student of studentsToDeactivate) {
        try {
          await logAuditActivity(
            user.id,
            "profile",
            student.id,
            "update",
            "Batch graduation cleanup - no active borrows",
            { batch: true },
            { status: student.status },
            { status: "GRADUATED" }
          );
        } catch (auditErr) {
          console.error("Failed to log audit activity for student", student.id, auditErr);
        }
      }
    }

    // Populate results
    for (const student of studentsToDeactivate) {
      result.deactivatedCount++;
      result.details.push({
        userId: student.id,
        email: student.email || "unknown",
        status: "deactivated",
        reason: "No active borrowing records",
      });
    }

    for (const item of studentsToSkip) {
      result.skippedCount++;
      result.details.push({
        userId: item.student.id,
        email: item.student.email || "unknown",
        status: "skipped",
        reason: item.reason,
      });
    }

    if (!dryRun && result.deactivatedCount > 0) {
      await logAuditActivity(
        user.id,
        "system",
        null,
        "graduation_cleanup",
        `Completed graduation cleanup batch: ${result.deactivatedCount} students deactivated.`,
        { ...result }
      );
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
