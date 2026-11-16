import type * as XLSXTypes from "xlsx";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ArchiveBorrowingExportRow {
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
  patron_name?: string | null;
  patron_email?: string | null;
  patron_id?: string | null;
  book_title?: string | null;
  book_isbn?: string | null;
  copy_accession?: string | null;
  copy_qr?: string | null;
}

export interface ArchiveAttendanceExportRow {
  id: string;
  user_id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  notes: string | null;
  created_at: string | null;
  patron_name?: string | null;
  patron_email?: string | null;
  patron_id?: string | null;
}

export type ParseArchiveCutoffResult =
  | { ok: true; before: string; cutoffIso: string }
  | { ok: false; error: string };

/** Returns YYYY-MM-DD for the current wall-clock date in Asia/Manila. */
export function getManilaTodayDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Returns the maximum allowed cutoff date (1 year prior to Manila today). */
export function getMinArchiveCutoffDate(now: Date = new Date()): string {
  const today = getManilaTodayDate(now);
  const match = DATE_PATTERN.exec(today);
  if (!match) {
    throw new Error("Could not determine Manila date");
  }
  const year = Number(match[1]) - 1;
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Match Postgres (date - interval '1 year')::date on leap day (Feb 29 -> Feb 28).
  const clampedDay = month === 2 && day === 29 ? 28 : day;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/** Returns recent school-year June 1 cutoff options that are at least 1 year old. */
export function getSchoolYearCutoffOptions(
  now: Date = new Date()
): Array<{ label: string; value: string }> {
  const minCutoff = getMinArchiveCutoffDate(now);
  const maxYear = Number(minCutoff.slice(0, 4));
  const candidate = `${maxYear}-06-01`;
  const startYear = candidate <= minCutoff ? maxYear : maxYear - 1;

  return [0, 1, 2].map((offset) => {
    const y = startYear - offset;
    return {
      label: `Before SY ${y}–${y + 1} (${y}-06-01)`,
      value: `${y}-06-01`,
    };
  });
}

/** Validates a cutoff date string (YYYY-MM-DD) and enforces the 1-year minimum age rule. */
export function parseArchiveCutoffDate(
  raw: unknown,
  now: Date = new Date()
): ParseArchiveCutoffResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Cutoff date (before) is required in YYYY-MM-DD format." };
  }

  const trimmed = raw.trim();
  const match = DATE_PATTERN.exec(trimmed);
  if (!match) {
    return { ok: false, error: "Invalid cutoff date. Expected YYYY-MM-DD format." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return { ok: false, error: "Invalid calendar date." };
  }

  const minCutoff = getMinArchiveCutoffDate(now);
  if (trimmed > minCutoff) {
    return {
      ok: false,
      error: `Cutoff date must be at least 1 year old (on or before ${minCutoff}).`,
    };
  }

  return {
    ok: true,
    before: trimmed,
    cutoffIso: `${trimmed}T00:00:00+08:00`,
  };
}

export const BORROWING_ARCHIVE_HEADERS = [
  "id",
  "user_id",
  "patron_name",
  "patron_email",
  "patron_id",
  "book_copy_id",
  "book_title",
  "book_isbn",
  "copy_accession",
  "copy_qr",
  "processed_by",
  "borrowed_at",
  "due_date",
  "returned_at",
  "status",
  "returned_by",
  "reminder_sent",
  "overdue_notified",
  "fine_amount",
  "fine_settled_at",
  "fine_resolution",
  "fine_remarks",
  "fine_settled_by",
  "created_at",
  "updated_at",
] as const;

export const ATTENDANCE_ARCHIVE_HEADERS = [
  "id",
  "user_id",
  "patron_name",
  "patron_email",
  "patron_id",
  "check_in_at",
  "check_out_at",
  "notes",
  "created_at",
] as const;

/** Builds an XLSX backup workbook with Borrowing Records and Attendance sheets. */
export function buildArchiveWorkbook(
  XLSX: typeof XLSXTypes,
  borrowingRows: ArchiveBorrowingExportRow[],
  attendanceRows: ArchiveAttendanceExportRow[]
): XLSXTypes.WorkBook {
  const borrowingSheetRows = borrowingRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    patron_name: row.patron_name ?? "",
    patron_email: row.patron_email ?? "",
    patron_id: row.patron_id ?? "",
    book_copy_id: row.book_copy_id,
    book_title: row.book_title ?? "",
    book_isbn: row.book_isbn ?? "",
    copy_accession: row.copy_accession ?? "",
    copy_qr: row.copy_qr ?? "",
    processed_by: row.processed_by ?? "",
    borrowed_at: row.borrowed_at ?? "",
    due_date: row.due_date,
    returned_at: row.returned_at ?? "",
    status: row.status ?? "",
    returned_by: row.returned_by ?? "",
    reminder_sent: row.reminder_sent ?? false,
    overdue_notified: row.overdue_notified ?? false,
    fine_amount: row.fine_amount ?? "",
    fine_settled_at: row.fine_settled_at ?? "",
    fine_resolution: row.fine_resolution ?? "",
    fine_remarks: row.fine_remarks ?? "",
    fine_settled_by: row.fine_settled_by ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  }));

  const attendanceSheetRows = attendanceRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    patron_name: row.patron_name ?? "",
    patron_email: row.patron_email ?? "",
    patron_id: row.patron_id ?? "",
    check_in_at: row.check_in_at ?? "",
    check_out_at: row.check_out_at ?? "",
    notes: row.notes ?? "",
    created_at: row.created_at ?? "",
  }));

  const borrowingSheet = XLSX.utils.json_to_sheet(borrowingSheetRows, {
    header: [...BORROWING_ARCHIVE_HEADERS],
  });
  borrowingSheet["!cols"] = BORROWING_ARCHIVE_HEADERS.map((h) => ({
    wch: Math.max(16, h.length + 4),
  }));

  const attendanceSheet = XLSX.utils.json_to_sheet(attendanceSheetRows, {
    header: [...ATTENDANCE_ARCHIVE_HEADERS],
  });
  attendanceSheet["!cols"] = ATTENDANCE_ARCHIVE_HEADERS.map((h) => ({
    wch: Math.max(16, h.length + 4),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, borrowingSheet, "Borrowing Records");
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Attendance");
  return workbook;
}
