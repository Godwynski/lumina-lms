"use server";

import { getMe } from "@/lib/auth-helpers";
import { getReportDatasets } from "@/lib/auth/report-access";
import { logAuditActivity } from "@/lib/audit";
import { computeOverdueFine } from "@/lib/fines";
import {
  REPORT_DATASETS, REPORT_PREVIEW_ROWS, reportConfigSchema,
  type ReportCell, type ReportOutput, type ReportResult, type ReportResultSection, type ReportSection,
} from "@/lib/report-builder";

const PAGE_SIZE = 500;
const SECTION_ROW_LIMIT = 25_000;
const EXPORT_ROW_LIMIT = 40_000;
type Session = NonNullable<Awaited<ReturnType<typeof getMe>>>;
type DateRange = { from: string; to: string };
type RawRow = Record<string, unknown> & { id: string };
type Intent = "preview" | ReportOutput;

class ReportError extends Error {}

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateColumns = new Set(["check_in_at", "check_out_at", "borrowed_at", "due_date", "returned_at", "fine_settled_at", "created_at"]);
const profileColumns = ["full_name", "student_id", "email"];

function shiftDay(day: string, count: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function timeBucket(day: string, group: ReportSection["group"]) {
  if (group === "year") return day.slice(0, 4);
  if (group === "month") return day.slice(0, 7);
  if (group === "week") {
    const weekday = new Date(day + "T00:00:00Z").getUTCDay();
    return shiftDay(day, -((weekday + 6) % 7));
  }
  return day;
}

function relation(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return relation(value[0]);
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function sectionSource(section: ReportSection) {
  const details = section.metric === "records";
  const search = !!section.search.trim();
  const personal = profileColumns.filter(column => details && section.columns.includes(column));
  switch (section.dataset) {
    case "attendance": {
      const names = new Set([...personal, ...(search ? ["full_name", "student_id"] : [])]);
      const fields = ["id", "check_in_at", "check_out_at", "notes", ...(section.metric === "visitors" ? ["user_id"] : [])];
      if (names.size) fields.push(`profiles(${[...names].join(",")})`);
      return { table: "attendance", fields: fields.join(","), date: "check_in_at" };
    }
    case "borrowing": {
      const names = new Set([...personal, ...(search ? profileColumns : [])]);
      const fields = ["id", "borrowed_at", "due_date", "returned_at", "status", "fine_amount", "fine_settled_at", "fine_resolution"];
      if (details || search) fields.push("book_copies(qr_string,books(title,author))");
      if (details) fields.push("fine_remarks");
      if (names.size) fields.push(`profiles!borrowing_records_user_id_fkey(${[...names].join(",")})`);
      const date = section.metric === "returns" ? "returned_at" :
        ["SETTLED", "PAID", "CONDONED"].includes(section.filter) && details ? "fine_settled_at" : "borrowed_at";
      return { table: "borrowing_records", fields: fields.join(","), date };
    }
    case "inventory":
      return { table: "books", fields: "id,title,author,isbn,location,section,dewey_decimal,published_year,total_copies,available_copies,is_active,categories(name)", date: null };
    case "users": {
      const fields = new Set(["id", "created_at", "role", "status", ...(details ? section.columns : []),
        ...(search ? ["full_name", "email", "student_id", "department"] : [])]);
      return { table: "profiles", fields: [...fields].join(","), date: "created_at" };
    }
  }
}

async function fetchRows(
  session: Session, section: ReportSection, source: ReturnType<typeof sectionSource>, period: DateRange,
) {
  const result: RawRow[] = [];
  let cursor: string | undefined;
  const until = shiftDay(period.to, 1);
  while (true) {
    let query = session.supabase.from(source.table).select(source.fields).order("id").limit(PAGE_SIZE);
    if (cursor) query = query.gt("id", cursor);
    if (source.date) query = query.gte(source.date, period.from + "T00:00:00+08:00")
      .lt(source.date, until + "T00:00:00+08:00");
    if (section.dataset === "users" && session.role === "librarian") query = query.neq("role", "super_admin");
    if (section.dataset === "users" && section.filter !== "all") query = query.eq("status", section.filter);
    if (section.dataset === "inventory" && section.filter !== "all") query = query.eq("is_active", section.filter === "ACTIVE");
    if (section.dataset === "attendance") {
      if (section.filter === "Active") query = query.is("check_out_at", null);
      if (section.filter === "Completed") query = query.not("check_out_at", "is", null);
      if (section.filter === "No Log Out") query = query.eq("notes", "No Log Out");
    }
    if (section.dataset === "borrowing") {
      if (["ACTIVE", "RETURNED"].includes(section.filter)) query = query.eq("status", section.filter);
      if (section.filter === "SETTLED") query = query.not("fine_settled_at", "is", null);
      if (["PAID", "CONDONED"].includes(section.filter)) query = query.eq("fine_resolution", section.filter);
    }
    const { data, error } = await query;
    if (error) throw new ReportError(`Could not load ${REPORT_DATASETS[section.dataset].label}. Try again.`);
    const rows = (data ?? []) as unknown as RawRow[];
    result.push(...rows);
    if (result.length > SECTION_ROW_LIMIT) {
      const filter = section.dataset === "inventory" ? "Choose active or archived titles." : "Choose a shorter date range.";
      throw new ReportError(`${REPORT_DATASETS[section.dataset].label} exceeds 25,000 source rows. ${filter}`);
    }
    if (rows.length < PAGE_SIZE) return result;
    cursor = rows[rows.length - 1].id;
  }
}

function reportRow(row: RawRow, dataset: ReportSection["dataset"], now: Date, fineRate?: number) {
  switch (dataset) {
    case "attendance":
      return { ...row, ...relation(row.profiles), status: row.notes === "No Log Out" ? "No Log Out" : row.check_out_at ? "Completed" : "Active" };
    case "borrowing": {
      const copy = relation(row.book_copies);
      const isLate = row.status === "ACTIVE" && typeof row.due_date === "string" && Date.parse(row.due_date) < now.getTime();
      const fine = fineRate === undefined ? row.fine_amount : computeOverdueFine({
        due_date: String(row.due_date),
        returned_at: typeof row.returned_at === "string" ? row.returned_at : null,
        status: String(row.status),
        fine_amount: row.fine_amount == null ? null : Number(row.fine_amount),
      }, fineRate);
      return { ...row, ...relation(row.profiles), ...relation(copy.books), qr_string: copy.qr_string, status: isLate ? "OVERDUE" : row.status, fine_amount: fine };
    }
    case "inventory":
      return { ...row, status: row.is_active ? "ACTIVE" : "ARCHIVED", category: relation(row.categories).name };
    case "users":
      return row;
  }
}

function matchesStatus(row: Record<string, unknown>, section: ReportSection) {
  const filter = section.filter;
  if (filter === "all") return true;
  if (section.dataset === "borrowing") {
    const fine = Number(row.fine_amount ?? 0);
    const receivable = row.status === "RETURNED" && fine > 0 && !row.fine_settled_at;
    if (filter === "OVERDUE") return row.status === "OVERDUE" || receivable;
    if (filter === "RETURNED") return row.status === "RETURNED" && !receivable;
    if (["SETTLED", "PAID", "CONDONED"].includes(filter)) {
      return !!row.fine_settled_at && fine > 0 && (filter === "SETTLED" || row.fine_resolution === filter);
    }
  }
  return row.status === filter;
}

function matches(row: Record<string, unknown>, section: ReportSection, search: string) {
  return matchesStatus(row, section) && (!search || ["full_name", "student_id", "email", "title", "author", "qr_string", "isbn", "category", "location", "department"].some(key =>
    typeof row[key] === "string" && row[key].toLowerCase().includes(search)));
}

function tableCell(row: Record<string, unknown>, key: string): ReportCell {
  const raw = row[key];
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  if (!dateColumns.has(key)) return raw;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : `${dayFormatter.format(date)} ${timeFormatter.format(date)}`;
}

function summarize(
  rows: Record<string, unknown>[], section: ReportSection, dateColumn: string | null, period: DateRange,
): ReportCell[][] {
  const counts = new Map<string, number>();
  const visitors = new Map<string, Set<unknown>>();
  if (dateColumn) {
    for (let day = period.from; day <= period.to; day = shiftDay(day, 1)) {
      counts.set(timeBucket(day, section.group), 0);
    }
  }
  for (const row of rows) {
    const bucket = dateColumn
      ? timeBucket(dayFormatter.format(new Date(String(row[dateColumn]))), section.group)
      : String(row[section.group] || (section.group === "category" ? "Uncategorized" : "No location"));
    if (section.metric === "visitors") {
      const distinct = visitors.get(bucket) ?? new Set();
      distinct.add(row.user_id);
      visitors.set(bucket, distinct);
      counts.set(bucket, distinct.size);
    } else {
      const value = section.metric === "copies" ? Number(row.total_copies ?? 0) :
        section.metric === "available" ? Number(row.available_copies ?? 0) : 1;
      counts.set(bucket, (counts.get(bucket) ?? 0) + value);
    }
  }
  const entries = [...counts];
  if (!dateColumn) entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries;
}

async function getSection(
  session: Session, section: ReportSection, period: DateRange, now: Date, intent: Intent, fineRate?: number,
): Promise<ReportResultSection> {
  const source = sectionSource(section);
  const definition = REPORT_DATASETS[section.dataset];
  const metricName = (definition.metrics as Record<string, string>)[section.metric];
  const dateLabel = source.date === "returned_at" ? "Return date" :
    source.date === "fine_settled_at" ? "Settlement date" :
    section.dataset === "attendance" ? "Check-in date" : section.dataset === "users" ? "Registration date" : "Loan date";
  const range = source.date ? `${dateLabel} · ${period.from} to ${period.to} · Manila time`
    : `Stock as of ${dayFormatter.format(now)} ${timeFormatter.format(now)} Manila time`;
  const status = (definition.filters as Record<string, string>)[section.filter];
  const coverage = section.dataset === "attendance" || section.dataset === "borrowing" ? "Live logs only · Archived records excluded" : "";
  const search = section.search.trim().toLowerCase();
  const entries = (await fetchRows(session, section, source, period))
    .map(row => reportRow(row, section.dataset, now, fineRate)).filter(row => matches(row, section, search));
  const details = section.metric === "records";
  let rows: ReportCell[][];
  if (details) {
    const key = source.date ?? "title";
    entries.sort((a, b) => source.date
      ? Date.parse(String(b[key])) - Date.parse(String(a[key]))
      : String(a[key] || "").localeCompare(String(b[key] || "")));
    rows = (intent === "preview" ? entries.slice(0, REPORT_PREVIEW_ROWS) : entries)
      .map(row => section.columns.map(column => tableCell(row, column)));
  } else {
    rows = summarize(entries, section, source.date, period);
  }
  const groupLabel = { day: "Date", week: "Week of (Monday)", month: "Month", year: "Year", category: "Category", location: "Location" }[section.group];
  return {
    id: section.id,
    title: details ? metricName : `${metricName} by ${section.group}`,
    scope: [range, status, coverage, search ? "Search filter applied" : ""].filter(Boolean).join(" · "),
    display: section.display,
    headers: details ? section.columns.map(column => (definition.columns as Record<string, string>)[column]) : [groupLabel, metricName],
    rows,
    rowCount: details ? entries.length : rows.length,
  };
}

function includesFines(section: ReportSection) {
  return section.dataset === "borrowing" && section.metric === "records" && section.columns.includes("fine_amount");
}

async function getFineRate(session: Session) {
  const { data, error } = await session.supabase.from("system_settings").select("value").eq("key", "overdue_fine_per_day").maybeSingle();
  if (error) throw new ReportError("Could not load the fine policy. Try again.");
  const rate = data?.value != null && data.value !== "" ? Number(data.value) : 5;
  return Number.isFinite(rate) ? rate : 5;
}

export async function buildReport(input: unknown, intent: Intent = "preview"): Promise<ReportResult> {
  const me = await getMe();
  if (!me) throw new ReportError("Unauthorized");
  const allowed = getReportDatasets(me.role, me.profile);
  if (!allowed.length) throw new ReportError("Forbidden");
  const parsed = reportConfigSchema.safeParse(input);
  if (!parsed.success) throw new ReportError("Choose valid dates spanning up to five years and select at least one column for each table.");
  if (!["preview", "pdf", "excel", "csv"].includes(intent)) throw new ReportError("Choose a valid export format.");
  const config = parsed.data;
  if (config.sections.some(section => !allowed.includes(section.dataset))) throw new ReportError("Forbidden");
  if (intent === "csv" && config.sections.length !== 1) throw new ReportError("Choose one section for CSV.");
  const now = new Date();
  const fineRate = config.sections.some(includesFines) ? getFineRate(me) : undefined;
  const sections = await Promise.all(config.sections.map(async section =>
    getSection(me, section, section.dates ?? config, now, intent, includesFines(section) ? await fineRate : undefined)));
  if (intent !== "preview") {
    if (sections.reduce((count, section) => count + section.rowCount, 0) > EXPORT_ROW_LIMIT) {
      throw new ReportError("This report exceeds 40,000 output rows. Narrow the scope or export fewer sections.");
    }
    await logAuditActivity(me.user.id, "system", null, "report_generated", null, {
      format: intent, datasets: [...new Set(config.sections.map(section => section.dataset))],
    });
  }
  return { title: config.title, sections };
}

export async function requestReport(input: unknown, intent: Intent = "preview") {
  try {
    return { success: true as const, report: await buildReport(input, intent) };
  } catch (error) {
    return { success: false as const, error: error instanceof ReportError ? error.message : "Could not build the report. Try again." };
  }
}
