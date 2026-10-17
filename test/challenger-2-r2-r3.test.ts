import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error next compiled bundle does not export types
import { pathToRegexp } from 'next/dist/compiled/path-to-regexp';

// Mock react cache to pass-through
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  };
});

// Dynamic mock setup for supabase/server
const mockSupabaseInstance = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseInstance),
}));

import { getMe, getPreferences, getUserRole, assertRole } from '../lib/auth-helpers';
import { createClient } from '../lib/supabase/server';
import sitemap from '../app/sitemap';

describe('Challenger 2 - Requirement R2 & R3 Adversarial Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. lib/auth-helpers.ts: getMe() Adversarial Tests', () => {
    it('returns null cleanly when getUser() throws AuthApiError: refresh_token_not_found (status 400)', async () => {
      let unhandledCaught = false;
      const unhandledListener = () => { unhandledCaught = true; };
      process.on('unhandledRejection', unhandledListener);

      try {
        const authApiError = new Error('Invalid Refresh Token: Refresh Token Not Found');
        Object.assign(authApiError, {
          name: 'AuthApiError',
          status: 400,
          code: 'refresh_token_not_found',
          __isAuthError: true,
        });

        mockSupabaseInstance.auth.getUser.mockRejectedValue(authApiError);

        const result = await getMe();
        expect(result).toBeNull();
        expect(unhandledCaught).toBe(false);
      } finally {
        process.removeListener('unhandledRejection', unhandledListener);
      }
    });

    it('returns null cleanly when getUser() resolves with AuthApiError: refresh_token_not_found', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: {
          name: 'AuthApiError',
          status: 400,
          code: 'refresh_token_not_found',
          message: 'Invalid Refresh Token: Refresh Token Not Found',
        },
      });

      const result = await getMe();
      expect(result).toBeNull();
    });

    it('returns null cleanly when createClient() rejects asynchronously', async () => {
      let unhandledCaught = false;
      const unhandledListener = () => { unhandledCaught = true; };
      process.on('unhandledRejection', unhandledListener);

      try {
        vi.mocked(createClient).mockRejectedValueOnce(new Error('Async cookie store failure'));

        const result = await getMe();
        expect(result).toBeNull();
        expect(unhandledCaught).toBe(false);
      } finally {
        process.removeListener('unhandledRejection', unhandledListener);
      }
    });

    it('returns null cleanly when createClient() throws synchronously', async () => {
      vi.mocked(createClient).mockImplementationOnce(() => {
        throw new Error('Synchronous runtime error in createClient');
      });

      const result = await getMe();
      expect(result).toBeNull();
    });

    it('returns null cleanly when database query for profiles throws an unhandled rejection', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: { id: 'usr-fail', app_metadata: {} } },
        error: null,
      });

      mockSupabaseInstance.from.mockImplementationOnce(() => {
        throw new Error('Database connection reset during profile lookup');
      });

      const result = await getMe();
      expect(result).toBeNull();
    });

    it('returns null when profile lookup returns null data with no error', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: { id: 'usr-not-found', app_metadata: {} } },
        error: null,
      });

      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await getMe();
      expect(result).toBeNull();
    });

    it('handles concurrency: 50 simultaneous getMe() invocations without race condition or crash', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-concurrent', app_metadata: { role: 'librarian' } } },
        error: null,
      });

      mockSupabaseInstance.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'user-concurrent',
            role: 'librarian',
            status: 'ACTIVE',
            email: 'lib@school.edu',
            permissions: null,
          },
          error: null,
        }),
      });

      const results = await Promise.all(Array.from({ length: 50 }, () => getMe()));
      expect(results).toHaveLength(50);
      for (const res of results) {
        expect(res).not.toBeNull();
        expect(res?.role).toBe('librarian');
        expect(res?.isStaff).toBe(true);
      }
    });
  });

  describe('2. lib/auth-helpers.ts: getPreferences() Adversarial Tests', () => {
    it('returns empty object {} when visitor is unauthenticated (getMe returns null)', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const prefs = await getPreferences();
      expect(prefs).toEqual({});
    });

    it('returns empty object {} without crashing when database query throws', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: { id: 'usr-pref', app_metadata: {} } },
        error: null,
      });

      // Mock profiles lookup
      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'usr-pref', role: 'student', status: 'ACTIVE' },
          error: null,
        }),
      });

      // Mock ui_preferences lookup throwing an error
      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockRejectedValue(new Error('relation ui_preferences does not exist')),
      });

      const prefs = await getPreferences();
      expect(prefs).toEqual({});
    });

    it('returns empty object {} when ui_preferences returns a DB error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: { id: 'usr-pref', app_metadata: {} } },
        error: null,
      });

      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'usr-pref', role: 'student', status: 'ACTIVE' },
          error: null,
        }),
      });

      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'permission denied for table ui_preferences' },
        }),
      });

      const prefs = await getPreferences();
      expect(prefs).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTH-HELPERS] Failed to fetch preferences:',
        'permission denied for table ui_preferences'
      );
      consoleErrorSpy.mockRestore();
    });

    it('returns preferences when record exists and has valid json data', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: { id: 'usr-pref', app_metadata: {} } },
        error: null,
      });

      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'usr-pref', role: 'student', status: 'ACTIVE' },
          error: null,
        }),
      });

      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { preferences: { fontSize: 'large', highContrast: true } },
          error: null,
        }),
      });

      const prefs = await getPreferences();
      expect(prefs).toEqual({ fontSize: 'large', highContrast: true });
    });
  });

  describe('3. lib/auth-helpers.ts: getUserRole() and assertRole() Edge Cases', () => {
    it('getUserRole returns null when unauthenticated', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const role = await getUserRole();
      expect(role).toBeNull();
    });

    it('assertRole throws "Unauthorized" if user is not logged in', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(assertRole(['student', 'super_admin'])).rejects.toThrow('Unauthorized');
    });

    it('assertRole throws "Forbidden" if user has non-permitted role', async () => {
      mockSupabaseInstance.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1', app_metadata: {} } },
        error: null,
      });
      mockSupabaseInstance.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'u1', role: 'student', status: 'ACTIVE' },
          error: null,
        }),
      });

      await expect(assertRole(['super_admin', 'librarian'])).rejects.toThrow('Forbidden');
    });
  });

  describe('4. Configuration: next.config.ts Verification', () => {
    it('evaluates next.config.ts headers() and asserts all OWASP security headers', async () => {
      const nextConfigModule = await import('../next.config');
      const nextConfig = nextConfigModule.default;

      expect(typeof nextConfig.headers).toBe('function');
      const headerRules = await nextConfig.headers!();
      expect(Array.isArray(headerRules)).toBe(true);
      expect(headerRules.length).toBeGreaterThanOrEqual(1);

      const allRouteRule = headerRules.find((r) => r.source === '/(.*)');
      expect(allRouteRule).toBeDefined();

      // Ensure regex pattern is valid and matches all paths
      // In next.js, source: '/(.*)' compiles to regex matching any path
      const regexp = pathToRegexp(allRouteRule!.source);
      expect(regexp.test('/')).toBe(true);
      expect(regexp.test('/dashboard')).toBe(true);
      expect(regexp.test('/api/cron')).toBe(true);
      expect(regexp.test('/books/123/edit')).toBe(true);

      const headersMap = new Map<string, string>();
      for (const h of allRouteRule!.headers) {
        headersMap.set(h.key, h.value);
      }

      // Check HSTS 2-year max-age (63072000 seconds)
      expect(headersMap.has('Strict-Transport-Security')).toBe(true);
      const hsts = headersMap.get('Strict-Transport-Security')!;
      expect(hsts).toContain('max-age=63072000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');

      // Check CSP
      expect(headersMap.has('Content-Security-Policy')).toBe(true);
      const csp = headersMap.get('Content-Security-Policy')!;
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('https://*.supabase.co');
      expect(csp).toContain('wss://*.supabase.co');
      expect(csp).toContain('https://covers.openlibrary.org');
      expect(csp).toContain('https://books.google.com');
      expect(csp).toContain('https://va.vercel-scripts.com');
      expect(csp).toContain('https://vitals.vercel-insights.com');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");

      // Check Permissions-Policy
      expect(headersMap.has('Permissions-Policy')).toBe(true);
      const permPolicy = headersMap.get('Permissions-Policy')!;
      expect(permPolicy).toContain('camera=(self)');
      expect(permPolicy).toContain('microphone=()');
      expect(permPolicy).toContain('geolocation=()');
      expect(permPolicy).toContain('browsing-topics=()');

      // Check standard OWASP headers
      expect(headersMap.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headersMap.get('X-Frame-Options')).toBe('DENY');
      expect(headersMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(headersMap.get('X-DNS-Prefetch-Control')).toBe('on');
      expect(headersMap.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
      expect(headersMap.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(headersMap.get('X-Permitted-Cross-Domain-Policies')).toBe('none');

      // Check Next.js server-level options
      expect(nextConfig.poweredByHeader).toBe(false);
      expect(nextConfig.experimental?.optimizePackageImports).toContain('recharts');
      expect(nextConfig.images?.minimumCacheTTL).toBe(86400);

      // Verify no insecure HTTP in remotePatterns
      const patterns = nextConfig.images?.remotePatterns || [];
      for (const p of patterns) {
        expect(p.protocol).toBe('https');
      }
    });

    it('verifies source pattern in next.config.ts does NOT contain accidental whitespace "/ (.*)"', () => {
      const nextConfigPath = path.resolve(process.cwd(), 'next.config.ts');
      const content = fs.readFileSync(nextConfigPath, 'utf8');

      // Strict check: source must be '/(.*)' and NOT '/ (.*)'
      expect(content).toContain("source: '/(.*)'");
      expect(content).not.toContain("source: '/ (.*)'");
    });
  });

  describe('5. Configuration: app/sitemap.ts Canonical Verification', () => {
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    afterEach(() => {
      if (originalSiteUrl !== undefined) {
        process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
      } else {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      }
    });

    it('falls back to https://stilumina.vercel.app when NEXT_PUBLIC_SITE_URL is unset', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;

      const entries = sitemap();
      expect(entries.length).toBe(3);

      const urls = entries.map((e) => e.url);
      expect(urls).toEqual([
        'https://stilumina.vercel.app',
        'https://stilumina.vercel.app/sign-up',
        'https://stilumina.vercel.app/search',
      ]);

      // Assert no duplicate root entry
      const rootEntries = urls.filter((u) => u === 'https://stilumina.vercel.app');
      expect(rootEntries.length).toBe(1);

      // Assert unique URLs
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(urls.length);
    });

    it('uses process.env.NEXT_PUBLIC_SITE_URL when provided', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-domain.org';

      const entries = sitemap();
      expect(entries.length).toBe(3);

      const urls = entries.map((e) => e.url);
      expect(urls).toEqual([
        'https://custom-domain.org',
        'https://custom-domain.org/sign-up',
        'https://custom-domain.org/search',
      ]);

      const rootEntries = urls.filter((u) => u === 'https://custom-domain.org');
      expect(rootEntries.length).toBe(1);
    });
  });

  describe('6. Configuration: vercel.json Validation', () => {
    it('validates syntax and schema conformance of vercel.json', () => {
      const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
      expect(fs.existsSync(vercelJsonPath)).toBe(true);

      const raw = fs.readFileSync(vercelJsonPath, 'utf8');
      const parsed = JSON.parse(raw);

      // Verify expected fields
      expect(parsed.$schema).toBe('https://openapi.vercel.sh/vercel.json');
      expect(parsed.framework).toBe('nextjs');
      expect(parsed.regions).toEqual(['sin1']);
      expect(Array.isArray(parsed.crons)).toBe(true);
      expect(parsed.crons).toEqual([
        {
          path: '/api/cron',
          schedule: '0 0 * * *',
        },
      ]);

      // Verify removed / forbidden legacy fields
      expect(parsed.cleanUrls).toBeUndefined();
      expect(parsed.headers).toBeUndefined();
    });
  });
});
