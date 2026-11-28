import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findDemoAccount, isDemoModeEnabled } from '@/lib/demo/config';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Throttle sign-in attempts per client IP so the shared demo password cannot be
// brute-forced against the published demo account emails. Exported so tests can
// reset the in-memory window between cases.
export const demoLoginRateLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

async function signupIsDisabled() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;

  try {
    const response = await fetch(new URL('/auth/v1/settings', url), {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings.disable_signup === true && settings.external?.azure === false;
  } catch {
    return false;
  }
}

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

  const isForm = request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded');
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (isForm && (!origin || (origin !== requestOrigin && origin !== process.env.DEMO_LANDING_ORIGIN))) {
    return NextResponse.json({ error: 'Invalid sign-in origin' }, { status: 403 });
  }

  let email: unknown;
  try {
    if (isForm) {
      email = (await request.formData()).get('email');
    } else {
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }
      email = body.email;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const account = typeof email === 'string' ? findDemoAccount(email) : undefined;
  if (!account) {
    return NextResponse.json({ error: 'Unknown demo account. Use one of the listed demo accounts.' }, { status: 400 });
  }

  if (!(await signupIsDisabled())) {
    return NextResponse.json({ error: 'Demo sign-in is unavailable.' }, { status: 503 });
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: 'Demo is misconfigured' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password });
  if (error || !data.user) {
    return NextResponse.json(
      { error: 'Demo sign-in is unavailable.' },
      { status: 401 },
    );
  }

  if (isForm) return NextResponse.redirect(new URL('/dashboard', requestOrigin), 303);
  return NextResponse.json({ ok: true });
}
