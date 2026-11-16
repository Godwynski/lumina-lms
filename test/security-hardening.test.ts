// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createMockSupabaseClient,
  type MockSupabaseClientHelper,
} from "./mocks/supabase";

const {
  mockCreateClient,
  mockCreateAdminClient,
  mockEnsureStaticLibraryCardAssets,
  mockRunMaintenanceTasks,
  mockSendBulkNotifications,
  mockSendOverdueEmail,
  mockConnection,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockEnsureStaticLibraryCardAssets: vi.fn(),
  mockRunMaintenanceTasks: vi.fn(),
  mockSendBulkNotifications: vi.fn(),
  mockSendOverdueEmail: vi.fn(),
  mockConnection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/library-card-assets.server", () => ({
  ensureStaticLibraryCardAssets: mockEnsureStaticLibraryCardAssets,
}));

vi.mock("@/lib/notifications", () => ({
  runMaintenanceTasks: mockRunMaintenanceTasks,
  sendBulkNotifications: mockSendBulkNotifications,
}));

vi.mock("@/lib/mail", () => ({
  sendOverdueEmail: mockSendOverdueEmail,
  sendDueSoonEmail: vi.fn(),
  sendTestEmail: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    connection: mockConnection,
  };
});

import { PATCH as usersPatch } from "@/app/api/users/route";
import { POST as uploadPost } from "@/app/api/upload/route";
import { POST as auditLogsImportPost } from "@/app/api/admin/audit-logs/import/route";
import { PATCH as uiPreferencesPatch, GET as uiPreferencesGet } from "@/app/api/ui-preferences/route";
import { POST as bulkNotificationsPost } from "@/app/api/notifications/bulk/route";
import { POST as maintenancePost } from "@/app/api/notifications/maintenance/route";
import { POST as testEmailPost } from "@/app/api/test-email/route";
import { GET as exportCoversGet } from "@/app/api/catalog/export/covers/route";
import { POST as annualResetPost } from "@/app/api/admin/annual-reset/route";
import { GET as authCallbackGet } from "@/app/(auth)/callback/route";
import { withAuthApi, apiSuccess } from "@/lib/api-utils";
import { createSafeAction } from "@/lib/actions/action-utils";
import { assertRole } from "@/lib/auth-helpers";

type AuthRole = "super_admin" | "librarian" | "library_staff" | "patron";

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

// Create a minimal PNG buffer with custom IHDR dimensions (passes MIME, exercises sharp limitInputPixels).
function makePngHeaderWithDimensions(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrLen = Buffer.from([0x00, 0x00, 0x00, 0x0d]);
  const ihdrType = Buffer.from("IHDR");
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  const crc = Buffer.alloc(4);
  return Buffer.concat([sig, ihdrLen, ihdrType, ihdrData, crc]);
}

describe("Security Hardening Verification", () => {
  let supabase: MockSupabaseClientHelper;
  let adminSupabase: MockSupabaseClientHelper;
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabaseClient();
    adminSupabase = createMockSupabaseClient();
    mockCreateClient.mockResolvedValue(supabase.client);
    mockCreateAdminClient.mockReturnValue(adminSupabase.client);
    supabase.auth.exchangeCodeForSession = vi.fn();
    consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    consoleErrSpy.mockRestore();
  });

  describe("1. PATCH /api/users permissions authorization and strict validation", () => {
    it("forbids librarians from modifying permissions (403)", async () => {
      setupAuth(supabase, "librarian", "ACTIVE", "lib-1");
      const profilesBuilder = supabase.getTableBuilder("profiles");
      profilesBuilder.single
        .mockResolvedValueOnce({ data: { id: "lib-1", role: "librarian", status: "ACTIVE" }, error: null })
        .mockResolvedValueOnce({ data: { id: "sa-1", role: "library_staff", status: "ACTIVE" }, error: null });

      const res = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "sa-1", permissions: { manage_circulation: true } }),
        })
      );
      expect(res.status).toBe(403);
      expect(adminSupabase.from).not.toHaveBeenCalledWith("profiles");
    });

    it("rejects unknown permission keys, arrays, and non-boolean values with 400 for super_admin", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE", "adm-1");
      const profilesBuilder = supabase.getTableBuilder("profiles");

      // Unknown key
      profilesBuilder.single
        .mockResolvedValueOnce({ data: { id: "adm-1", role: "super_admin", status: "ACTIVE" }, error: null })
        .mockResolvedValueOnce({ data: { id: "sa-1", role: "library_staff", status: "ACTIVE" }, error: null });
      const unknownKeyRes = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "sa-1", permissions: { is_super_user: true } }),
        })
      );
      expect(unknownKeyRes.status).toBe(400);

      // Array permissions
      profilesBuilder.single
        .mockResolvedValueOnce({ data: { id: "adm-1", role: "super_admin", status: "ACTIVE" }, error: null })
        .mockResolvedValueOnce({ data: { id: "sa-1", role: "library_staff", status: "ACTIVE" }, error: null });
      const arrayRes = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "sa-1", permissions: ["manage_circulation"] }),
        })
      );
      expect(arrayRes.status).toBe(400);

      // Non-boolean value (fails UserPatchSchema with 400)
      const nonBoolRes = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "sa-1", permissions: { manage_circulation: "yes" } }),
        })
      );
      expect(nonBoolRes.status).toBe(400);
    });

    it("allows super_admin to update known boolean UserPermissions flags", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE", "adm-1");
      const profilesBuilder = supabase.getTableBuilder("profiles");
      const target = { id: "sa-1", role: "library_staff", status: "ACTIVE", permissions: {} };
      const updated = {
        ...target,
        permissions: { manage_circulation: true, manage_attendance: false, view_admin_dashboard: true },
      };

      profilesBuilder.single
        .mockResolvedValueOnce({ data: { id: "adm-1", role: "super_admin", status: "ACTIVE" }, error: null })
        .mockResolvedValueOnce({ data: target, error: null });
      adminSupabase.setTableResponse("profiles", updated);

      const res = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({
            id: "sa-1",
            permissions: { manage_circulation: true, manage_attendance: false, view_admin_dashboard: true },
          }),
        })
      );
      expect(res.status).toBe(200);
      expect(adminSupabase.getTableBuilder("profiles").update).toHaveBeenCalledWith({
        permissions: { manage_circulation: true, manage_attendance: false, view_admin_dashboard: true },
      });
    });
  });

  describe("2. Staff ACTIVE status enforcement across withAuthApi, createSafeAction, and assertRole", () => {
    it.each([
      ["librarian", "SUSPENDED"],
      ["librarian", "PENDING"],
      ["librarian", "INACTIVE"],
      ["super_admin", "SUSPENDED"],
      ["super_admin", "PENDING"],
      ["super_admin", "INACTIVE"],
      ["library_staff", "SUSPENDED"],
    ] as const)(
      "blocks %s with status %s on requireStaff and staff-only allowedRoles in withAuthApi",
      async (role, status) => {
        const staffReqHandler = withAuthApi(async () => apiSuccess({ ok: true }), { requireStaff: true });
        setupAuth(supabase, role, status);
        expect((await staffReqHandler(new Request("http://localhost/api/test"))).status).toBe(403);

        const staffRolesHandler = withAuthApi(async () => apiSuccess({ ok: true }), {
          allowedRoles: ["super_admin", "librarian", "library_staff"],
        });
        setupAuth(supabase, role, status);
        expect((await staffRolesHandler(new Request("http://localhost/api/test"))).status).toBe(403);
      }
    );

    it("allows lowercase 'active' staff and preserves non-archived student access", async () => {
      const staffHandler = withAuthApi(async () => apiSuccess({ ok: true }), {
        allowedRoles: ["librarian"],
      });
      setupAuth(supabase, "librarian", "active");
      expect((await staffHandler(new Request("http://localhost/api/test"))).status).toBe(200);

      const studentHandler = withAuthApi(async () => apiSuccess({ ok: true }), {
        allowedRoles: ["patron"],
      });
      setupAuth(supabase, "patron", "PENDING");
      expect((await studentHandler(new Request("http://localhost/api/test"))).status).toBe(200);

      setupAuth(supabase, "patron", "ARCHIVED");
      expect((await studentHandler(new Request("http://localhost/api/test"))).status).toBe(403);
    });

    it.each([
      ["librarian", "SUSPENDED"],
      ["librarian", "PENDING"],
      ["librarian", "INACTIVE"],
      ["super_admin", "SUSPENDED"],
      ["super_admin", "PENDING"],
    ] as const)(
      "blocks %s with status %s in staff-only createSafeAction and assertRole",
      async (role, status) => {
        const staffAction = createSafeAction(z.object({ x: z.number() }), async (v) => v, {
          allowedRoles: ["super_admin", "librarian"],
        });

        setupAuth(supabase, role, status);
        expect(await staffAction({ x: 1 })).toEqual({
          success: false,
          error: "Access denied: Staff account is currently deactivated.",
        });

        setupAuth(supabase, role, status);
        await expect(assertRole(["super_admin", "librarian"])).rejects.toThrow("Forbidden");
      }
    );

    it("allows lowercase 'active' staff and non-active students when student role is permitted in createSafeAction", async () => {
      const staffAction = createSafeAction(z.object({ x: z.number() }), async (v) => v, {
        allowedRoles: ["super_admin", "librarian"],
      });
      setupAuth(supabase, "super_admin", "active");
      expect(await staffAction({ x: 1 })).toEqual({ success: true, data: { x: 1 } });

      const studentAction = createSafeAction(z.object({ x: z.number() }), async (v) => v, {
        allowedRoles: ["patron", "library_staff"],
      });
      setupAuth(supabase, "patron", "PENDING");
      expect(await studentAction({ x: 2 })).toEqual({ success: true, data: { x: 2 } });
    });
  });

  describe("3. POST /api/upload sharp failure & pixel limit", () => {
    it("returns 400 and does not upload when sharp fails on corrupt image bytes", async () => {
      setupAuth(supabase, "librarian", "ACTIVE");
      const form = new FormData();
      form.append("file", new File([Buffer.from("not-really-a-png")], "bad.png", { type: "image/png" }));

      const res = await uploadPost(new Request("http://localhost/api/upload", { method: "POST", body: form }));
      expect(res.status).toBe(400);
      expect(supabase.storage.from("book-covers").upload).not.toHaveBeenCalled();
    });

    it("returns 400 when image dimensions exceed 40,000,000 input pixels", async () => {
      setupAuth(supabase, "librarian", "ACTIVE");
      const hugePng = makePngHeaderWithDimensions(8000, 6000); // 48,000,000 pixels > 40,000,000
      const form = new FormData();
      form.append("file", new File([new Uint8Array(hugePng)], "bomb.png", { type: "image/png" }));

      const res = await uploadPost(new Request("http://localhost/api/upload", { method: "POST", body: form }));
      expect(res.status).toBe(400);
      expect(supabase.storage.from("book-covers").upload).not.toHaveBeenCalled();
    });
  });

  describe("4. Zod validation and size caps for audit-logs/import and ui-preferences", () => {
    it("rejects > 500 rows, extra top-level fields, and oversized log fields in audit-logs/import", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE");

      const tooManyLogs = Array.from({ length: 501 }, () => ({ entity_type: "book", action: "create" }));
      const overCapRes = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({ logs: tooManyLogs }),
        })
      );
      expect(overCapRes.status).toBe(400);

      const extraTopLevelRes = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({ logs: [{ entity_type: "book", action: "create" }], extra: true }),
        })
      );
      expect(extraTopLevelRes.status).toBe(400);

      const hugeDetailsRes = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({
            logs: [{ entity_type: "book", action: "create", details: { blob: "x".repeat(20_000) } }],
          }),
        })
      );
      expect(hugeDetailsRes.status).toBe(400);
    });

    it("rejects unknown keys, invalid values, oversized payloads, and >200 readProgress entries in ui-preferences", async () => {
      setupAuth(supabase, "patron", "ACTIVE");

      const unknownKeyRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({ arbitraryKey: "evil" }),
        })
      );
      expect(unknownKeyRes.status).toBe(400);

      const badThemeRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({ theme: "neon-rainbow" }),
        })
      );
      expect(badThemeRes.status).toBe(400);

      const badViewRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({ inventoryView: "grid" }),
        })
      );
      expect(badViewRes.status).toBe(400);

      const badProgressRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({ readProgress: { book1: 999 } }),
        })
      );
      expect(badProgressRes.status).toBe(400);

      const tooManyEntries: Record<string, number> = {};
      for (let i = 0; i < 201; i++) tooManyEntries[`book-${i}`] = 10;
      const tooManyRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({ readProgress: tooManyEntries }),
        })
      );
      expect(tooManyRes.status).toBe(400);

      const oversizedBodyRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({ readProgress: { ["a".repeat(120)]: 50 }, padding: "x".repeat(20_000) }),
        })
      );
      expect(oversizedBodyRes.status).toBe(400);
    });
  });

  describe("5. Raw DB/internal error messages are logged server-side and never leaked to clients", () => {
    it("sanitizes database errors across API routes", async () => {
      const secretMsg = "FATAL: password authentication failed for user postgres on table secrets";

      // users PATCH
      setupAuth(supabase, "super_admin", "ACTIVE", "adm-1");
      supabase.getTableBuilder("profiles").single
        .mockResolvedValueOnce({ data: { id: "adm-1", role: "super_admin", status: "ACTIVE" }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: secretMsg } });
      const usersRes = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "u-2", name: "Test" }),
        })
      );
      expect(usersRes.status).toBe(400);
      expect(JSON.stringify(await usersRes.json())).not.toContain("postgres");

      // notifications/bulk
      setupAuth(supabase, "librarian", "ACTIVE");
      supabase.setRpcResponse(null, { message: secretMsg }, "send_bulk_notifications_by_target");
      const bulkRes = await bulkNotificationsPost(
        new Request("http://localhost/api/notifications/bulk", {
          method: "POST",
          body: JSON.stringify({ target: "all", title: "Hi", content: "Body" }),
        })
      );
      expect(bulkRes.status).toBe(500);
      expect(JSON.stringify(await bulkRes.json())).not.toContain("postgres");

      // notifications/maintenance
      mockRunMaintenanceTasks.mockRejectedValueOnce(new Error(secretMsg));
      const maintRes = await maintenancePost(
        new Request("http://localhost/api/notifications/maintenance", { method: "POST" })
      );
      expect(maintRes.status).toBe(500);
      expect(JSON.stringify(await maintRes.json())).not.toContain("postgres");

      // test-email generic error (preserves 535/ECONNREFUSED diagnostics separately)
      mockSendOverdueEmail.mockResolvedValueOnce({ success: false, error: new Error(secretMsg) });
      const emailRes = await testEmailPost(
        new Request("http://localhost/api/test-email", { method: "POST", body: "{}" })
      );
      expect(emailRes.status).toBe(500);
      expect(await emailRes.json()).toEqual({ success: false, error: "Failed to send test email" });

      // catalog/export/covers
      supabase.setTableResponse("books", null, { message: secretMsg });
      const coversRes = await exportCoversGet(new Request("http://localhost/api/catalog/export/covers"));
      expect(coversRes.status).toBe(500);
      expect(JSON.stringify(await coversRes.json())).not.toContain("postgres");

      // admin/annual-reset
      setupAuth(supabase, "super_admin", "ACTIVE");
      supabase.setRpcResponse(null, { message: secretMsg }, "annual_student_reset");
      const resetRes = await annualResetPost(
        new Request("http://localhost/api/admin/annual-reset", { method: "POST" })
      );
      expect(resetRes.status).toBe(500);
      expect(JSON.stringify(await resetRes.json())).not.toContain("postgres");

      // admin/audit-logs/import
      adminSupabase.setTableResponse("audit_logs", null, { message: secretMsg });
      const importRes = await auditLogsImportPost(
        new Request("http://localhost/api/admin/audit-logs/import", {
          method: "POST",
          body: JSON.stringify({ logs: [{ entity_type: "book", action: "create" }] }),
        })
      );
      expect(importRes.status).toBe(500);
      expect(JSON.stringify(await importRes.json())).not.toContain("postgres");

      // ui-preferences GET
      supabase.setTableResponse("ui_preferences", null, { message: secretMsg });
      const prefsRes = await uiPreferencesGet(new Request("http://localhost/api/ui-preferences"));
      expect(prefsRes.status).toBe(500);
      expect(JSON.stringify(await prefsRes.json())).not.toContain("postgres");

      expect(consoleErrSpy).toHaveBeenCalled();
    });
  });

  describe("6. GET /(auth)/callback x-forwarded-host validation", () => {
    it("ignores untrusted x-forwarded-host and falls back to origin", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.lumina.edu");
      (supabase.auth.exchangeCodeForSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });
      supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const evilRes = await authCallbackGet(
        new Request("https://lumina.test/callback?code=ok&next=/dashboard", {
          headers: { "x-forwarded-host": "evil.attacker.com" },
        })
      );
      expect(evilRes.headers.get("location")).toBe("https://lumina.test/dashboard");

      (supabase.auth.exchangeCodeForSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });
      supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
      const multiHostRes = await authCallbackGet(
        new Request("https://lumina.test/callback?code=ok&next=/dashboard", {
          headers: { "x-forwarded-host": "app.lumina.edu, evil.com" },
        })
      );
      expect(multiHostRes.headers.get("location")).toBe("https://lumina.test/dashboard");
    });

    it("honours x-forwarded-host when it matches NEXT_PUBLIC_SITE_URL, VERCEL_PROJECT_PRODUCTION_URL, or VERCEL_URL", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.lumina.edu");
      vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "prod.lumina.vercel.app");
      vi.stubEnv("VERCEL_URL", "preview-123.lumina.vercel.app");

      for (const trustedHost of [
        "SITE.LUMINA.EDU",
        "prod.lumina.vercel.app",
        "preview-123.lumina.vercel.app",
      ]) {
        (supabase.auth.exchangeCodeForSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });
        supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

        const res = await authCallbackGet(
          new Request("https://lumina.test/callback?code=ok&next=/catalog", {
            headers: { "x-forwarded-host": trustedHost },
          })
        );
        expect(res.headers.get("location")).toBe(`https://${trustedHost.toLowerCase()}/catalog`);
      }
    });
  });
});
