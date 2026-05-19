import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email, full_name")
      .eq("id", user.user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { logs } = body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload. 'logs' field must be a non-empty array." },
        { status: 400 }
      );
    }

    // Validate and clean up records
    const cleanedLogs: any[] = [];
    const entityTypes = [
      "book",
      "book_copy",
      "profile",
      "borrowing_record",
      "category",
      "policy",
      "fine",
      "settings",
      "system",
    ];

    for (const log of logs) {
      // Basic validations
      if (!log.entity_type || !log.action) {
        return NextResponse.json(
          { error: "Validation failed: 'entity_type' and 'action' are required fields on all log items." },
          { status: 400 }
        );
      }

      // Check format of entity_type
      const cleanEntityType = String(log.entity_type).toLowerCase().trim();
      if (!entityTypes.includes(cleanEntityType) && cleanEntityType !== "all") {
        // We can allow other strings if they are custom, but let's keep it safe. Let's allow it or fallback to 'system'
      }

      // Build inserting object
      cleanedLogs.push({
        admin_id: log.admin_id || user.user.id,
        entity_type: cleanEntityType,
        entity_id: log.entity_id || null,
        action: String(log.action).toLowerCase().trim(),
        old_value: log.old_value || null,
        new_value: log.new_value || null,
        reason: log.reason || null,
        details: log.details || {},
        created_at: log.created_at || new Date().toISOString(),
      });
    }

    // Perform batch insertion
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < cleanedLogs.length; i += batchSize) {
      const batch = cleanedLogs.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("audit_logs")
        .insert(batch);

      if (insertError) {
        console.error("Batch insert error:", insertError);
        return NextResponse.json(
          { error: `Database error during batch insertion: ${insertError.message}` },
          { status: 500 }
        );
      }

      insertedCount += batch.length;
    }

    // Log the import/restore event itself in the audit log
    await supabase.from("audit_logs").insert({
      admin_id: user.user.id,
      entity_type: "system",
      action: "update",
      reason: `Imported and restored ${insertedCount} audit log records.`,
      details: {
        imported_records_count: insertedCount,
        imported_by: profile.email || user.user.email || "super_admin",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      count: insertedCount,
    });
  } catch (error: any) {
    console.error("Error importing audit logs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import audit logs" },
      { status: 500 }
    );
  }
}
