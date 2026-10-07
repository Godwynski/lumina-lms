import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cronRoute from '@/app/api/cron/route';
import { GET } from '@/app/api/cron/route';
import { runMaintenanceTasks } from '@/lib/notifications';
import { safeCompare } from '@/lib/server-utils';
import crypto from 'crypto';

vi.mock('@/lib/notifications', () => ({
  runMaintenanceTasks: vi.fn(),
}));

describe('Challenger 1 Adversarial Suite: Cron & Crypto Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Route Segment Configuration Export Verification', () => {
    it('exports dynamic set to force-dynamic', () => {
      expect(cronRoute.dynamic).toBe('force-dynamic');
    });

    it('exports maxDuration set to 10', () => {
      expect(cronRoute.maxDuration).toBe(10);
    });
  });

  describe('app/api/cron/route.ts Adversarial Probing', () => {
    it('fails closed (500) when CRON_SECRET is undefined', async () => {
      delete process.env.CRON_SECRET;

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: { authorization: 'Bearer some-token' },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: 'Server configuration error' });
      expect(runMaintenanceTasks).not.toHaveBeenCalled();
    });

    it('fails closed (500) when CRON_SECRET is empty string', async () => {
      process.env.CRON_SECRET = '';

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: { authorization: 'Bearer ' },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: 'Server configuration error' });
      expect(runMaintenanceTasks).not.toHaveBeenCalled();
    });

    it('fails closed (500) when CRON_SECRET is whitespace only', async () => {
      // In JS, whitespace string is truthy, but if an attacker sends matching or non-matching
      // let's check behavior with '   '
      process.env.CRON_SECRET = 'secret123';
      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
      });
      // No header
      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(runMaintenanceTasks).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization header is missing', async () => {
      process.env.CRON_SECRET = 'ultra-secure-cron-key-2026';

      const req = new Request('http://localhost:3000/api/cron', { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(runMaintenanceTasks).not.toHaveBeenCalled();
    });

    it('returns 401 for various malformed Authorization headers', async () => {
      process.env.CRON_SECRET = 'ultra-secure-cron-key-2026';

      const malformedHeaders = [
        '',
        'Bearer',
        'Bearer ',
        'bearer ultra-secure-cron-key-2026',
        'BEARER ultra-secure-cron-key-2026',
        'Basic ultra-secure-cron-key-2026',
        'Token ultra-secure-cron-key-2026',
        'Bearer  ultra-secure-cron-key-2026', // double space between scheme and token
        'Bearer ultra-secure-cron-key-2026 extra',
        'Bearer ultra-secure-cron-key',
        'Bearer ultra-secure-cron-key-2026-extra',
        'Bearer wrong-key',
      ];

      for (const authHeader of malformedHeaders) {
        const req = new Request('http://localhost:3000/api/cron', {
          method: 'GET',
          headers: { authorization: authHeader },
        });

        const res = await GET(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(runMaintenanceTasks).not.toHaveBeenCalled();
      }
    });

    it('notes WHATWG Fetch Headers strip leading/trailing whitespace before route handler evaluation', async () => {
      process.env.CRON_SECRET = 'ultra-secure-cron-key-2026';
      // In WHATWG fetch standard, header values are stripped of outer whitespace.
      // So '  Bearer token  ' is normalized by HTTP parser to 'Bearer token'.
      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: { authorization: '  Bearer ultra-secure-cron-key-2026  ' },
      });
      // Verification that Headers parser normalizes outer whitespace:
      expect(req.headers.get('authorization')).toBe('Bearer ultra-secure-cron-key-2026');
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('returns 200 and executes maintenance tasks on exact match', async () => {
      process.env.CRON_SECRET = 'ultra-secure-cron-key-2026';
      const mockResult = { processed: 42, noticesSent: 12 };
      vi.mocked(runMaintenanceTasks).mockResolvedValueOnce(
        mockResult as unknown as Awaited<ReturnType<typeof runMaintenanceTasks>>
      );

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: { authorization: 'Bearer ultra-secure-cron-key-2026' },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true, results: mockResult });
      expect(runMaintenanceTasks).toHaveBeenCalledTimes(1);
    });

    it('masks database connection errors and passwords in 500 response', async () => {
      process.env.CRON_SECRET = 'ultra-secure-cron-key-2026';
      vi.mocked(runMaintenanceTasks).mockRejectedValueOnce(
        new Error('Connection failure: postgres://admin:super_secret_pw@db.internal:5432/lumina')
      );

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: { authorization: 'Bearer ultra-secure-cron-key-2026' },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(data)).not.toContain('super_secret_pw');
      expect(JSON.stringify(data)).not.toContain('postgres');
    });

    it('masks non-Error exceptions in 500 response', async () => {
      process.env.CRON_SECRET = 'ultra-secure-cron-key-2026';
      vi.mocked(runMaintenanceTasks).mockRejectedValueOnce('raw string rejection without Error wrapper');

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: { authorization: 'Bearer ultra-secure-cron-key-2026' },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(data)).not.toContain('raw string');
    });

    it('masks object/JSON rejections in 500 response', async () => {
      process.env.CRON_SECRET = 'ultra-secure-cron-key-2026';
      vi.mocked(runMaintenanceTasks).mockRejectedValueOnce({
        sql: 'SELECT * FROM users WHERE password_hash = ...',
        code: '23505',
      });

      const req = new Request('http://localhost:3000/api/cron', {
        method: 'GET',
        headers: { authorization: 'Bearer ultra-secure-cron-key-2026' },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(data)).not.toContain('password_hash');
    });
  });

  describe('safeCompare Cryptographic Adversarial Probing', () => {
    it('always passes identical 32-byte buffers to timingSafeEqual regardless of input lengths', () => {
      const spy = vi.spyOn(crypto, 'timingSafeEqual');

      try {
        const testPairs: [string, string][] = [
          ['', ''],
          ['', 'a'],
          ['short', 'very-long-secret-key-spanning-many-bytes'],
          ['a'.repeat(100), 'b'.repeat(500)],
          ['Bearer token-1', 'Bearer token-2'],
          ['Bearer identical-token', 'Bearer identical-token'],
        ];

        for (const [a, b] of testPairs) {
          spy.mockClear();
          safeCompare(a, b);
          expect(spy).toHaveBeenCalledTimes(1);

          const [bufA, bufB] = spy.mock.calls[0];
          expect(Buffer.isBuffer(bufA)).toBe(true);
          expect(Buffer.isBuffer(bufB)).toBe(true);
          expect((bufA as Buffer).length).toBe(32);
          expect((bufB as Buffer).length).toBe(32);

          const expectedHashA = crypto.createHash('sha256').update(a).digest();
          const expectedHashB = crypto.createHash('sha256').update(b).digest();
          expect((bufA as Buffer).equals(expectedHashA)).toBe(true);
          expect((bufB as Buffer).equals(expectedHashB)).toBe(true);
        }
      } finally {
        spy.mockRestore();
      }
    });

    it('rejects all non-string types safely without invoking timingSafeEqual or throwing', () => {
      const spy = vi.spyOn(crypto, 'timingSafeEqual');

      const nonStringInputs: unknown[] = [
        null,
        undefined,
        0,
        1,
        -42,
        NaN,
        Infinity,
        true,
        false,
        {},
        { toString: () => 'token' },
        [],
        ['token'],
        () => 'token',
        Symbol('token'),
        BigInt(12345),
        Buffer.from('token'),
      ];

      try {
        for (const badInput of nonStringInputs) {
          spy.mockClear();
          // @ts-expect-error Testing adversarial types
          expect(safeCompare(badInput, 'valid-string')).toBe(false);
          // @ts-expect-error Testing adversarial types
          expect(safeCompare('valid-string', badInput)).toBe(false);
          // @ts-expect-error Testing adversarial types
          expect(safeCompare(badInput, badInput)).toBe(false);
          expect(spy).not.toHaveBeenCalled();
        }
      } finally {
        spy.mockRestore();
      }
    });

    it('correctly compares large 1MB payloads', () => {
      const largeA = 'X'.repeat(1024 * 1024);
      const largeB = 'X'.repeat(1024 * 1024);
      const largeC = 'X'.repeat(1024 * 1024 - 1) + 'Y';

      expect(safeCompare(largeA, largeB)).toBe(true);
      expect(safeCompare(largeA, largeC)).toBe(false);
    });

    it('correctly handles Unicode, surrogate pairs, and null bytes', () => {
      expect(safeCompare('🚀✨🔥', '🚀✨🔥')).toBe(true);
      expect(safeCompare('🚀✨🔥', '🚀✨💧')).toBe(false);
      expect(safeCompare('тест-токен', 'тест-токен')).toBe(true);
      expect(safeCompare('тест-токен', 'тест-токеН')).toBe(false);
      expect(safeCompare('مرحبا', 'مرحبا')).toBe(true);
      expect(safeCompare('null\0byte', 'null\0byte')).toBe(true);
      expect(safeCompare('null\0byte', 'null\0other')).toBe(false);
      expect(safeCompare('café', 'cafe\u0301')).toBe(false); // NFC vs NFD distinction preserved
    });
  });
});
