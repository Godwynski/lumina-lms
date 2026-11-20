import { NextResponse, connection } from "next/server";
import * as XLSX from "xlsx";
import { withAuthApi, apiError, apiSuccess } from "@/lib/api-utils";
import { logAuditActivity } from "@/lib/audit";
import {
  buildArchiveWorkbook,
  parseArchiveCutoffDate,
  type ArchiveAttendanceExportRow,
  type ArchiveBorrowingExportRow,
} from "@/lib/archive";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids deep PostgrestFilterBuilder generic recursion
function applyBorrowingArchiveEligibility(query: any, cutoffIso: string) {
  return query
    .eq("status", "RETURNED")
    .or(`returned_at.lt.${cutoffIso},and(returned_at.is.null,borrowed_at.lt.${cutoffIso})`)
    .or("fine_amount.is.null,fine_amount.lte.0,fine_settled_at.not.is.null");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids deep PostgrestFilterBuilder generic recursion
function applyAttendanceArchiveEligibility(query: any, cutoffIso: string) {
  return query.not("check_out_at", "is", null).lt("check_out_at", cutoffIso);
}

interface RawBorrowingRow {
  id: string;
  user_id: string;
  book_copy_id: string;
  processed_by: string | null;
  borrowed_at: string | null;
  due_date: string;
  returned_at: string | null;
  status: string | null;
  returned_by: string | null;
  reminder_sent: boolean | null;
  overdue_notified: boolean | null;
  fine_amount: number | string | null;
  fine_settled_at: string | null;
  fine_resolution: string | null;
  fine_remarks: string | null;
  fine_settled_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  profiles?: { full_name?: string | null; email?: string | null; student_id?: string | null } | null;
  book_copies?: {
    accession_number?: string | null;
    qr_string?: string | null;
    books?: { title?: string | null; isbn?: string | null } | null;
  } | null;
}

interface RawAttendanceRow {
  id: string;
  user_id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  notes: string | null;
  created_at: string | null;
  profiles?: { full_name?: string | null; email?: string | null; student_id?: string | null } | null;
}

async function fetchAllEligibleBorrowing(
  supabase: SupabaseClient,
  cutoffIso: string
): Promise<ArchiveBorrowingExportRow[]> {
  const rows: ArchiveBorrowingExportRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("borrowing_records")
      .select(
        `
        id, user_id, book_copy_id, processed_by, borrowed_at, due_date, returned_at,
        status, returned_by, reminder_sent, overdue_notified, fine_amount,
        fine_settled_at, fine_resolution, fine_remarks, fine_settled_by,
        created_at, updated_at,
        profiles:user_id (full_name, email, student_id),
        book_copies:book_copy_id (accession_number, qr_string, books (title, isbn))
      `
      )
      .order("returned_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    query = applyBorrowingArchiveEligibility(query, cutoffIso);
    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as unknown as RawBorrowingRow[];
    for (const r of page) {
      rows.push({
        id: r.id,
        user_id: r.user_id,
        book_copy_id: r.book_copy_id,
        processed_by: r.processed_by,
        borrowed_at: r.borrowed_at,
        due_date: r.due_date,
        returned_at: r.returned_at,
        status: r.status,
        returned_by: r.returned_by,
        reminder_sent: r.reminder_sent,
        overdue_notified: r.overdue_notified,
        fine_amount: r.fine_amount,
        fine_settled_at: r.fine_settled_at,
        fine_resolution: r.fine_resolution,
        fine_remarks: r.fine_remarks,
        fine_settled_by: r.fine_settled_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        patron_name: r.profiles?.full_name ?? null,
        patron_email: r.profiles?.email ?? null,
        patron_id: r.profiles?.student_id ?? null,
        book_title: r.book_copies?.books?.title ?? null,
        book_isbn: r.book_copies?.books?.isbn ?? null,
        copy_accession: r.book_copies?.accession_number ?? null,
        copy_qr: r.book_copies?.qr_string ?? null,
      });
    }

    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchAllEligibleAttendance(
  supabase: SupabaseClient,
  cutoffIso: string
): Promise<ArchiveAttendanceExportRow[]> {
  const rows: ArchiveAttendanceExportRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("attendance")
      .select(
        `
        id, user_id, check_in_at, check_out_at, notes, created_at,
        profiles:user_id (full_name, email, student_id)
      `
      )
      .order("check_out_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    query = applyAttendanceArchiveEligibility(query, cutoffIso);
    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as unknown as RawAttendanceRow[];
    for (const r of page) {
      rows.push({
        id: r.id,
        user_id: r.user_id,
        check_in_at: r.check_in_at,
        check_out_at: r.check_out_at,
        notes: r.notes,
        created_at: r.created_at,
        patron_name: r.profiles?.full_name ?? null,
        patron_email: r.profiles?.email ?? null,
        patron_id: r.profiles?.student_id ?? null,
      });
    }

    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export const GET = withAuthApi(
  async (request, { supabase }) => {
    await connection();
    const searchParams = new URL(request.url).searchParams;
    const parsed = parseArchiveCutoffDate(searchParams.get("before"));
    if (!parsed.ok) {
      return apiError(parsed.error, "INVALID_DATE", 400);
    }

    const previewParam = searchParams.get("preview");
    const isPreview = previewParam === "true" || previewParam === "1";

    try {
      if (isPreview) {
        const borrowingQuery = applyBorrowingArchiveEligibility(
          supabase.from("borrowing_records").select("id", { count: "exact", head: true }),
          parsed.cutoffIso
        );
        const attendanceQuery = applyAttendanceArchiveEligibility(
          supabase.from("attendance").select("id", { count: "exact", head: true }),
          parsed.cutoffIso
        );

        const [borrowingRes, attendanceRes] = await Promise.all([
          borrowingQuery,
          attendanceQuery,
        ]);

        if (borrowingRes.error) throw borrowingRes.error;
        if (attendanceRes.error) throw attendanceRes.error;

        const borrowingCount = borrowingRes.count ?? 0;
        const attendanceCount = attendanceRes.count ?? 0;

        return apiSuccess({
          before: parsed.before,
          borrowingCount,
          attendanceCount,
          totalCount: borrowingCount + attendanceCount,
        });
      }

      const [borrowingRows, attendanceRows] = await Promise.all([
        fetchAllEligibleBorrowing(supabase, parsed.cutoffIso),
        fetchAllEligibleAttendance(supabase, parsed.cutoffIso),
      ]);

      const workbook = buildArchiveWorkbook(XLSX, borrowingRows, attendanceRows);
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="lumina-archive-before-${parsed.before}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("Archive export/preview error:", err);
      return apiError("Failed to prepare archive backup", "DATABASE_ERROR", 500);
    }
  },
  { allowedRoles: ["super_admin"] }
);

export const POST = withAuthApi(
  async (request, { supabase, user }) => {
    let body: { before?: unknown } = {};
    try {
      body = (await request.json()) as { before?: unknown };
    } catch {
      return apiError("Invalid JSON request body", "INVALID_JSON", 400);
    }

    const parsed = parseArchiveCutoffDate(body?.before);
    if (!parsed.ok) {
      return apiError(parsed.error, "INVALID_DATE", 400);
    }

    const { data, error } = await supabase.rpc("archive_old_logs", {
      p_before: parsed.before,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("Cutoff date")) {
        return apiError(msg, "INVALID_DATE", 400);
      }
      console.error("Archive RPC error:", error);
      return apiError("Failed to archive old logs", "DATABASE_ERROR", 500);
    }

    const rpcResult = (data || {}) as {
      borrowing_count?: number;
      attendance_count?: number;
      total_count?: number;
    };
    const borrowingCount = Number(rpcResult.borrowing_count ?? 0);
    const attendanceCount = Number(rpcResult.attendance_count ?? 0);
    const totalCount = Number(rpcResult.total_count ?? borrowingCount + attendanceCount);

    await logAuditActivity(
      user.id,
      "system",
      null,
      "archive_old_logs",
      `Archived ${borrowingCount} borrowing records and ${attendanceCount} attendance records before ${parsed.before}.`,
      {
        before: parsed.before,
        borrowingCount,
        attendanceCount,
        totalCount,
      },
      null,
      {
        before: parsed.before,
        borrowingCount,
        attendanceCount,
      }
    );

    return apiSuccess({
      before: parsed.before,
      borrowingCount,
      attendanceCount,
      totalCount,
    });
  },
  { allowedRoles: ["super_admin"] }
);
