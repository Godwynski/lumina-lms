import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { withAuthApi } from "@/lib/api-utils";

const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_JSON_FIELD_CHARS = 16_384;

const JsonFieldSchema = z.unknown().refine(
  (val) => {
    if (val === undefined || val === null) return true;
    try {
      return JSON.stringify(val).length <= MAX_JSON_FIELD_CHARS;
    } catch {
      return false;
    }
  },
  { message: "Log field value exceeds maximum allowed size." }
);

const AuditLogImportItemSchema = z.object({
  entity_type: z.string().trim().min(1, "Validation failed: 'entity_type' and 'action' are required fields on all log items.").max(100),
  action: z.string().trim().min(1, "Validation failed: 'entity_type' and 'action' are required fields on all log items.").max(100),
  entity_id: z.string().max(255).nullable().optional(),
  admin_id: z.string().max(255).nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
  old_value: JsonFieldSchema.optional(),
  new_value: JsonFieldSchema.optional(),
  details: JsonFieldSchema.optional(),
  created_at: z.union([z.string().max(100), z.number().finite(), z.date()]).nullable().optional(),
});

const AuditLogImportBodySchema = z
  .object({
    logs: z
      .array(AuditLogImportItemSchema)
      .min(1, "Invalid payload. 'logs' field must be a non-empty array.")
      .max(MAX_IMPORT_ROWS, `Too many log records. Maximum ${MAX_IMPORT_ROWS} rows per request.`),
  })
  .strict();

function parseAnyDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Try to handle numbers or numeric strings
  const num = Number(val);
  if (!isNaN(num)) {
    // Is it a Unix timestamp in milliseconds? (e.g. 1779321600000)
    if (num >= 100000000000) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d;
    }
    // Is it a Unix timestamp in seconds? (e.g. 1779321600)
    if (num >= 100000000 && num < 100000000000) {
      const d = new Date(num * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    // Is it an Excel serial date? (e.g. 46161.58082175926)
    // Excel date serial numbers are positive numbers representing days since 1899-12-30.
    // We restrict range to [10000, 2000000] to avoid treating small numbers/years as serial dates.
    if (num >= 10000 && num < 2000000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 86400000;
      const d = new Date(excelEpoch.getTime() + num * msPerDay);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Try parsing as standard date string
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export const POST = withAuthApi(async (request, { user, profile }) => {
  await connection();
  try {
    let rawText: string;
    try {
      rawText = await request.text();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (rawText.length > MAX_IMPORT_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 400 }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = AuditLogImportBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload." },
        { status: 400 }
      );
    }

    const { logs } = parsed.data;

    // Validate and clean up records
    const cleanedLogs: Record<string, unknown>[] = [];

    for (const log of logs) {
      const cleanEntityType = log.entity_type.toLowerCase().trim();
      const details =
        log.details && typeof log.details === "object" && !Array.isArray(log.details)
          ? (log.details as Record<string, unknown>)
          : {};

      // Imported rows are attributed to the importer and marked, so a file can't forge who did what.
      const parsedDate = parseAnyDate(log.created_at);
      cleanedLogs.push({
        admin_id: user.id,
        entity_type: cleanEntityType,
        entity_id: log.entity_id || null,
        action: log.action.toLowerCase().trim(),
        old_value: log.old_value ?? null,
        new_value: log.new_value ?? null,
        reason: log.reason || null,
        details: { ...details, imported: true, original_admin_id: log.admin_id ?? null },
        created_at: parsedDate ? parsedDate.toISOString() : new Date().toISOString(),
      });
    }

    // Perform batch insertion
    const batchSize = 100;
    let insertedCount = 0;
    const adminSupabase = createAdminClient();

    for (let i = 0; i < cleanedLogs.length; i += batchSize) {
      const batch = cleanedLogs.slice(i, i + batchSize);
      const { error: insertError } = await adminSupabase
        .from("audit_logs")
        .insert(batch);

      if (insertError) {
        console.error("Batch insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to import audit logs due to a database error" },
          { status: 500 }
        );
      }

      insertedCount += batch.length;
    }

    // Log the import/restore event itself in the audit log
    await adminSupabase.from("audit_logs").insert({
      admin_id: user.id,
      entity_type: "system",
      action: "update",
      reason: `Imported and restored ${insertedCount} audit log records.`,
      details: {
        imported_records_count: insertedCount,
        imported_by: profile.email || user.email || "super_admin",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      count: insertedCount,
    });
  } catch (error) {
    console.error("Error importing audit logs:", error);
    return NextResponse.json(
      { error: "Failed to import audit logs" },
      { status: 500 }
    );
  }
}, { allowedRoles: ["super_admin"] });
