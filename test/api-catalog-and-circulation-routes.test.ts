// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
  createMockSupabaseClient,
  type MockSupabaseClientHelper,
} from "./mocks/supabase";

const {
  mockCreateClient,
  mockCreateAdminClient,
  mockFetchImage,
  mockRunMaintenanceTasks,
  mockSendBulkNotifications,
  mockSendNotification,
  mockSendOverdueEmail,
  mockSendDueSoonEmail,
  mockSendTestEmail,
  mockRevalidatePath,
  mockRevalidateTag,
  mockAfter,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockFetchImage: vi.fn(),
  mockRunMaintenanceTasks: vi.fn(),
  mockSendBulkNotifications: vi.fn(),
  mockSendNotification: vi.fn(),
  mockSendOverdueEmail: vi.fn(),
  mockSendDueSoonEmail: vi.fn(),
  mockSendTestEmail: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockAfter: vi.fn((cb: () => unknown) => Promise.resolve(cb())),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/fetch-image", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fetch-image")>("@/lib/fetch-image");
  return {
    ...actual,
    fetchImage: mockFetchImage,
  };
});

vi.mock("@/lib/notifications", () => ({
  runMaintenanceTasks: mockRunMaintenanceTasks,
  sendBulkNotifications: mockSendBulkNotifications,
  sendNotification: mockSendNotification,
}));

vi.mock("@/lib/mail", () => ({
  sendOverdueEmail: mockSendOverdueEmail,
  sendDueSoonEmail: mockSendDueSoonEmail,
  sendTestEmail: mockSendTestEmail,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
  revalidateTag: mockRevalidateTag,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: mockAfter,
  };
});

import { GET as exportCoversGet } from "@/app/api/catalog/export/covers/route";
import {
  GET as reservationsGet,
  POST as reservationsPost,
} from "@/app/api/circulation/reservations/route";
import { GET as cronGet } from "@/app/api/cron/route";
import { POST as bulkNotificationsPost } from "@/app/api/notifications/bulk/route";
import { POST as maintenanceNotificationsPost } from "@/app/api/notifications/maintenance/route";
import { POST as testEmailPost } from "@/app/api/test-email/route";

type AuthRole = "super_admin" | "librarian" | "student_assistant" | "student";

const VALID_BOOK_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_USER_UUID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_UUID = "33333333-3333-4333-8333-333333333333";

function setupAuth(
  supabase: MockSupabaseClientHelper,
  role: AuthRole | null,
  status = "ACTIVE",
  userId = VALID_USER_UUID,
  email: string | null = "user@alabang.sti.edu.ph"
) {
  if (!role) {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    return;
  }

  supabase.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: email ?? undefined,
        app_metadata: { role },
        user_metadata: {},
      },
    },
    error: null,
  });

  supabase.setTableResponse("profiles", {
    id: userId,
    email,
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

describe("Catalog, Circulation, Notifications & Cron API Routes", () => {
  let supabase: MockSupabaseClientHelper;
  let adminSupabase: MockSupabaseClientHelper;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabaseClient();
    adminSupabase = createMockSupabaseClient();
    mockCreateClient.mockResolvedValue(supabase.client);
    mockCreateAdminClient.mockReturnValue(adminSupabase.client);
    mockSendNotification.mockResolvedValue({ success: true });
    mockSendBulkNotifications.mockResolvedValue({ success: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  describe("GET /api/catalog/export/covers", () => {
    it("denies unauthenticated, student, and disabled student_assistant requests", async () => {
      setupAuth(supabase, null);
      expect((await exportCoversGet(new Request("http://localhost/api/catalog/export/covers"))).status).toBe(401);

      setupAuth(supabase, "student");
      expect((await exportCoversGet(new Request("http://localhost/api/catalog/export/covers"))).status).toBe(403);

      setupAuth(supabase, "student_assistant", "SUSPENDED");
      expect((await exportCoversGet(new Request("http://localhost/api/catalog/export/covers"))).status).toBe(403);
    });

    it("exports downloaded covers into a real ZIP archive and tolerates individual download failures", async () => {
      setupAuth(supabase, "student_assistant", "ACTIVE");
      supabase.setTableResponse("books", [
        { title: "Clean Code", isbn: "9780132350884", cover_url: "https://cdn.example.com/1.png" },
        { title: "The Pragmatic Programmer!", isbn: null, cover_url: "https://cdn.example.com/2.jpg" },
        { title: "Broken Cover", isbn: "111", cover_url: "https://cdn.example.com/3.webp" },
        { title: "Relative Path", isbn: "222", cover_url: "/local/cover.png" },
      ]);

      mockFetchImage
        .mockResolvedValueOnce({ buffer: Buffer.from("png-bytes"), contentType: "image/png" })
        .mockResolvedValueOnce({ buffer: Buffer.from("jpg-bytes"), contentType: "image/jpeg" })
        .mockRejectedValueOnce(new Error("404 Not Found"));

      const res = await exportCoversGet(new Request("http://localhost/api/catalog/export/covers"));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/zip");
      expect(res.headers.get("Content-Disposition")).toContain("lumina_book_covers.zip");

      const zipData = await JSZip.loadAsync(await res.arrayBuffer());
      const entries = Object.keys(zipData.files).filter((k) => !zipData.files[k].dir);
      expect(entries).toEqual([
        "book-covers/9780132350884-1.png",
        "book-covers/the-pragmatic-programmer--2.jpg",
      ]);
      expect(await zipData.file("book-covers/9780132350884-1.png")?.async("string")).toBe("png-bytes");
    });

    it("returns 404 when no HTTP book covers exist and 500 on database error", async () => {
      setupAuth(supabase, "librarian");
      supabase.setTableResponse("books", [{ title: "Local", isbn: "1", cover_url: "/img.png" }]);
      expect((await exportCoversGet(new Request("http://localhost/api/catalog/export/covers"))).status).toBe(404);

      supabase.setTableResponse("books", null, { message: "DB failed" });
      const errRes = await exportCoversGet(new Request("http://localhost/api/catalog/export/covers"));
      expect(errRes.status).toBe(500);
      expect((await errRes.json()).error).toContain("DB failed");
    });
  });

  describe("POST & GET /api/circulation/reservations", () => {
    it("returns 401 when unauthenticated and 403 when user is archived", async () => {
      setupAuth(supabase, null);
      expect(
        (
          await reservationsPost(
            new Request("http://localhost/api/circulation/reservations", {
              method: "POST",
              body: JSON.stringify({ bookId: VALID_BOOK_UUID }),
            })
          )
        ).status
      ).toBe(401);

      setupAuth(supabase, "student", "ARCHIVED");
      expect(
        (
          await reservationsGet(
            new Request("http://localhost/api/circulation/reservations")
          )
        ).status
      ).toBe(403);
    });

    it("returns 400 on malformed JSON or invalid UUIDs", async () => {
      setupAuth(supabase, "student");

      const badJson = await reservationsPost(
        new Request("http://localhost/api/circulation/reservations", {
          method: "POST",
          body: "{invalid",
        })
      );
      expect(badJson.status).toBe(400);

      const badUuid = await reservationsPost(
        new Request("http://localhost/api/circulation/reservations", {
          method: "POST",
          body: JSON.stringify({ bookId: "not-a-uuid" }),
        })
      );
      expect(badUuid.status).toBe(400);
    });

    it("forbids students from reserving on behalf of another user, but allows staff", async () => {
      setupAuth(supabase, "student", "ACTIVE", VALID_USER_UUID);
      const denied = await reservationsPost(
        new Request("http://localhost/api/circulation/reservations", {
          method: "POST",
          body: JSON.stringify({ bookId: VALID_BOOK_UUID, userId: OTHER_USER_UUID }),
        })
      );
      expect(denied.status).toBe(403);

      setupAuth(supabase, "student_assistant", "ACTIVE", VALID_USER_UUID);
      supabase.setRpcResponse(
        { ok: true, reservation_id: "res-1", status: "ACTIVE", queue_position: 2 },
        null,
        "create_reservation_atomic"
      );

      const allowed = await reservationsPost(
        new Request("http://localhost/api/circulation/reservations", {
          method: "POST",
          body: JSON.stringify({ bookId: VALID_BOOK_UUID, userId: OTHER_USER_UUID }),
        })
      );
      expect(allowed.status).toBe(200);
      expect(supabase.rpc).toHaveBeenCalledWith("create_reservation_atomic", {
        p_actor_id: VALID_USER_UUID,
        p_book_id: VALID_BOOK_UUID,
        p_target_user_id: OTHER_USER_UUID,
      });
      expect(mockRevalidateTag).toHaveBeenCalledWith("public-books", "max");
      expect(mockRevalidateTag).toHaveBeenCalledWith(`book-${VALID_BOOK_UUID}`, "max");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/student-catalog", "page");
    });

    it.each([
      ["BOOK_NOT_FOUND", 404],
      ["TARGET_USER_NOT_FOUND", 404],
      ["DUPLICATE", 409],
      ["DUPLICATE_ACTIVE_RESERVATION", 409],
      ["RESERVATION_LIMIT", 409],
      ["ACCOUNT_INACTIVE", 403],
      ["UNAUTHORIZED", 401],
      ["UNKNOWN_CODE", 400],
    ])("maps RPC domain error code %s to HTTP %i", async (code, expectedStatus) => {
      setupAuth(supabase, "student");
      supabase.setRpcResponse(
        { ok: false, code, message: `Error ${code}` },
        null,
        "create_reservation_atomic"
      );

      const res = await reservationsPost(
        new Request("http://localhost/api/circulation/reservations", {
          method: "POST",
          body: JSON.stringify({ bookId: VALID_BOOK_UUID }),
        })
      );
      expect(res.status).toBe(expectedStatus);
      expect(await res.json()).toEqual({
        ok: false,
        message: `Error ${code}`,
        code,
      });
    });

    it("returns 500 when reservation RPC fails at database level", async () => {
      setupAuth(supabase, "student");
      supabase.setRpcResponse(null, new Error("Connection lost"), "create_reservation_atomic");

      const res = await reservationsPost(
        new Request("http://localhost/api/circulation/reservations", {
          method: "POST",
          body: JSON.stringify({ bookId: VALID_BOOK_UUID }),
        })
      );
      expect(res.status).toBe(500);
    });

    it("GET enforces self-scoping for students, allows staff queries, and handles errors", async () => {
      setupAuth(supabase, "student", "ACTIVE", VALID_USER_UUID);
      const forbiddenRes = await reservationsGet(
        new Request(`http://localhost/api/circulation/reservations?userId=${OTHER_USER_UUID}`)
      );
      expect(forbiddenRes.status).toBe(403);

      supabase.setTableResponse("reservations", [{ id: "r1", status: "ACTIVE" }]);
      const selfRes = await reservationsGet(
        new Request(`http://localhost/api/circulation/reservations?bookId=${VALID_BOOK_UUID}`)
      );
      expect(selfRes.status).toBe(200);
      expect(await selfRes.json()).toEqual([{ id: "r1", status: "ACTIVE" }]);
      expect(supabase.getTableBuilder("reservations").eq).toHaveBeenCalledWith(
        "user_id",
        VALID_USER_UUID
      );

      setupAuth(supabase, "librarian", "ACTIVE", VALID_USER_UUID);
      supabase.setTableResponse("reservations", null, { message: "Query error" });
      const errRes = await reservationsGet(
        new Request(`http://localhost/api/circulation/reservations?userId=${OTHER_USER_UUID}`)
      );
      expect(errRes.status).toBe(500);
    });
  });

  describe("GET /api/cron", () => {
    it("returns 500 when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;
      const res = await cronGet(
        new Request("http://localhost/api/cron", {
          headers: { authorization: "Bearer anything" },
        })
      );
      expect(res.status).toBe(500);
      expect(mockRunMaintenanceTasks).not.toHaveBeenCalled();
    });

    it("rejects missing or wrong Bearer token with 401", async () => {
      process.env.CRON_SECRET = "super-secret-cron-token";

      const noHeader = await cronGet(new Request("http://localhost/api/cron"));
      expect(noHeader.status).toBe(401);

      const wrongToken = await cronGet(
        new Request("http://localhost/api/cron", {
          headers: { authorization: "Bearer wrong-token" },
        })
      );
      expect(wrongToken.status).toBe(401);
      expect(mockRunMaintenanceTasks).not.toHaveBeenCalled();
    });

    it("runs maintenance tasks when CRON_SECRET matches and returns 500 if tasks throw", async () => {
      process.env.CRON_SECRET = "super-secret-cron-token";
      const results = { remindersSent: 3, overdueTagged: 2, reservationsExpired: 1, errors: [] };
      mockRunMaintenanceTasks.mockResolvedValueOnce(results);

      const okRes = await cronGet(
        new Request("http://localhost/api/cron", {
          headers: { authorization: "Bearer super-secret-cron-token" },
        })
      );
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({ success: true, results });

      mockRunMaintenanceTasks.mockRejectedValueOnce(new Error("Maintenance crashed"));
      const errRes = await cronGet(
        new Request("http://localhost/api/cron", {
          headers: { authorization: "Bearer super-secret-cron-token" },
        })
      );
      expect(errRes.status).toBe(500);
    });
  });

  describe("POST /api/notifications/bulk", () => {
    it("enforces role permissions and validates payload", async () => {
      setupAuth(supabase, null);
      expect(
        (
          await bulkNotificationsPost(
            new Request("http://localhost/api/notifications/bulk", {
              method: "POST",
              body: JSON.stringify({ target: "all", title: "Hi", content: "Test" }),
            })
          )
        ).status
      ).toBe(401);

      setupAuth(supabase, "student_assistant");
      expect(
        (
          await bulkNotificationsPost(
            new Request("http://localhost/api/notifications/bulk", {
              method: "POST",
              body: JSON.stringify({ target: "all", title: "Hi", content: "Test" }),
            })
          )
        ).status
      ).toBe(403);

      setupAuth(supabase, "librarian");
      expect(
        (
          await bulkNotificationsPost(
            new Request("http://localhost/api/notifications/bulk", {
              method: "POST",
              body: "{bad-json",
            })
          )
        ).status
      ).toBe(400);

      expect(
        (
          await bulkNotificationsPost(
            new Request("http://localhost/api/notifications/bulk", {
              method: "POST",
              body: JSON.stringify({ title: "Missing audience", content: "Body" }),
            })
          )
        ).status
      ).toBe(400);
    });

    it("broadcasts via RPC for target='all' and target='students' without duplicate sender copy", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE", VALID_USER_UUID);
      supabase.setRpcResponse(42, null, "send_bulk_notifications_by_target");

      const allRes = await bulkNotificationsPost(
        new Request("http://localhost/api/notifications/bulk", {
          method: "POST",
          body: JSON.stringify({ target: "all", title: "Holiday", content: "Library closed" }),
        })
      );
      expect(allRes.status).toBe(200);
      expect(await allRes.json()).toEqual({ success: true, count: 42 });
      expect(supabase.rpc).toHaveBeenCalledWith("send_bulk_notifications_by_target", {
        p_target: "all",
        p_title: "Holiday",
        p_content: "Library closed",
        p_type: "SYSTEM",
        p_priority: "high",
        p_metadata: {},
      });
      expect(mockSendNotification).not.toHaveBeenCalled();

      supabase.setRpcResponse(30, null, "send_bulk_notifications_by_target");
      const studentsRes = await bulkNotificationsPost(
        new Request("http://localhost/api/notifications/bulk", {
          method: "POST",
          body: JSON.stringify({ target: "students", title: "Exam Week", content: "Extended hours" }),
        })
      );
      expect(studentsRes.status).toBe(200);
      expect(await studentsRes.json()).toEqual({ success: true, count: 30 });
      expect(supabase.rpc).toHaveBeenCalledWith("send_bulk_notifications_by_target", {
        p_target: "students",
        p_title: "Exam Week",
        p_content: "Extended hours",
        p_type: "SYSTEM",
        p_priority: "high",
        p_metadata: {},
      });
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("handles zero RPC recipients (400), RPC errors (500), and explicit userIds bulk send", async () => {
      setupAuth(supabase, "librarian", "ACTIVE", VALID_USER_UUID);

      supabase.setRpcResponse(0, null, "send_bulk_notifications_by_target");
      const emptyTargetRes = await bulkNotificationsPost(
        new Request("http://localhost/api/notifications/bulk", {
          method: "POST",
          body: JSON.stringify({ target: "students", title: "Hi", content: "There" }),
        })
      );
      expect(emptyTargetRes.status).toBe(400);

      supabase.setRpcResponse(null, { message: "RPC failure" }, "send_bulk_notifications_by_target");
      const rpcErrRes = await bulkNotificationsPost(
        new Request("http://localhost/api/notifications/bulk", {
          method: "POST",
          body: JSON.stringify({ target: "all", title: "Hi", content: "There" }),
        })
      );
      expect(rpcErrRes.status).toBe(500);

      const userIdsRes = await bulkNotificationsPost(
        new Request("http://localhost/api/notifications/bulk", {
          method: "POST",
          body: JSON.stringify({
            userIds: [OTHER_USER_UUID],
            title: "Direct Notice",
            content: "Please return book",
          }),
        })
      );
      expect(userIdsRes.status).toBe(200);
      expect(await userIdsRes.json()).toEqual({ success: true, count: 1 });
      expect(mockSendBulkNotifications).toHaveBeenCalledWith(
        [OTHER_USER_UUID],
        expect.objectContaining({ title: "Direct Notice" })
      );
      expect(mockSendNotification).not.toHaveBeenCalled();

      mockSendBulkNotifications.mockResolvedValueOnce({ success: false, error: "Insert failed" });
      const failSendRes = await bulkNotificationsPost(
        new Request("http://localhost/api/notifications/bulk", {
          method: "POST",
          body: JSON.stringify({
            userIds: [OTHER_USER_UUID],
            title: "Direct Notice",
            content: "Fail test",
          }),
        })
      );
      expect(failSendRes.status).toBe(500);
    });
  });

  describe("POST /api/notifications/maintenance", () => {
    it("enforces roles, executes maintenance tasks, and handles errors", async () => {
      setupAuth(supabase, null);
      expect((await maintenanceNotificationsPost(new Request("http://localhost/api/notifications/maintenance", { method: "POST" }))).status).toBe(401);

      setupAuth(supabase, "student_assistant");
      expect((await maintenanceNotificationsPost(new Request("http://localhost/api/notifications/maintenance", { method: "POST" }))).status).toBe(403);

      setupAuth(supabase, "librarian");
      const summary = { remindersSent: 1, overdueTagged: 4, reservationsExpired: 2, errors: [] };
      mockRunMaintenanceTasks.mockResolvedValueOnce(summary);
      const okRes = await maintenanceNotificationsPost(
        new Request("http://localhost/api/notifications/maintenance", { method: "POST" })
      );
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual(summary);

      mockRunMaintenanceTasks.mockRejectedValueOnce(new Error("Maintenance DB error"));
      const errRes = await maintenanceNotificationsPost(
        new Request("http://localhost/api/notifications/maintenance", { method: "POST" })
      );
      expect(errRes.status).toBe(500);
      expect(await errRes.json()).toEqual({ error: "Maintenance DB error" });
    });
  });

  describe("POST /api/test-email", () => {
    it("enforces role checks and validates recipient email", async () => {
      setupAuth(supabase, null);
      expect(
        (
          await testEmailPost(
            new Request("http://localhost/api/test-email", { method: "POST", body: "{}" })
          )
        ).status
      ).toBe(401);

      setupAuth(supabase, "student");
      expect(
        (
          await testEmailPost(
            new Request("http://localhost/api/test-email", { method: "POST", body: "{}" })
          )
        ).status
      ).toBe(403);

      setupAuth(supabase, "super_admin", "ACTIVE", VALID_USER_UUID, null);
      const noEmail = await testEmailPost(
        new Request("http://localhost/api/test-email", { method: "POST", body: "{}" })
      );
      expect(noEmail.status).toBe(400);

      const badEmail = await testEmailPost(
        new Request("http://localhost/api/test-email", {
          method: "POST",
          body: JSON.stringify({ email: "not-an-email" }),
        })
      );
      expect(badEmail.status).toBe(400);
    });

    it("sends overdue, due_soon, and test emails and maps SMTP errors cleanly", async () => {
      setupAuth(supabase, "librarian", "ACTIVE", VALID_USER_UUID, "lib@alabang.sti.edu.ph");
      mockSendOverdueEmail.mockResolvedValueOnce({ success: true, messageId: "msg-1" });
      mockSendDueSoonEmail.mockResolvedValueOnce({ success: true, messageId: "msg-2" });
      mockSendTestEmail.mockResolvedValueOnce({ success: true, messageId: "msg-3" });

      const overdueRes = await testEmailPost(
        new Request("http://localhost/api/test-email", {
          method: "POST",
          body: JSON.stringify({ type: "overdue" }),
        })
      );
      expect(overdueRes.status).toBe(200);
      expect(await overdueRes.json()).toMatchObject({ success: true, messageId: "msg-1" });

      const dueSoonRes = await testEmailPost(
        new Request("http://localhost/api/test-email", {
          method: "POST",
          body: JSON.stringify({ type: "due_soon", email: "custom@alabang.sti.edu.ph" }),
        })
      );
      expect(dueSoonRes.status).toBe(200);
      expect(mockSendDueSoonEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "custom@alabang.sti.edu.ph" })
      );

      const testTypeRes = await testEmailPost(
        new Request("http://localhost/api/test-email", {
          method: "POST",
          body: JSON.stringify({ type: "test" }),
        })
      );
      expect(testTypeRes.status).toBe(200);
      expect(mockSendTestEmail).toHaveBeenCalledWith("lib@alabang.sti.edu.ph", "Test librarian");

      // SMTP 535 helpful diagnostic
      mockSendOverdueEmail.mockResolvedValueOnce({
        success: false,
        error: new Error("535-5.7.8 Username and Password not accepted"),
      });
      const smtpErrRes = await testEmailPost(
        new Request("http://localhost/api/test-email", {
          method: "POST",
          body: JSON.stringify({ type: "overdue" }),
        })
      );
      expect(smtpErrRes.status).toBe(500);
      expect((await smtpErrRes.json()).error).toContain("Gmail SMTP Authentication Failed (535)");

      // Connection refused
      mockSendOverdueEmail.mockResolvedValueOnce({
        success: false,
        error: "connect ECONNREFUSED 127.0.0.1:465",
      });
      const refusedRes = await testEmailPost(
        new Request("http://localhost/api/test-email", { method: "POST", body: "{}" })
      );
      expect(refusedRes.status).toBe(500);
      expect((await refusedRes.json()).error).toContain("SMTP Connection refused");
    });
  });
});
