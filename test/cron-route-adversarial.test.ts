import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/cron/route';
import { runMaintenanceTasks } from '@/lib/notifications';
import { safeCompare } from '@/lib/server-utils';
import crypto from 'crypto';

vi.mock('@/lib/notifications', () => ({
  runMaintenanceTasks: vi.fn(),
}));

describe('Cron Route & Timing-Safe Comparison Adversarial Verification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('safeCompare Timing Attack Resilience', () => {
    it('returns true for identical secrets', () => {
      const secret = 'Bearer super-secret-cron-token-xyz-12345';
      expect(safeCompare(secret, secret)).toBe(true);
      expect(safeCompare('', '')).toBe(true);
    });

    it('returns false for unequal strings of same length', () => {
      const a = 'Bearer super-secret-cron-token-xyz-12345';
      const b = 'Bearer super-secret-cron-token-xyz-12346';
      expect(safeCompare(a, b)).toBe(false);
    });

    it('returns false when prefix differs', () => {
      const a = 'Bearer super-secret-cron-token-xyz-12345';
      const b = 'Basic  super-secret-cron-token-xyz-12345';
      expect(safeCompare(a, b)).toBe(false);
    });

    it('returns false for unequal lengths', () => {
      const secret = 'Bearer super-secret-cron-token-xyz-12345';
      expect(safeCompare(secret, secret + 'x')).toBe(false);
      expect(safeCompare(secret, secret.slice(0, 10))).toBe(false);
      expect(safeCompare(secret, '')).toBe(false);
      expect(safeCompare('', secret)).toBe(false);
    });

    it('returns false for non-string inputs safely', () => {
      // @ts-expect-error testing invalid runtime inputs
      expect(safeCompare(null, 'secret')).toBe(false);
      // @ts-expect-error testing invalid runtime inputs
      expect(safeCompare('secret', undefined)).toBe(false);
      // @ts-expect-error testing invalid runtime inputs
      expect(safeCompare(12345, 12345)).toBe(false);
    });

    it('utilizes crypto.timingSafeEqual for constant-time evaluation', () => {
      const spy = vi.spyOn(crypto, 'timingSafeEqual');
      const a = 'Bearer token-abc-123';
      const b = 'Bearer token-abc-123';

      const result = safeCompare(a, b);
      expect(result).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('GET /api/cron Route Protection', () => {
    it('returns 401 when CRON_SECRET is set but Authorization header is absent', async () => {
      process.env.CRON_SECRET = 'production-secret-cron-key-999';

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(runMaintenanceTasks).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization token is incorrect', async () => {
      process.env.CRON_SECRET = 'production-secret-cron-key-999';

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer wrong-secret-token',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(runMaintenanceTasks).not.toHaveBeenCalled();
    });

    it('returns 401 when Bearer prefix is missing', async () => {
      process.env.CRON_SECRET = 'production-secret-cron-key-999';

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'production-secret-cron-key-999',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(runMaintenanceTasks).not.toHaveBeenCalled();
    });

    it('returns 200 and executes maintenance tasks when Authorization matches CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'production-secret-cron-key-999';
      const mockResults = { overdueNotices: 5, reservationsCleaned: 2 };
      vi.mocked(runMaintenanceTasks).mockResolvedValueOnce(
        mockResults as unknown as Awaited<ReturnType<typeof runMaintenanceTasks>>
      );

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer production-secret-cron-key-999',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.results).toEqual(mockResults);
      expect(runMaintenanceTasks).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when runMaintenanceTasks throws an unexpected error', async () => {
      process.env.CRON_SECRET = 'production-secret-cron-key-999';
      vi.mocked(runMaintenanceTasks).mockRejectedValueOnce(new Error('SMTP service down'));

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: {
          authorization: 'Bearer production-secret-cron-key-999',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('SMTP service down');
    });

    it('allows execution if CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      const mockResults = { maintenance: 'ok' };
      vi.mocked(runMaintenanceTasks).mockResolvedValueOnce(
        mockResults as unknown as Awaited<ReturnType<typeof runMaintenanceTasks>>
      );

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(runMaintenanceTasks).toHaveBeenCalledTimes(1);
    });
  });
});
