import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findDemoAccount, isDemoModeEnabled } from '@/lib/demo/config';

export const dynamic = 'force-dynamic';

// Signs a demo account in server-side so the password never reaches the browser.
export async function POST(request: Request) {
  if (!isDemoModeEnabled()) {
    return new NextResponse(null, { status: 404 });
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

  const [{ data: profile, error: profileError }, { data: card, error: cardError }] = await Promise.all([
    supabase.from('profiles')
      .select('email, full_name, role, status, student_id, department, phone, address, onboarding_completed, permissions')
      .eq('id', data.user.id).single(),
    supabase.from('library_cards').select('status, expires_at').eq('user_id', data.user.id).single(),
  ]);
  const permissionsMatch = Object.entries(account.permissions)
    .every(([key, allowed]) => Boolean(profile?.permissions?.[key]) === allowed);
  if (profileError || cardError || !profile || profile.email !== account.email ||
    profile.role !== account.role || profile.status !== 'ACTIVE' || !profile.onboarding_completed ||
    !profile.full_name || !profile.student_id || !profile.department || !profile.phone || !profile.address ||
    !permissionsMatch || card?.status !== 'ACTIVE' || !card.expires_at ||
    !(Date.parse(card.expires_at) > Date.now())) {
    await supabase.auth.signOut({ scope: 'local' });
    return NextResponse.json(
      { error: 'Demo profile, role, permissions, or library card needs repair. Ask the administrator to run demo:on.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
