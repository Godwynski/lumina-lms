import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockQueryBuilder, createMockSupabaseClient } from "./mocks/supabase";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReport, requestReport } from "@/lib/actions/reports";
import { createReportSection, reportCsv, type ReportConfig } from "@/lib/report-builder";
import { buildReportWorkbook } from "@/lib/report-workbook";
import * as xlsx from "xlsx";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/server", () => ({ after: (callback: () => unknown) => callback() }));

let db: ReturnType<typeof createMockSupabaseClient>;
let audit: ReturnType<typeof createMockSupabaseClient>;
const created = "2026-10-31T16:01:00Z";

function config(...sections: ReportConfig["sections"]): ReportConfig {
  return { title: "Library activity", from: "2026-11-01", to: "2026-11-02", sections };
}

function signIn(role: string, status = "ACTIVE", permissions = {}) {
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "actor" } } });
  db.setTableResponse("profiles", { id: "actor", role, status, permissions });
}

beforeEach(() => {
  db = createMockSupabaseClient();
  audit = createMockSupabaseClient();
  vi.mocked(createClient).mockResolvedValue(db.client as never);
  vi.mocked(createAdminClient).mockReturnValue(audit.client as never);
  signIn("librarian");
});

describe("Analytics report builder data", () => {
  it("counts distinct visitors by Manila day, fills an empty day, and keeps identifying fields out", async () => {
    db.setTableResponse("attendance", [
      { id: "1", user_id: "one", check_in_at: created },
      { id: "2", user_id: "one", check_in_at: created },
      { id: "3", user_id: "two", check_in_at: created },
    ]);
    const section = { ...createReportSection("attendance", "a"), metric: "visitors" as const, group: "day" as const };
    const report = await buildReport(config(section));
    expect(report.sections[0].rows).toEqual([["2026-11-01", 2], ["2026-11-02", 0]]);
    expect(db.getTableBuilder("attendance").gte).toHaveBeenCalledWith("check_in_at", "2026-11-01T00:00:00+08:00");
    expect(db.getTableBuilder("attendance").lt).toHaveBeenCalledWith("check_in_at", "2026-11-03T00:00:00+08:00");
    expect(db.getTableBuilder("attendance").select.mock.calls[0][0]).not.toContain("full_name");
    expect(audit.from).not.toHaveBeenCalled();
  });

  it("uses the return date for return trends and keeps catalog stock outside the period", async () => {
    db.setTableResponse("borrowing_records", [{ id: "1", borrowed_at: "2026-10-01T00:00:00Z", returned_at: created }]);
    db.setTableResponse("books", [
      { id: "1", is_active: true, total_copies: 5, available_copies: 2, categories: { name: "Science" } },
      { id: "2", is_active: true, total_copies: 3, available_copies: 1, categories: { name: "Science" } },
    ]);
    const report = await buildReport(config(
      { ...createReportSection("borrowing", "b"), metric: "returns", group: "day" },
      { ...createReportSection("inventory", "i"), metric: "copies" },
    ));
    expect(report.sections[0].rows).toEqual([["2026-11-01", 1], ["2026-11-02", 0]]);
    expect(db.getTableBuilder("borrowing_records").gte).toHaveBeenCalledWith("returned_at", expect.any(String));
    expect(report.sections[1].rows).toEqual([["Science", 8]]);
    expect(report.sections[1].scope).toMatch(/^Stock as of/);
    expect(db.getTableBuilder("books").gte).not.toHaveBeenCalled();
  });

  it("paginates detail rows, previews a sample, and audits generation without names or filters", async () => {
    const first = createMockQueryBuilder(Array.from({ length: 500 }, (_, i) => ({
      id: String(i), is_active: true, title: `Book ${i}`, author: "A",
    })));
    const last = createMockQueryBuilder([{ id: "500", is_active: true, title: "=HYPERLINK()", author: "B" }]);
    for (const intent of ["preview", "csv"] as const) {
      db.from.mockImplementation((table: string) => table === "profiles" ? db.getTableBuilder(table) : last);
      db.from.mockImplementationOnce((table: string) => db.getTableBuilder(table)).mockReturnValueOnce(first);
      const request = config({ ...createReportSection("inventory", "i"), metric: "records", display: "table", columns: ["title"] });
      const report = await buildReport(request, intent);
      expect(report.sections[0].rowCount).toBe(501);
      expect(report.sections[0].rows).toHaveLength(intent === "preview" ? 8 : 501);
      expect(report.sections[0].headers).toEqual(["Title"]);
      if (intent === "csv") expect(reportCsv(report.sections[0])).toContain("'=HYPERLINK()");
    }
    expect(last.gt).toHaveBeenCalledWith("id", "499");
    expect(audit.getTableBuilder("audit_logs").insert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      admin_id: "actor", action: "report_generated", details: { format: "csv", datasets: ["inventory"] },
    }));
  });

  it("rejects invalid dates, disallowed fields, mixed CSV, and dataset escalation before fetching records", async () => {
    const section = createReportSection("attendance", "a");
    await expect(buildReport({ ...config(section), to: "2026-11-31" })).rejects.toThrow(/valid/i);
    await expect(buildReport(config({ ...section, metric: "records", columns: ["phone"] }))).rejects.toThrow(/valid/i);
    await expect(buildReport(config(section, createReportSection("users", "u")), "csv")).rejects.toThrow(/one section/i);
    signIn("library_staff", "ACTIVE", { manage_attendance: true });
    await expect(buildReport(config(section, createReportSection("users", "u")))).rejects.toThrow("Forbidden");
    expect(db.from.mock.calls.every(([table]) => table === "profiles")).toBe(true);
  });

  it("rejects library staff (even with delegated permissions), suspended staff and patrons", async () => {
    db.setTableResponse("attendance", []);
    const request = config(createReportSection("attendance", "a"));
    signIn("library_staff", "ACTIVE", { manage_attendance: true, manage_circulation: true });
    await expect(buildReport(request)).rejects.toThrow("Forbidden");
    signIn("library_staff", "SUSPENDED", { manage_attendance: true });
    await expect(buildReport(request)).rejects.toThrow("Forbidden");
    signIn("patron");
    await expect(buildReport(request)).rejects.toThrow("Forbidden");
    db.auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(buildReport(request)).rejects.toThrow("Unauthorized");
  });

  it("reuses directory visibility and reports fetch failures without exporting", async () => {
    const section = { ...createReportSection("users", "u"), metric: "records" as const, display: "table" as const, columns: ["full_name"] };
    const directory = createMockQueryBuilder([{ id: "one", full_name: "Staff member", created_at: created }]);
    db.from.mockImplementationOnce(() => db.getTableBuilder("profiles")).mockReturnValueOnce(directory);
    const report = await buildReport(config(section));
    expect(directory.neq).toHaveBeenCalledWith("role", "super_admin");
    expect(report.sections[0].rows).toEqual([["Staff member"]]);
    db.setTableResponse("attendance", null, { message: "backend unavailable" });
    await expect(requestReport(config(createReportSection("attendance", "a")), "excel")).resolves.toEqual({
      success: false, error: "Could not load Attendance. Try again.",
    });
    expect(audit.from).not.toHaveBeenCalled();
  });

  it("exports attendance status and only selected columns with the same scopes in a multi-section workbook", async () => {
    db.setTableResponse("attendance", [{
      id: "one", check_in_at: created, check_out_at: "2026-11-01T02:01:00Z", notes: "No Log Out",
      profiles: { full_name: "Example person", student_id: "12345" },
    }]);
    db.setTableResponse("books", [{ id: "stock", is_active: true, title: "=A1", total_copies: 5 }]);
    const report = await buildReport(config(
      { ...createReportSection("attendance", "a"), metric: "records", display: "table", filter: "No Log Out", columns: ["check_in_at", "status", "notes"] },
      { ...createReportSection("inventory", "i"), metric: "records", display: "table", columns: ["title", "total_copies"] },
    ), "excel");
    const file = buildReportWorkbook(xlsx, report);
    const workbook = xlsx.read(xlsx.write(file, { type: "array", bookType: "xlsx" }), { type: "array" });
    expect(workbook.SheetNames).toEqual(["1. Attendance records", "2. Book list"]);
    const attendance = workbook.Sheets["1. Attendance records"];
    expect(attendance.A2.v).toContain("2026-11-01 to 2026-11-02");
    expect(attendance.A2.v).toContain("Archived records excluded");
    expect(db.getTableBuilder("attendance").eq).toHaveBeenCalledWith("notes", "No Log Out");
    expect(xlsx.utils.sheet_to_json(attendance, { range: 3 })).toEqual([{
      "Check-in": "2026-11-01 00:01", Status: "No Log Out", Notes: "No Log Out",
    }]);
    expect(workbook.Sheets["2. Book list"].A5).toMatchObject({ t: "s", v: "=A1" });
    expect(workbook.Sheets["2. Book list"].B5).toMatchObject({ t: "n", v: 5 });
  });

  it("includes returned receivables in Overdue and applies the library fine rate", async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    db.setTableResponse("system_settings", { value: "7" });
    db.setTableResponse("borrowing_records", [
      { id: "1", status: "RETURNED", borrowed_at: now.toISOString(), returned_at: now.toISOString(), fine_amount: 35 },
      { id: "2", status: "ACTIVE", borrowed_at: now.toISOString(), due_date: new Date(now.getTime() - 1000).toISOString(), returned_at: null },
      { id: "3", status: "RETURNED", borrowed_at: now.toISOString(), returned_at: now.toISOString(), fine_amount: 15, fine_settled_at: now.toISOString() },
    ]);
    const section = { ...createReportSection("borrowing", "b"), metric: "records" as const, display: "table" as const, columns: ["status", "fine_amount"] };
    const report = await buildReport({ ...config({ ...section, filter: "OVERDUE" }, { ...section, id: "returned", filter: "RETURNED" }), from: today, to: today });
    expect(report.sections[0].rows).toEqual([["RETURNED", 35], ["OVERDUE", 7]]);
    expect(report.sections[1].rows).toEqual([["RETURNED", 15]]);
    expect(db.getTableBuilder("system_settings").eq).toHaveBeenCalledExactlyOnceWith("key", "overdue_fine_per_day");
  });
});
