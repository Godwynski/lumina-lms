// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  type MockSupabaseClientHelper,
} from "./mocks/supabase";

const {
  mockCreateClient,
  mockCreateAdminClient,
  mockEnsureStaticLibraryCardAssets,
  mockFetchImage,
  mockRedirect,
  mockAfter,
  mockIsDemoModeEnabled,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockEnsureStaticLibraryCardAssets: vi.fn(),
  mockFetchImage: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  mockAfter: vi.fn((cb: () => unknown) => Promise.resolve(cb())),
  mockIsDemoModeEnabled: vi.fn(() => true),
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

vi.mock("@/lib/fetch-image", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fetch-image")>("@/lib/fetch-image");
  return {
    ...actual,
    fetchImage: mockFetchImage,
  };
});

vi.mock("@/lib/demo/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/demo/config")>("@/lib/demo/config");
  return {
    ...actual,
    isDemoModeEnabled: mockIsDemoModeEnabled,
  };
});

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: mockAfter,
  };
});

import { GET as authCallbackGet } from "@/app/(auth)/callback/route";
import { GET as authConfirmGet } from "@/app/(auth)/confirm/route";
import { POST as demoLoginPost } from "@/app/api/demo-login/route";
import { POST as assetsRefreshPost } from "@/app/api/my-card/assets-refresh/route";
import { GET as assetsStatusGet } from "@/app/api/my-card/assets-status/route";
import {
  GET as uiPreferencesGet,
  PATCH as uiPreferencesPatch,
} from "@/app/api/ui-preferences/route";
import { POST as uploadPost } from "@/app/api/upload/route";
import { PATCH as usersPatch } from "@/app/api/users/route";
import { ImageFetchError } from "@/lib/fetch-image";

type AuthRole = "super_admin" | "librarian" | "student_assistant" | "student";

// Valid 1x1 transparent PNG (67 bytes) so sharp executes real WebP conversion.
const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

function setupAuth(
  supabase: MockSupabaseClientHelper,
  role: AuthRole | null,
  status = "ACTIVE",
  userId = "user-1",
  overrides?: { email?: string | null; student_id?: string | null; avatar_url?: string | null }
) {
  if (!role) {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    return;
  }

  const email = overrides && "email" in overrides ? overrides.email : `${role}@alabang.sti.edu.ph`;

  supabase.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: email ?? undefined,
        app_metadata: { role },
        user_metadata: { avatar_url: overrides?.avatar_url ?? null },
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
    student_id: overrides && "student_id" in overrides ? overrides.student_id : "STU-20230001",
    avatar_url: overrides?.avatar_url ?? null,
    department: "BS Information Technology",
    permissions: {
      manage_circulation: true,
      manage_attendance: true,
      view_admin_dashboard: true,
    },
  });
}

describe("Auth, Card, Preferences, Upload & User API Routes", () => {
  let supabase: MockSupabaseClientHelper;
  let adminSupabase: MockSupabaseClientHelper;
  const originalDemoPassword = process.env.DEMO_PASSWORD;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabaseClient();
    adminSupabase = createMockSupabaseClient();
    mockCreateClient.mockResolvedValue(supabase.client);
    mockCreateAdminClient.mockReturnValue(adminSupabase.client);
    mockIsDemoModeEnabled.mockReturnValue(true);
    supabase.auth.exchangeCodeForSession = vi.fn();
    supabase.auth.verifyOtp = vi.fn();
    supabase.auth.signInWithPassword = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalDemoPassword === undefined) {
      delete process.env.DEMO_PASSWORD;
    } else {
      process.env.DEMO_PASSWORD = originalDemoPassword;
    }
  });

  describe("GET /(auth)/callback", () => {
    it("exchanges OAuth code, provisions card assets, and redirects to safe next path", async () => {
      (supabase.auth.exchangeCodeForSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        error: null,
      });
      supabase.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "u-1",
            email: "student.20230001@alabang.sti.edu.ph",
            user_metadata: { avatar_url: "https://lh3.googleusercontent.com/a.jpg" },
          },
        },
        error: null,
      });
      mockEnsureStaticLibraryCardAssets.mockResolvedValueOnce({});

      const res = await authCallbackGet(
        new Request("https://lumina.test/callback?code=auth-code-123&next=/student-catalog")
      );
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://lumina.test/student-catalog");
      expect(mockEnsureStaticLibraryCardAssets).toHaveBeenCalledWith({
        userId: "u-1",
        fallbackEmail: "student.20230001@alabang.sti.edu.ph",
        fallbackAvatarUrl: "https://lh3.googleusercontent.com/a.jpg",
      });
    });

    it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/@evil.com"])(
      "blocks open redirect target %s and defaults to /dashboard",
      async (unsafeNext) => {
        (supabase.auth.exchangeCodeForSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          error: null,
        });
        supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

        const res = await authCallbackGet(
          new Request(
            `https://lumina.test/callback?code=ok&next=${encodeURIComponent(unsafeNext)}`,
            { headers: { "x-forwarded-host": "app.lumina.edu" } }
          )
        );
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe("https://app.lumina.edu/dashboard");
      }
    );

    it("does not block login when asset provisioning fails, and handles OAuth/domain errors", async () => {
      (supabase.auth.exchangeCodeForSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        error: null,
      });
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: "u-1", email: "a@alabang.sti.edu.ph", user_metadata: {} } },
        error: null,
      });
      mockEnsureStaticLibraryCardAssets.mockRejectedValueOnce(new Error("Storage down"));

      const resilientRes = await authCallbackGet(
        new Request("https://lumina.test/callback?code=ok")
      );
      expect(resilientRes.headers.get("location")).toBe("https://lumina.test/dashboard");

      (supabase.auth.exchangeCodeForSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        error: { message: "Invalid code" },
      });
      const exchangeErrRes = await authCallbackGet(
        new Request("https://lumina.test/callback?code=bad")
      );
      expect(exchangeErrRes.headers.get("location")).toBe(
        "https://lumina.test/error?error=Invalid%20code"
      );

      const triggerRejectRes = await authCallbackGet(
        new Request(
          "https://lumina.test/callback?error_description=Database+error+saving+new+user"
        )
      );
      expect(triggerRejectRes.headers.get("location")).toBe(
        "https://lumina.test/error?error=restricted_access"
      );

      const missingCodeRes = await authCallbackGet(new Request("https://lumina.test/callback"));
      expect(missingCodeRes.headers.get("location")).toBe(
        "https://lumina.test/error?error=No%20code%20provided"
      );
    });
  });

  describe("GET /(auth)/confirm", () => {
    it("verifies OTP and redirects to safe next path", async () => {
      (supabase.auth.verifyOtp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });

      await expect(
        authConfirmGet(
          new NextRequest("http://localhost/confirm?token_hash=tok-1&type=email&next=/catalog")
        )
      ).rejects.toThrow("NEXT_REDIRECT:/catalog");
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        type: "email",
        token_hash: "tok-1",
      });
    });

    it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/@evil.com"])(
      "blocks open redirect %s and redirects to /dashboard",
      async (unsafeNext) => {
        (supabase.auth.verifyOtp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: null });

        await expect(
          authConfirmGet(
            new NextRequest(
              `http://localhost/confirm?token_hash=tok-1&type=signup&next=${encodeURIComponent(unsafeNext)}`
            )
          )
        ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
      }
    );

    it("redirects to /error on verifyOtp failure or missing params", async () => {
      (supabase.auth.verifyOtp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        error: { message: "Token expired" },
      });
      await expect(
        authConfirmGet(new NextRequest("http://localhost/confirm?token_hash=tok&type=email"))
      ).rejects.toThrow("NEXT_REDIRECT:/error?error=Token%20expired");

      await expect(
        authConfirmGet(new NextRequest("http://localhost/confirm"))
      ).rejects.toThrow("NEXT_REDIRECT:/error?error=No%20token%20hash%20or%20type");
    });
  });

  describe("POST /api/demo-login", () => {
    it("returns 404 when demo mode disabled or email is not a demo account", async () => {
      mockIsDemoModeEnabled.mockReturnValueOnce(false);
      const disabledRes = await demoLoginPost(
        new Request("http://localhost/api/demo-login", {
          method: "POST",
          body: JSON.stringify({ email: "demo.aquino@alabang.sti.edu.ph" }),
        })
      );
      expect(disabledRes.status).toBe(404);

      const unknownRes = await demoLoginPost(
        new Request("http://localhost/api/demo-login", {
          method: "POST",
          body: JSON.stringify({ email: "stranger@alabang.sti.edu.ph" }),
        })
      );
      expect(unknownRes.status).toBe(404);
    });

    it("returns 400 on malformed JSON or non-object payload, and 503 if DEMO_PASSWORD is missing", async () => {
      const badJson = await demoLoginPost(
        new Request("http://localhost/api/demo-login", { method: "POST", body: "{bad" })
      );
      expect(badJson.status).toBe(400);

      const arrayBody = await demoLoginPost(
        new Request("http://localhost/api/demo-login", { method: "POST", body: "[]" })
      );
      expect(arrayBody.status).toBe(400);

      delete process.env.DEMO_PASSWORD;
      const misconfigured = await demoLoginPost(
        new Request("http://localhost/api/demo-login", {
          method: "POST",
          body: JSON.stringify({ email: "demo.aquino@alabang.sti.edu.ph" }),
        })
      );
      expect(misconfigured.status).toBe(503);
    });

    it("signs in matching demo account (case-insensitive) and returns 401 if credentials fail", async () => {
      process.env.DEMO_PASSWORD = "demo-secret-password";
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: { id: "demo-1" } },
        error: null,
      });

      const okRes = await demoLoginPost(
        new Request("http://localhost/api/demo-login", {
          method: "POST",
          body: JSON.stringify({ email: "  DEMO.AQUINO@ALABANG.STI.EDU.PH  " }),
        })
      );
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({ ok: true });
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "demo.aquino@alabang.sti.edu.ph",
        password: "demo-secret-password",
      });

      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      });
      const failRes = await demoLoginPost(
        new Request("http://localhost/api/demo-login", {
          method: "POST",
          body: JSON.stringify({ email: "demo.aquino@alabang.sti.edu.ph" }),
        })
      );
      expect(failRes.status).toBe(401);
    });
  });

  describe("/api/my-card/assets-refresh & /api/my-card/assets-status", () => {
    it("rejects unauthenticated and archived users", async () => {
      setupAuth(supabase, null);
      expect(
        (await assetsRefreshPost(new Request("http://localhost/api/my-card/assets-refresh", { method: "POST" }))).status
      ).toBe(401);
      expect(
        (await assetsStatusGet(new Request("http://localhost/api/my-card/assets-status"))).status
      ).toBe(401);

      setupAuth(supabase, "student", "ARCHIVED");
      expect(
        (await assetsRefreshPost(new Request("http://localhost/api/my-card/assets-refresh", { method: "POST" }))).status
      ).toBe(403);
    });

    it("POST /assets-refresh forces QR regeneration and handles thrown errors", async () => {
      setupAuth(supabase, "student", "ACTIVE", "stu-1", {
        avatar_url: "https://example.com/avatar.jpg",
      });
      mockEnsureStaticLibraryCardAssets.mockResolvedValueOnce({
        studentId: "STU-20230001",
        qrUrl: "https://signed/qr.png",
        profileUrl: "https://public/card.webp",
      });

      const okRes = await assetsRefreshPost(
        new Request("http://localhost/api/my-card/assets-refresh", { method: "POST" })
      );
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({
        ok: true,
        student_id: "STU-20230001",
        qr_url: "https://signed/qr.png",
        profile_url: "https://public/card.webp",
      });
      expect(mockEnsureStaticLibraryCardAssets).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "stu-1", forceQrRegeneration: true })
      );

      mockEnsureStaticLibraryCardAssets.mockRejectedValueOnce(new Error("Bucket error"));
      const errRes = await assetsRefreshPost(
        new Request("http://localhost/api/my-card/assets-refresh", { method: "POST" })
      );
      expect(errRes.status).toBe(500);
    });

    it("GET /assets-status returns readiness flags and 400 when student ID cannot be resolved", async () => {
      setupAuth(supabase, "student", "ACTIVE", "", {
        email: null,
        student_id: null,
      });
      const missingRes = await assetsStatusGet(
        new Request("http://localhost/api/my-card/assets-status")
      );
      expect(missingRes.status).toBe(400);
      expect((await missingRes.json()).code).toBe("STUDENT_ID_MISSING");

      setupAuth(supabase, "student", "ACTIVE", "stu-1", {
        student_id: "STU-20230001",
        avatar_url: "https://proj.supabase.co/storage/v1/object/public/avatars/stu-1/card.webp?v=1",
      });
      mockEnsureStaticLibraryCardAssets.mockResolvedValueOnce({
        studentId: "STU-20230001",
        qrUrl: "https://signed/qr.png",
        profileUrl: "https://public/card.webp",
        qrExists: true,
        profileExists: true,
      });

      const okRes = await assetsStatusGet(
        new Request("http://localhost/api/my-card/assets-status")
      );
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({
        ok: true,
        student_id: "STU-20230001",
        qr_url: "https://signed/qr.png",
        profile_url: "https://public/card.webp",
        qr_exists: true,
        profile_exists: true,
        profile_is_deterministic: true,
        ready: true,
      });
    });
  });

  describe("GET & PATCH /api/ui-preferences", () => {
    it("returns 401 when unauthenticated", async () => {
      setupAuth(supabase, null);
      expect((await uiPreferencesGet(new Request("http://localhost/api/ui-preferences"))).status).toBe(401);
      expect(
        (
          await uiPreferencesPatch(
            new Request("http://localhost/api/ui-preferences", {
              method: "PATCH",
              body: JSON.stringify({ theme: "dark" }),
            })
          )
        ).status
      ).toBe(401);
    });

    it("GET returns existing preferences, defaults to {}, and returns 500 on DB error", async () => {
      setupAuth(supabase, "student", "ACTIVE", "u-1");

      supabase.setTableResponse("ui_preferences", { preferences: { sidebarCollapsed: true } });
      const okRes = await uiPreferencesGet(new Request("http://localhost/api/ui-preferences"));
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({ ok: true, preferences: { sidebarCollapsed: true } });

      supabase.setTableResponse("ui_preferences", null);
      const emptyRes = await uiPreferencesGet(new Request("http://localhost/api/ui-preferences"));
      expect(emptyRes.status).toBe(200);
      expect(await emptyRes.json()).toEqual({ ok: true, preferences: {} });

      supabase.setTableResponse("ui_preferences", null, { message: "Pref query failed" });
      const errRes = await uiPreferencesGet(new Request("http://localhost/api/ui-preferences"));
      expect(errRes.status).toBe(500);
    });

    it("PATCH validates JSON/payload, deep-merges readProgress, upserts, and handles DB error", async () => {
      setupAuth(supabase, "student", "ACTIVE", "u-1");

      expect(
        (
          await uiPreferencesPatch(
            new Request("http://localhost/api/ui-preferences", { method: "PATCH", body: "bad" })
          )
        ).status
      ).toBe(400);

      expect(
        (
          await uiPreferencesPatch(
            new Request("http://localhost/api/ui-preferences", { method: "PATCH", body: "[1,2]" })
          )
        ).status
      ).toBe(400);

      supabase.setTableResponse("ui_preferences", {
        preferences: { theme: "light", readProgress: { bookA: 40 } },
      });

      const okRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({
            theme: "dark",
            readProgress: { bookB: 80 },
          }),
        })
      );
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({
        ok: true,
        preferences: {
          theme: "dark",
          readProgress: { bookA: 40, bookB: 80 },
        },
      });
      expect(supabase.getTableBuilder("ui_preferences").upsert).toHaveBeenCalledWith(
        {
          user_id: "u-1",
          preferences: {
            theme: "dark",
            readProgress: { bookA: 40, bookB: 80 },
          },
        },
        { onConflict: "user_id" }
      );

      supabase.setTableResponse("ui_preferences", null, { message: "Upsert failed" });
      const errRes = await uiPreferencesPatch(
        new Request("http://localhost/api/ui-preferences", {
          method: "PATCH",
          body: JSON.stringify({ theme: "dark" }),
        })
      );
      expect(errRes.status).toBe(500);
    });
  });

  describe("POST /api/upload", () => {
    it("enforces auth and staff role permissions", async () => {
      setupAuth(supabase, null);
      expect(
        (await uploadPost(new Request("http://localhost/api/upload", { method: "POST" }))).status
      ).toBe(401);

      setupAuth(supabase, "student");
      expect(
        (await uploadPost(new Request("http://localhost/api/upload", { method: "POST" }))).status
      ).toBe(403);

      setupAuth(supabase, "student_assistant", "SUSPENDED");
      expect(
        (await uploadPost(new Request("http://localhost/api/upload", { method: "POST" }))).status
      ).toBe(403);
    });

    it("rejects empty form, disallowed MIME type, oversized file, and invalid remote URLs with 400", async () => {
      setupAuth(supabase, "librarian");

      // Empty form
      const emptyForm = new FormData();
      expect(
        (await uploadPost(new Request("http://localhost/api/upload", { method: "POST", body: emptyForm }))).status
      ).toBe(400);

      // Disallowed MIME type
      const pdfForm = new FormData();
      pdfForm.append("file", new File([Buffer.from("%PDF-1.4")], "doc.pdf", { type: "application/pdf" }));
      const pdfRes = await uploadPost(
        new Request("http://localhost/api/upload", { method: "POST", body: pdfForm })
      );
      expect(pdfRes.status).toBe(400);
      expect((await pdfRes.json()).error).toContain("Invalid file type");

      // Oversized file (> 5MB)
      const bigForm = new FormData();
      bigForm.append(
        "file",
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" })
      );
      const bigRes = await uploadPost(
        new Request("http://localhost/api/upload", { method: "POST", body: bigForm })
      );
      expect(bigRes.status).toBe(400);
      expect((await bigRes.json()).error).toContain("File too large");

      // Remote URL SSRF/validation error
      mockFetchImage.mockRejectedValueOnce(new ImageFetchError("Restricted remote image host."));
      const ssrfForm = new FormData();
      ssrfForm.append("url", "https://127.0.0.1/secret.png");
      const ssrfRes = await uploadPost(
        new Request("http://localhost/api/upload", { method: "POST", body: ssrfForm })
      );
      expect(ssrfRes.status).toBe(400);
      expect((await ssrfRes.json()).error).toBe("Restricted remote image host.");

      // Remote URL disallowed MIME type
      mockFetchImage.mockResolvedValueOnce({
        buffer: Buffer.from("<svg/>"),
        contentType: "image/tiff",
      });
      const remoteBadMime = new FormData();
      remoteBadMime.append("url", "https://example.com/cover.tiff");
      expect(
        (await uploadPost(new Request("http://localhost/api/upload", { method: "POST", body: remoteBadMime }))).status
      ).toBe(400);
    });

    it("converts uploaded PNG to WebP, uploads to book-covers bucket, and handles remote + storage errors", async () => {
      setupAuth(supabase, "student_assistant", "ACTIVE");

      const validForm = new FormData();
      validForm.append("file", new File([TINY_PNG_BUFFER], "cover.png", { type: "image/png" }));
      const okFileRes = await uploadPost(
        new Request("http://localhost/api/upload", { method: "POST", body: validForm })
      );
      const okFileBody = await okFileRes.json();

      expect(okFileRes.status).toBe(200);
      expect(okFileBody.success).toBe(true);
      expect(okFileBody.cover_url).toBe("https://placeholder.supabase.co/storage/asset.png");
      const bucket = supabase.storage.from("book-covers");
      expect(bucket.upload).toHaveBeenCalledWith(
        expect.stringMatching(/\.webp$/),
        expect.any(Buffer),
        expect.objectContaining({ contentType: "image/webp" })
      );

      // Valid remote URL upload
      mockFetchImage.mockResolvedValueOnce({
        buffer: TINY_PNG_BUFFER,
        contentType: "image/png",
      });
      const remoteForm = new FormData();
      remoteForm.append("url", "https://covers.openlibrary.org/b/id/123-L.jpg");
      const okRemoteRes = await uploadPost(
        new Request("http://localhost/api/upload", { method: "POST", body: remoteForm })
      );
      expect(okRemoteRes.status).toBe(200);

      // Unexpected fetch error -> 500
      mockFetchImage.mockRejectedValueOnce(new Error("Unexpected socket failure"));
      const unexpectedRemoteForm = new FormData();
      unexpectedRemoteForm.append("url", "https://covers.openlibrary.org/b/id/999-L.jpg");
      const remote500 = await uploadPost(
        new Request("http://localhost/api/upload", { method: "POST", body: unexpectedRemoteForm })
      );
      expect(remote500.status).toBe(500);

      // Storage upload failure -> 500
      bucket.upload.mockResolvedValueOnce({ data: null, error: { message: "Bucket quota full" } });
      const failForm = new FormData();
      failForm.append("file", new File([TINY_PNG_BUFFER], "cover.png", { type: "image/png" }));
      const storageErrRes = await uploadPost(
        new Request("http://localhost/api/upload", { method: "POST", body: failForm })
      );
      expect(storageErrRes.status).toBe(500);
      expect((await storageErrRes.json()).error).toBe("Failed to upload to cloud storage");
    });
  });

  describe("PATCH /api/users", () => {
    it("enforces authentication, manager roles, and JSON/Zod validation", async () => {
      setupAuth(supabase, null);
      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", {
              method: "PATCH",
              body: JSON.stringify({ id: "u-2" }),
            })
          )
        ).status
      ).toBe(401);

      setupAuth(supabase, "student_assistant");
      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", {
              method: "PATCH",
              body: JSON.stringify({ id: "u-2" }),
            })
          )
        ).status
      ).toBe(403);

      setupAuth(supabase, "super_admin");
      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", { method: "PATCH", body: "bad-json" })
          )
        ).status
      ).toBe(400);

      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", {
              method: "PATCH",
              body: JSON.stringify({ id: "u-2", email: "invalid-email" }),
            })
          )
        ).status
      ).toBe(400);
    });

    it("enforces librarian privilege boundaries and super_admin self-demotion guard", async () => {
      setupAuth(supabase, "librarian", "ACTIVE", "lib-1");
      const profilesBuilder = supabase.getTableBuilder("profiles");

      // Target is super_admin -> 403
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "lib-1", role: "librarian", status: "ACTIVE" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "adm-1", role: "super_admin", status: "ACTIVE" },
          error: null,
        });
      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", {
              method: "PATCH",
              body: JSON.stringify({ id: "adm-1", name: "Hack" }),
            })
          )
        ).status
      ).toBe(403);

      // Target is fellow librarian -> 403
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "lib-1", role: "librarian", status: "ACTIVE" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "lib-2", role: "librarian", status: "ACTIVE" },
          error: null,
        });
      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", {
              method: "PATCH",
              body: JSON.stringify({ id: "lib-2", name: "Other" }),
            })
          )
        ).status
      ).toBe(403);

      // Librarian trying to change a student's role -> 403
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "lib-1", role: "librarian", status: "ACTIVE" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "stu-1", role: "student", status: "ACTIVE", full_name: "Stu" },
          error: null,
        });
      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", {
              method: "PATCH",
              body: JSON.stringify({ id: "stu-1", role: "student_assistant" }),
            })
          )
        ).status
      ).toBe(403);

      // Librarian trying to suspend a student -> 403
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "lib-1", role: "librarian", status: "ACTIVE" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "stu-1", role: "student", status: "ACTIVE", full_name: "Stu" },
          error: null,
        });
      expect(
        (
          await usersPatch(
            new Request("http://localhost/api/users", {
              method: "PATCH",
              body: JSON.stringify({ id: "stu-1", status: "SUSPENDED" }),
            })
          )
        ).status
      ).toBe(403);

      // Super admin trying to change own role or status -> 403
      setupAuth(supabase, "super_admin", "ACTIVE", "adm-1");
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "adm-1", role: "super_admin", status: "ACTIVE" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "adm-1", role: "super_admin", status: "ACTIVE" },
          error: null,
        });
      const selfDemote = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "adm-1", role: "librarian" }),
        })
      );
      expect(selfDemote.status).toBe(403);
    });

    it("updates profile, syncs library_cards status, transfers ownership, and handles DB errors", async () => {
      setupAuth(supabase, "super_admin", "ACTIVE", "adm-1");
      const profilesBuilder = supabase.getTableBuilder("profiles");
      const targetProfile = {
        id: "stu-1",
        full_name: "Old Name",
        email: "stu@alabang.sti.edu.ph",
        role: "student",
        status: "ACTIVE",
        department: "General",
        student_id: "STU-1",
        address: null,
        phone: null,
      };
      const updatedProfile = {
        ...targetProfile,
        full_name: "New Name",
        status: "SUSPENDED",
      };

      // Note: 1st .single() is getMe(), 2nd .single() is target lookup in route
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "adm-1", role: "super_admin", status: "ACTIVE", email: "adm@alabang.sti.edu.ph" },
          error: null,
        })
        .mockResolvedValueOnce({ data: targetProfile, error: null });
      adminSupabase.setTableResponse("profiles", updatedProfile);
      adminSupabase.setTableResponse("library_cards", []);

      const okRes = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "stu-1", name: "New Name", status: "suspended" }),
        })
      );
      const okBody = await okRes.json();
      expect(okRes.status).toBe(200);
      expect(okBody.ok).toBe(true);
      expect(okBody.user).toMatchObject({ id: "stu-1", name: "New Name", status: "SUSPENDED" });
      expect(adminSupabase.getTableBuilder("library_cards").update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "SUSPENDED" })
      );

      // Transfer super_admin ownership
      const libTarget = {
        id: "lib-9",
        full_name: "Librarian Nine",
        email: "lib9@alabang.sti.edu.ph",
        role: "librarian",
        status: "ACTIVE",
      };
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "adm-1", role: "super_admin", status: "ACTIVE", email: "adm@alabang.sti.edu.ph" },
          error: null,
        })
        .mockResolvedValueOnce({ data: libTarget, error: null });
      adminSupabase.setRpcResponse(null, null, "transfer_super_admin_ownership");
      adminSupabase.setTableResponse("profiles", { ...libTarget, role: "super_admin" });

      const transferRes = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "lib-9", role: "super_admin" }),
        })
      );
      expect(transferRes.status).toBe(200);
      expect(adminSupabase.rpc).toHaveBeenCalledWith("transfer_super_admin_ownership", {
        p_current_admin_id: "adm-1",
        p_new_admin_id: "lib-9",
      });

      // DB update failure -> 400 DATABASE_ERROR
      profilesBuilder.single
        .mockResolvedValueOnce({
          data: { id: "adm-1", role: "super_admin", status: "ACTIVE" },
          error: null,
        })
        .mockResolvedValueOnce({ data: targetProfile, error: null });
      adminSupabase.setTableResponse("profiles", null, { message: "Update constraint error" });
      const errRes = await usersPatch(
        new Request("http://localhost/api/users", {
          method: "PATCH",
          body: JSON.stringify({ id: "stu-1", name: "Fail" }),
        })
      );
      expect(errRes.status).toBe(400);
      expect((await errRes.json()).code).toBe("DATABASE_ERROR");
    });
  });
});
