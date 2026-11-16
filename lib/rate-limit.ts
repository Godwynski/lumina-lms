// Minimal in-memory fixed-window rate limiter for server routes.
// Scope: single-process throttling (e.g. brute-force protection on the demo-login
// endpoint). State lives in this module's memory, so it does not coordinate across
// serverless instances — adequate for slowing credential guessing, not a billing gate.

export type RateLimitResult = {
  /** Whether this request is permitted. */
  allowed: boolean;
  /** Requests still allowed in the current window (0 when blocked). */
  remaining: number;
  /** Milliseconds until the window resets (0 when allowed and fresh). */
  retryAfterMs: number;
};

export interface RateLimiter {
  /** Record a hit for `key` and report whether it is within the limit. */
  check(key: string, now?: number): RateLimitResult;
  /** Drop all tracked state. Intended for tests. */
  reset(): void;
}

type Entry = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  if (limit < 1) throw new Error('rate limiter: limit must be >= 1');
  if (windowMs < 1) throw new Error('rate limiter: windowMs must be >= 1');

  const hits = new Map<string, Entry>();

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      const entry = hits.get(key);

      // Fresh window: either first hit or the previous window has elapsed.
      if (!entry || now >= entry.resetAt) {
        // Opportunistic prune so a flood of distinct keys cannot grow unbounded.
        if (hits.size > MAX_TRACKED_KEYS) {
          for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
        }
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
      }

      if (entry.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
      }

      entry.count += 1;
      return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
    },
    reset() {
      hits.clear();
    },
  };
}

/**
 * Best-effort client IP for keying a limiter. Reads the first `x-forwarded-for`
 * hop (set by Vercel/most proxies) and falls back to `x-real-ip`, then a shared
 * bucket so a missing header fails closed into throttling rather than skipping it.
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
