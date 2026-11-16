import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findDemoAccount, isDemoModeEnabled } from '@/lib/demo/config';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Throttle sign-in attempts per client IP so the shared demo password cannot be
// brute-forced against the published demo account emails. Exported so tests can
// reset the in-memory window between cases.
export const demoLoginRateLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

// Signs a demo account in server-side so the password never reaches the browser.
export async function POST(request: Request) {
  if (!isDemoModeEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const limit = demoLoginRateLimiter.check(clientIp(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const account = typeof body.email === 'string' ? findDemoAccount(body.email) : undefined;
  if (!account) {
    return new NextResponse(null, { status: 404 });
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: 'Demo is misconfigured' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password });
  if (error || !data.user) {
    return NextResponse.json(
      { error: 'Demo account is not set up. Ask the administrator to run demo:on.' },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
