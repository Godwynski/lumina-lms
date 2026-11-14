// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import {
  createMockQueryBuilder,
  createMockSupabaseClient,
  type MockSupabaseClientHelper,
} from "./mocks/supabase";

const {
  mockCreateClient,
  mockCreateAdminClient,
  mockRevalidatePath,
  mockRevalidateTag,
  mockAfter,
  mockConnection,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockAfter: vi.fn((cb: () => unknown) => Promise.resolve(cb())),
  mockConnection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
  revalidateTag: mockRevalidateTag,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    connection: mockConnection,
    after: mockAfter,
  };
});

import { POST as annualResetPost } from "@/app/api/admin/annual-reset/route";
import { GET as auditLogsGet } from "@/app/api/admin/audit-logs/route";
import { GET as auditLogsExportGet } from "@/app/api/admin/audit-logs/export/route";
import { POST as auditLogsImportPost } from "@/app/api/admin/audit-logs/import/route";
import {
  GET as categoriesGet,
  POST as categoriesPost,
} from "@/app/api/admin/categories/route";
import {
  GET as categoryByIdGet,
  PUT as categoryByIdPut,
  DELETE as categoryByIdDelete,
} from "@/app/api/admin/categories/[id]/route";
import {
  GET as policySettingsGet,
  POST as policySettingsPost,
} from "@/app/api/admin/policy-settings/route";

type AuthRole = "super_admin" | "librarian" | "student_assistant" | "student";

function setupAuth(
  supabase: MockSupabaseClientHelper,
  role: AuthRole | null,
  status = "ACTIVE",
  userId = "user-1"
) {
  if (!role) {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    return;
  }

  supabase.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: `${role}@alabang.sti.edu.ph`,
        app_metadata: { role },
        user_metadata: {},
      },
    },
    error: null,
  });

  supabase.setTableResponse("profiles", {
    id: userId,
    email: `${role}@alabang.sti.edu.ph`,
    full_name: `Test ${role}`,
    role,
    status,
    permissions: {
      manage_circulation: true,
      manage_attendance: true,
      view_admin_dashboard: true,
    },
  });
}

describe("Admin API Route Handlers", () => {
  let supabase: MockSupabaseClientHelper;
  let adminSupabase: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabaseClient();
    adminSupabase = createMockSupabaseClient();
    mockCreateClient.mockResolvedValue(supabase.client);
    mockCreateAdminClient.mockReturnValue(adminSupabase.client);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("POST /api/admin/annual-reset", () => {
    it("returns 401 when unauthenticated", async () => {
      setupAuth(supabase, null);
      const res = await annualResetPost(new Request("http://localhost/api/admin/annual-reset", { method: "POST" }));
      expect(res.status).toBe(401);
    });

    it.each<AuthRole>(["student", "student_assistant", "librarian"])(
      "returns 403 for non-super_admin role: %s",
      async (role) => {
        setupAuth(supabase, role);
        const res = await annualResetPost(new Request("http://localhost/api/admin/annual-reset", { method: "POST" }));
        expect(res.status).toBe(403);
      }
    );

    it("executes annual_student_reset RPC and logs audit activity for super_admin", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE", "admin-42");
      supabase.setRpcResponse(125, null, "annual_student_reset");

      const res = await annualResetPost(new Request("http://localhost/api/admin/annual-reset", { method: "POST" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith("annual_student_reset");
      expect(adminSupabase.from).toHaveBeenCalledWith("audit_logs");
      expect(adminSupabase.getTableBuilder("audit_logs").insert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: "admin-42",
          entity_type: "system",
          action: "annual_reset",
          details: expect.objectContaining({ affectedCount: 125, action: "SUSPENDED" }),
        })
      );
    });

    it("returns 500 when annual_student_reset RPC returns an error", async () => {
      setupAuth(supabase, "super_admin");
      supabase.setRpcResponse(null, { message: "Database timeout" }, "annual_student_reset");

      const res = await annualResetPost(new Request("http://localhost/api/admin/annual-reset", { method: "POST" }));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Database timeout");
    });
  });

  describe("GET /api/admin/audit-logs", () => {
    it("returns 401 when unauthenticated and 403 for student/SA", async () => {
      setupAuth(supabase, null);
      expect(
        (await auditLogsGet(new NextRequest("http://localhost/api/admin/audit-logs"))).status
      ).toBe(401);

      setupAuth(supabase, "student");
      expect(
        (await auditLogsGet(new NextRequest("http://localhost/api/admin/audit-logs"))).status
      ).toBe(403);

      setupAuth(supabase, "student_assistant");
      expect(
        (await auditLogsGet(new NextRequest("http://localhost/api/admin/audit-logs"))).status
      ).toBe(403);
    });

    it("returns paginated audit logs joined with admin profiles for librarian", async () => {
      setupAuth(supabase, "librarian", "ACTIVE", "lib-1");
      const logs = [
        { id: "log-1", admin_id: "admin-1", entity_type: "book", action: "created", created_at: "2026-01-01T10:00:00Z" },
        { id: "log-2", admin_id: null, entity_type: "system", action: "annual_reset", created_at: "2026-01-01T09:00:00Z" },
      ];
      supabase.setTableResponse("audit_log_records", logs, null, 2);

      const profilesLookupBuilder = createMockQueryBuilder([
        { id: "admin-1", full_name: "Alice Admin", email: "alice@alabang.sti.edu.ph", role: "super_admin" },
      ]);
      const getMeProfileBuilder = supabase.getTableBuilder("profiles");
      supabase.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          // 1st call is getMe(), subsequent call is manual profile join
          return supabase.from.mock.calls.filter((c) => c[0] === "profiles").length === 1
            ? getMeProfileBuilder
            : profilesLookupBuilder;
        }
        return supabase.getTableBuilder(table);
      });

      const res = await auditLogsGet(
        new NextRequest("http://localhost/api/admin/audit-logs?limit=10&offset=5")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.total).toBe(2);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(5);
      expect(body.logs[0].profiles).toEqual(
        expect.objectContaining({ full_name: "Alice Admin" })
      );
      expect(body.logs[1].profiles).toBeNull();
      expect(supabase.getTableBuilder("audit_log_records").range).toHaveBeenCalledWith(5, 14);
    });

    it("applies entityType, actionType, date range, subject/user UUIDs, and escaped search query filters", async () => {
      setupAuth(supabase, "super_admin");
      supabase.setTableResponse("audit_log_records", [], null, 0);

      const userId = "11111111-1111-4111-8111-111111111111";
      const bookId = "22222222-2222-4222-8222-222222222222";
      const studentId = "33333333-3333-4333-8333-333333333333";
      const copyId = "44444444-4444-4444-8444-444444444444";

      const res = await auditLogsGet(
        new NextRequest(
          `http://localhost/api/admin/audit-logs?entityType=policy&actionType=update&startDate=2026-01-01&endDate=2026-01-31&userId=${userId}&bookId=${bookId}&studentId=${studentId}&copyId=${copyId}&query=${encodeURIComponent("al(ice):_50%")}`
        )
      );

      expect(res.status).toBe(200);
      const auditBuilder = supabase.getTableBuilder("audit_log_records");
      expect(auditBuilder.in).toHaveBeenCalledWith("entity_type", [
        "policy",
        "settings",
        "system_settings",
      ]);
      expect(auditBuilder.or).toHaveBeenCalledWith(
        "action.ilike.update%,action.ilike.%updated"
      );
      expect(auditBuilder.gte).toHaveBeenCalledWith(
        "created_at",
        "2026-01-01T00:00:00+08:00"
      );
      expect(auditBuilder.lte).toHaveBeenCalledWith(
        "created_at",
        "2026-01-31T23:59:59.999+08:00"
      );
      expect(auditBuilder.eq).toHaveBeenCalledWith("subject_book_id", bookId);
      expect(auditBuilder.eq).toHaveBeenCalledWith("subject_student_id", studentId);
      expect(auditBuilder.eq).toHaveBeenCalledWith("subject_copy_id", copyId);
      expect(auditBuilder.eq).toHaveBeenCalledWith("admin_id", userId);

      const expectedPattern = JSON.stringify("%al(ice):\\_50\\%%");
      const expectedSearchOr = [
        "entity_type",
        "action",
        "reason",
        "actor_name",
        "actor_email",
        "book_title",
        "book_isbn",
        "copy_barcode",
        "copy_accession",
        "student_name",
        "student_number",
        "student_email",
      ]
        .map((field) => `${field}.ilike.${expectedPattern}`)
        .join(",");
      expect(auditBuilder.or).toHaveBeenCalledWith(expectedSearchOr);
    });

    it("returns 400 on invalid audit filter parameters", async () => {
      setupAuth(supabase, "super_admin");

      const badUuidRes = await auditLogsGet(
        new NextRequest("http://localhost/api/admin/audit-logs?userId=not-a-uuid")
      );
      expect(badUuidRes.status).toBe(400);
      expect(await badUuidRes.json()).toEqual({ error: "Invalid audit filters." });

      const badDatesRes = await auditLogsGet(
        new NextRequest("http://localhost/api/admin/audit-logs?startDate=2026-02-01&endDate=2026-01-01")
      );
      expect(badDatesRes.status).toBe(400);
    });

    it("returns 500 on database error and 499 on AbortError", async () => {
      setupAuth(supabase, "super_admin");
      supabase.setTableResponse("audit_log_records", null, { message: "Query failed" });

      const errRes = await auditLogsGet(
        new NextRequest("http://localhost/api/admin/audit-logs")
      );
      expect(errRes.status).toBe(500);

      const abortErr = new Error("Aborted");
      abortErr.name = "AbortError";
      supabase.setTableResponse("audit_log_records", null, abortErr);
      const abortRes = await auditLogsGet(
        new NextRequest("http://localhost/api/admin/audit-logs")
      );
      expect(abortRes.status).toBe(499);
    });
  });

  describe("GET /api/admin/audit-logs/export", () => {
    it("denies non-super_admin roles (401/403)", async () => {
      setupAuth(supabase, null);
      expect(
        (await auditLogsExportGet(new NextRequest("http://localhost/api/admin/audit-logs/export"))).status
      ).toBe(401);

      setupAuth(supabase, "librarian");
      expect(
        (await auditLogsExportGet(new NextRequest("http://localhost/api/admin/audit-logs/export"))).status
      ).toBe(403);
    });

    it("exports CSV with formula-injection neutralization, subject columns, and Manila timestamps", async () => {
      setupAuth(supabase, "super_admin");
      supabase.setTableResponse("audit_log_records", [
        {
          id: "l1",
          admin_id: "u1",
          created_at: "2026-03-01T00:00:00.000Z",
          entity_type: "book",
          action: "create",
          reason: "=CMD('calc'), \"quoted\"",
          book_title: "Clean Code",
          book_isbn: "9780132350884",
          copy_barcode: "BC-001",
          student_name: "Jane Doe",
          student_number: "2026-0001",
          old_value: null,
          new_value: { title: "Test" },
          details: null,
        },
      ]);

      const joinProfilesBuilder = createMockQueryBuilder([
        { id: "u1", full_name: "Super User", email: "admin@alabang.sti.edu.ph" },
      ]);
      const meProfileBuilder = supabase.getTableBuilder("profiles");
      supabase.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          return supabase.from.mock.calls.filter((c) => c[0] === "profiles").length === 1
            ? meProfileBuilder
            : joinProfilesBuilder;
        }
        return supabase.getTableBuilder(table);
      });

      const res = await auditLogsExportGet(
        new NextRequest("http://localhost/api/admin/audit-logs/export?format=csv")
      );
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("audit_logs_");
      expect(text).toContain("Timestamp,Admin Name,Email,Entity,Action,Reason");
      // 2026-03-01T00:00:00Z in Asia/Manila is 2026-03-01 08:00:00
      expect(text).toContain("2026-03-01 08:00:00");
      // Formula prefix '=' neutralized with leading single quote and CSV-escaped
      expect(text).toContain("\"'=CMD('calc'), \"\"quoted\"\"\"");

      const customColsRes = await auditLogsExportGet(
        new NextRequest(
          "http://localhost/api/admin/audit-logs/export?format=csv&columns=book_title,book_isbn,copy_barcode,student_name,student_number"
        )
      );
      const customColsText = await customColsRes.text();
      expect(customColsRes.status).toBe(200);
      expect(customColsText).toContain("Book,ISBN,Copy barcode,Student,Student ID");
      expect(customColsText).toContain("Clean Code,9780132350884,BC-001,Jane Doe,2026-0001");
    });

    it("exports JSON and XLSX formats", async () => {
      setupAuth(supabase, "super_admin");
      supabase.setTableResponse("audit_log_records", [
        {
          id: "l1",
          admin_id: "u1",
          created_at: "2026-03-01T00:00:00.000Z",
          entity_type: "policy",
          action: "update",
          reason: "Adjusted fine",
        },
      ]);

      const joinProfilesBuilder = createMockQueryBuilder([
        { id: "u1", full_name: "Super User", email: "admin@alabang.sti.edu.ph" },
      ]);
      const meProfileBuilder = supabase.getTableBuilder("profiles");
      supabase.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          const profileCalls = supabase.from.mock.calls.filter((c) => c[0] === "profiles").length;
          // 1st call: getMe() for JSON request; 2nd call: join for JSON; 3rd call: getMe() for XLSX; 4th: join for XLSX
          return profileCalls % 2 === 1 ? meProfileBuilder : joinProfilesBuilder;
        }
        return supabase.getTableBuilder(table);
      });

      const jsonRes = await auditLogsExportGet(
        new NextRequest(
          "http://localhost/api/admin/audit-logs/export?format=json&columns=entity_type,action,reason"
        )
      );
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.headers.get("Content-Type")).toBe("application/json");
      const jsonData = JSON.parse(await jsonRes.text());
      expect(jsonData).toEqual([
        { entity_type: "policy", action: "update", reason: "Adjusted fine" },
      ]);

      const xlsxRes = await auditLogsExportGet(
        new NextRequest("http://localhost/api/admin/audit-logs/export?format=xlsx")
      );
      expect(xlsxRes.status).toBe(200);
      expect(xlsxRes.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const buf = Buffer.from(await xlsxRes.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      expect(wb.SheetNames).toContain("Audit Logs");
    });

    it("returns 400 on invalid filters, 500 on query error, and 499 on AbortError", async () => {
      setupAuth(supabase, "super_admin");

      const badRes = await auditLogsExportGet(
        new NextRequest("http://localhost/api/admin/audit-logs/export?bookId=bad-id")
      );
      expect(badRes.status).toBe(400);

      supabase.setTableResponse("audit_log_records", null, { message: "Export query failed" });
      const res = await auditLogsExportGet(
        new NextRequest("http://localhost/api/admin/audit-logs/export")
      );
      expect(res.status).toBe(500);

      const abortErr = new Error("Aborted");
      abortErr.name = "AbortError";
      supabase.setTableResponse("audit_log_records", null, abortErr);
      const abortRes = await auditLogsExportGet(
        new NextRequest("http://localhost/api/admin/audit-logs/export")
      );
      expect(abortRes.status).toBe(499);
    });
  });

  describe("POST /api/admin/audit-logs/import", () => {
    it("denies unauthorized or non-super_admin requests", async () => {
      setupAuth(supabase, null);
      expect(
        (
          await auditLogsImportPost(
            new Request("http://localhost/api/admin/audit-logs/import", {
              method: "POST",
              body: JSON.stringify({ logs: [] }),
            })
          )
        ).status
      ).toBe(401);

      setupAuth(supabase, "librarian");
      expect(
        (
          await auditLogsImportPost(
            new Request("http://localhost/api/admin/audit-logs/import", {
              method: "POST",
              body: JSON.stringify({ logs: [{ entity_type: "book", action: "create" }] }),
            })
          )
        ).status
      ).toBe(403);
    });

    it("returns 400 for invalid JSON, empty logs array, or missing required fields", async () => {
      setupAuth(supabase, "super_admin");

      const badJson = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: "{not-json",
        })
      );
      expect(badJson.status).toBe(400);

      const emptyLogs = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({ logs: [] }),
        })
      );
      expect(emptyLogs.status).toBe(400);

      const missingField = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({ logs: [{ entity_type: "book" }] }),
        })
      );
      expect(missingField.status).toBe(400);
    });

    it("imports logs in batches, attributes admin_id to importer, parses dates, and logs summary", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE", "importer-1");
      adminSupabase.setTableResponse("audit_logs", [], null);

      const payloadLogs = Array.from({ length: 105 }, (_, i) => ({
        admin_id: `original-admin-${i}`,
        entity_type: "Book",
        action: "CREATE",
        created_at: i === 0 ? 46161.5 : i === 1 ? 1779321600 : "2026-02-01T00:00:00Z",
        details: { row: i },
      }));

      const res = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({ logs: payloadLogs }),
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ success: true, count: 105 });
      const insertCalls = adminSupabase.getTableBuilder("audit_logs").insert.mock.calls;
      // 2 batches (100 + 5) + 1 audit summary insert
      expect(insertCalls).toHaveLength(3);
      expect(insertCalls[0][0]).toHaveLength(100);
      expect(insertCalls[1][0]).toHaveLength(5);
      expect(insertCalls[0][0][0]).toMatchObject({
        admin_id: "importer-1",
        entity_type: "book",
        action: "create",
        details: { row: 0, imported: true, original_admin_id: "original-admin-0" },
      });
    });

    it("returns 500 when batch insert fails", async () => {
      setupAuth(supabase, "super_admin");
      adminSupabase.setTableResponse("audit_logs", null, { message: "Insert constraint error" });

      const res = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({
            logs: [{ entity_type: "book", action: "create" }],
          }),
        })
      );
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toContain("Insert constraint error");
    });
  });

  describe("/api/admin/categories and /api/admin/categories/[id]", () => {
    it("enforces role permissions on GET, POST, PUT, DELETE", async () => {
      setupAuth(supabase, "student");
      expect((await categoriesGet(new Request("http://localhost/api/admin/categories"))).status).toBe(403);
      expect(
        (
          await categoriesPost(
            new Request("http://localhost/api/admin/categories", {
              method: "POST",
              body: JSON.stringify({ name: "Fiction" }),
            })
          )
        ).status
      ).toBe(403);

      // Librarians can GET/POST/PUT, but only super_admin can DELETE
      setupAuth(supabase, "librarian");
      const delRes = await categoryByIdDelete(
        new Request("http://localhost/api/admin/categories/cat-1", { method: "DELETE" }),
        { params: Promise.resolve({ id: "cat-1" }) }
      );
      expect(delRes.status).toBe(403);
    });

    it("GET /categories returns list and handles 500 error", async () => {
      setupAuth(supabase, "librarian");
      supabase.setTableResponse("categories", [{ id: "c1", name: "Fiction", slug: "fiction" }]);

      const okRes = await categoriesGet(new Request("http://localhost/api/admin/categories"));
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual([{ id: "c1", name: "Fiction", slug: "fiction" }]);

      supabase.setTableResponse("categories", null, { message: "DB error" });
      const errRes = await categoriesGet(new Request("http://localhost/api/admin/categories"));
      expect(errRes.status).toBe(500);
    });

    it("POST /categories validates body, creates category with slug, and revalidates cache", async () => {
      setupAuth(supabase, "librarian", "ACTIVE", "lib-5");

      const badJson = await categoriesPost(
        new Request("http://localhost/api/admin/categories", {
          method: "POST",
          body: "bad",
        })
      );
      expect(badJson.status).toBe(400);

      const invalid = await categoriesPost(
        new Request("http://localhost/api/admin/categories", {
          method: "POST",
          body: JSON.stringify({ name: "   " }),
        })
      );
      expect(invalid.status).toBe(400);

      const created = {
        id: "cat-99",
        name: "Computer Science",
        slug: "computer-science",
        description: "CS books",
        is_active: true,
      };
      supabase.setTableResponse("categories", created);

      const okRes = await categoriesPost(
        new Request("http://localhost/api/admin/categories", {
          method: "POST",
          body: JSON.stringify({ name: "Computer Science", description: "CS books" }),
        })
      );
      expect(okRes.status).toBe(201);
      expect(await okRes.json()).toEqual(created);
      expect(supabase.getTableBuilder("categories").insert).toHaveBeenCalledWith([
        { name: "Computer Science", slug: "computer-science", description: "CS books", is_active: true },
      ]);
      expect(mockRevalidateTag).toHaveBeenCalledWith("categories", "default");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/catalog", "page");
    });

    it("GET/PUT/DELETE /categories/[id] handles 200, 400, 404, and 500", async () => {
      setupAuth(supabase, "super_admin");
      const params = Promise.resolve({ id: "cat-1" });

      supabase.setTableResponse("categories", null, null);
      expect(
        (await categoryByIdGet(new Request("http://localhost/api/admin/categories/cat-1"), { params })).status
      ).toBe(404);

      supabase.setTableResponse("categories", { id: "cat-1", name: "Math", slug: "math", is_active: true });
      const getOk = await categoryByIdGet(new Request("http://localhost/api/admin/categories/cat-1"), { params });
      expect(getOk.status).toBe(200);

      // PUT validation error
      const badPut = await categoryByIdPut(
        new Request("http://localhost/api/admin/categories/cat-1", {
          method: "PUT",
          body: JSON.stringify({ name: "" }),
        }),
        { params }
      );
      expect(badPut.status).toBe(400);

      // PUT not found
      supabase.setTableResponse("categories", null, null);
      const notFoundPut = await categoryByIdPut(
        new Request("http://localhost/api/admin/categories/cat-1", {
          method: "PUT",
          body: JSON.stringify({ name: "Physics" }),
        }),
        { params }
      );
      expect(notFoundPut.status).toBe(404);

      // PUT empty resulting slug
      supabase.setTableResponse("categories", { id: "cat-1", name: "Math", slug: "math", is_active: true });
      const badSlugPut = await categoryByIdPut(
        new Request("http://localhost/api/admin/categories/cat-1", {
          method: "PUT",
          body: JSON.stringify({ name: "!!!", slug: "!!!" }),
        }),
        { params }
      );
      expect(badSlugPut.status).toBe(400);

      // PUT happy path
      const existingCat = { id: "cat-1", name: "Math", slug: "math", description: null, is_active: true };
      const updatedCat = { id: "cat-1", name: "Applied Math", slug: "applied-math", description: null, is_active: true };
      const catBuilder = supabase.getTableBuilder("categories");
      catBuilder.single
        .mockResolvedValueOnce({ data: existingCat, error: null })
        .mockResolvedValueOnce({ data: updatedCat, error: null });

      const okPut = await categoryByIdPut(
        new Request("http://localhost/api/admin/categories/cat-1", {
          method: "PUT",
          body: JSON.stringify({ name: "Applied Math", slug: "Applied Math" }),
        }),
        { params }
      );
      expect(okPut.status).toBe(200);
      expect(await okPut.json()).toEqual(updatedCat);

      // DELETE happy path + DB error
      supabase.setTableResponse("categories", null, null);
      const okDel = await categoryByIdDelete(
        new Request("http://localhost/api/admin/categories/cat-1", { method: "DELETE" }),
        { params }
      );
      expect(okDel.status).toBe(200);
      expect(await okDel.json()).toEqual({ success: true });

      supabase.setTableResponse("categories", null, { message: "Delete failed" });
      const errDel = await categoryByIdDelete(
        new Request("http://localhost/api/admin/categories/cat-1", { method: "DELETE" }),
        { params }
      );
      expect(errDel.status).toBe(500);
    });
  });

  describe("/api/admin/policy-settings", () => {
    it("enforces auth and role checks", async () => {
      setupAuth(supabase, null);
      expect(
        (await policySettingsGet(new Request("http://localhost/api/admin/policy-settings"))).status
      ).toBe(401);

      setupAuth(supabase, "student_assistant");
      expect(
        (await policySettingsGet(new Request("http://localhost/api/admin/policy-settings"))).status
      ).toBe(403);
      expect(
        (
          await policySettingsPost(
            new Request("http://localhost/api/admin/policy-settings", {
              method: "POST",
              body: JSON.stringify({ key: "overdue_fine_per_day", value: "10" }),
            })
          )
        ).status
      ).toBe(403);
    });

    it("GET returns settings and propagates DB errors as 400", async () => {
      setupAuth(supabase, "librarian");
      supabase.setTableResponse("system_settings", [
        { id: "s1", key: "overdue_fine_per_day", value: "5" },
      ]);
      const okRes = await policySettingsGet(new Request("http://localhost/api/admin/policy-settings"));
      expect(okRes.status).toBe(200);
      const okBody = await okRes.json();
      expect(okBody.ok).toBe(true);
      expect(okBody[0]).toEqual({ id: "s1", key: "overdue_fine_per_day", value: "5" });

      supabase.setTableResponse("system_settings", null, { message: "Query error" });
      const errRes = await policySettingsGet(new Request("http://localhost/api/admin/policy-settings"));
      expect(errRes.status).toBe(400);
    });

    it("POST validates JSON, required fields, unknown keys, and numeric bounds including overdue_fine_per_day", async () => {
      setupAuth(supabase, "super_admin");

      const badJson = await policySettingsPost(
        new Request("http://localhost/api/admin/policy-settings", {
          method: "POST",
          body: "{",
        })
      );
      expect(badJson.status).toBe(400);

      const missing = await policySettingsPost(
        new Request("http://localhost/api/admin/policy-settings", {
          method: "POST",
          body: JSON.stringify({ key: "overdue_fine_per_day" }),
        })
      );
      expect(missing.status).toBe(400);

      for (const [key, value] of [
        ["unknown_policy_key", "10"],
        ["overdue_fine_per_day", "-1"],
        ["overdue_fine_per_day", "5.5"],
        ["overdue_fine_per_day", "501"],
        ["overdue_fine_per_day", "abc"],
        ["loan_period_days", "0"],
        ["loan_period_days", "91"],
        ["max_borrow_limit", "25"],
        ["student_faq_list", "not-json"],
      ]) {
        const res = await policySettingsPost(
          new Request("http://localhost/api/admin/policy-settings", {
            method: "POST",
            body: JSON.stringify({ key, value }),
          })
        );
        expect(res.status, `Expected 400 for ${key}=${value}`).toBe(400);
      }
    });

    it("POST updates existing overdue_fine_per_day and inserts new policy keys with audit & revalidation", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE", "admin-1");
      const settingsBuilder = adminSupabase.getTableBuilder("system_settings");

      // Update existing overdue_fine_per_day
      settingsBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: "set-1", key: "overdue_fine_per_day", value: "5" },
        error: null,
      });
      settingsBuilder.single.mockResolvedValueOnce({
        data: { id: "set-1", key: "overdue_fine_per_day", value: "15" },
        error: null,
      });

      const updateRes = await policySettingsPost(
        new Request("http://localhost/api/admin/policy-settings", {
          method: "POST",
          body: JSON.stringify({ key: "overdue_fine_per_day", value: "15" }),
        })
      );
      const updateBody = await updateRes.json();
      expect(updateRes.status).toBe(200);
      expect(updateBody.ok).toBe(true);
      expect(updateBody.value).toBe("15");
      expect(settingsBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ value: "15", updated_by: "admin-1" })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/policies", "page");

      // Insert new policy (academic_programs JSON array) when none exists
      settingsBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      settingsBuilder.single.mockResolvedValueOnce({
        data: {
          id: "set-2",
          key: "academic_programs",
          value: JSON.stringify(["BSCS", "BSIT"]),
        },
        error: null,
      });

      const insertRes = await policySettingsPost(
        new Request("http://localhost/api/admin/policy-settings", {
          method: "POST",
          body: JSON.stringify({
            key: "academic_programs",
            value: JSON.stringify(["BSCS", "BSIT"]),
          }),
        })
      );
      expect(insertRes.status).toBe(200);
      expect(settingsBuilder.insert).toHaveBeenCalled();
      expect(adminSupabase.getTableBuilder("audit_logs").insert).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: "policy",
          action: "Updated policy: academic_programs",
          reason: "Updated academic_programs to a list of 2 items",
        })
      );
    });

    it("POST returns 500 when admin DB mutation fails", async () => {
      setupAuth(supabase, "super_admin");
      const settingsBuilder = adminSupabase.getTableBuilder("system_settings");
      settingsBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      settingsBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Write failed" },
      });

      const res = await policySettingsPost(
        new Request("http://localhost/api/admin/policy-settings", {
          method: "POST",
          body: JSON.stringify({ key: "overdue_fine_per_day", value: "0" }),
        })
      );
      expect(res.status).toBe(500);
    });
  });
});
