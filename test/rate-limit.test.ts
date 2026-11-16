import { describe, expect, it } from 'vitest';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

describe('createRateLimiter', () => {
  it('allows requests up to the limit then blocks within the window', () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
    const now = 10_000;
    expect(rl.check('ip', now)).toMatchObject({ allowed: true, remaining: 2 });
    expect(rl.check('ip', now)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rl.check('ip', now)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = rl.check('ip', now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it('reports a shrinking retryAfter as the window elapses', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    rl.check('ip', 0);
    expect(rl.check('ip', 400).retryAfterMs).toBe(600);
    expect(rl.check('ip', 999).retryAfterMs).toBe(1);
  });

  it('starts a fresh window once the previous one expires', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.check('ip', 0).allowed).toBe(true);
    expect(rl.check('ip', 500).allowed).toBe(false);
    expect(rl.check('ip', 1000).allowed).toBe(true); // boundary is inclusive reset
    expect(rl.check('ip', 1500).allowed).toBe(false);
  });

  it('tracks each key independently', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.check('a', 0).allowed).toBe(true);
    expect(rl.check('b', 0).allowed).toBe(true);
    expect(rl.check('a', 0).allowed).toBe(false);
    expect(rl.check('b', 0).allowed).toBe(false);
  });

  it('reset() clears all state', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    rl.check('ip', 0);
    expect(rl.check('ip', 0).allowed).toBe(false);
    rl.reset();
    expect(rl.check('ip', 0).allowed).toBe(true);
  });

  it('rejects nonsensical configuration', () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
    expect(() => createRateLimiter({ limit: 5, windowMs: 0 })).toThrow();
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>) =>
    new Request('http://localhost/x', { headers });

  it('uses the first x-forwarded-for hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('fails closed to a shared bucket when no IP header is present', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });
});
