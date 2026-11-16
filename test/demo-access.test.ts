import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ACCOUNTS } from '@/lib/demo/config';
import { hasPermission } from '@/lib/auth/permissions';
import { POST, demoLoginRateLimiter } from '@/app/api/demo-login/route';

const { client, profile, card } = vi.hoisted(() => {
  const profile = { single: vi.fn() };
  const card = { single: vi.fn() };
  const client = {
    auth: { signInWithPassword: vi.fn(), signOut: vi.fn().mockResolvedValue({ error: null }) },
    from: vi.fn((table: string) => ({ select: () => ({ eq: () => table === 'profiles' ? profile : card }) })),
  };
  return { client, profile, card };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(client) }));

describe('demo identities', () => {
  it('uses school emails and complete biodata with IDs matching the email convention', () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(account.email).toMatch(/@alabang\.sti\.edu\.ph$/);
      const data = account as unknown as Record<string, unknown>;
      for (const key of ['fullName', 'studentId', 'department', 'phone', 'address', 'cardNumber']) {
        expect(data[key], `${account.role}: ${key}`).toBeTruthy();
      }
      const local = account.email.split('@')[0];
      const digits = local.match(/\d{6,}/)?.[0];
      expect(data.studentId).toBe(digits ? `STU-${digits}` : `FAC-${local.toUpperCase()}`);
      expect(account.cardNumber).not.toBe(data.studentId);
    }
  });

  it('gives the student assistant the permissions required by staff navigation', () => {
    const account = DEMO_ACCOUNTS.find(a => a.role === 'library_staff')!;
    for (const permissionKey of ['manage_circulation', 'manage_attendance', 'view_admin_dashboard'] as const) {
      expect(hasPermission(account.role, { href: '/', label: 'Staff', minRole: 'library_staff', permissionKey },
        { status: 'ACTIVE', permissions: account.permissions })).toBe(true);
    }
  });
});

describe('demo login', () => {
  afterEach(() => vi.unstubAllEnvs());
  const account = DEMO_ACCOUNTS.find(a => a.role === 'patron')!;
  const request = (body: unknown = { email: account.email }) => new Request('http://localhost/api/demo-login', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
  beforeEach(() => {
    demoLoginRateLimiter.reset();
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('DEMO_PASSWORD', 'test-password-only');
    vi.clearAllMocks();
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'demo' } }, error: null });
    profile.single.mockResolvedValue({ data: {
      email: account.email, role: account.role, status: 'ACTIVE', onboarding_completed: true,
      full_name: account.fullName, student_id: 'STU-20220271', department: 'BS Computer Science',
      phone: '+63 917 555 0104', address: 'Demo address', permissions: {},
    }, error: null });
    card.single.mockResolvedValue({ data: { status: 'ACTIVE', expires_at: '2126-01-01' }, error: null });
  });
  it('accepts a complete active demo account', async () => {
    expect((await POST(request())).status).toBe(200);
  });
  it('allows login after a demo account role or permissions change', async () => {
    const assistant = DEMO_ACCOUNTS.find(a => a.role === 'library_staff')!;
    profile.single.mockResolvedValue({ data: { role: 'patron', permissions: {} }, error: null });
    expect((await POST(request({ email: assistant.email }))).status).toBe(200);
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });
  it('rejects invalid credentials without querying profile data', async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid credentials' } });
    expect((await POST(request())).status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });
  it('rejects emails outside the configured demo accounts', async () => {
    expect((await POST(request({ email: 'someone@alabang.sti.edu.ph' }))).status).toBe(404);
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('handles a null JSON body', async () => {
    expect((await POST(request(null))).status).toBe(400);
  });
  it.each(['false', ''])('keeps demo login enabled when DEMO_MODE is %j during evaluation', async (value) => {
    vi.stubEnv('DEMO_MODE', value);
    expect((await POST(request())).status).toBe(200);
    expect(client.auth.signInWithPassword).toHaveBeenCalled();
  });

  const requestFromIp = (ip: string) => new Request('http://localhost/api/demo-login', {
    method: 'POST',
    body: JSON.stringify({ email: account.email }),
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
  });

  it('throttles repeated attempts from the same IP with a 429 and Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await POST(requestFromIp('203.0.113.5'))).status).toBe(200);
    }
    const blocked = await POST(requestFromIp('203.0.113.5'));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('does not attempt a sign-in once an IP is throttled', async () => {
    for (let i = 0; i < 5; i++) await POST(requestFromIp('203.0.113.6'));
    client.auth.signInWithPassword.mockClear();
    expect((await POST(requestFromIp('203.0.113.6'))).status).toBe(429);
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('keeps separate budgets per client IP', async () => {
    for (let i = 0; i < 5; i++) await POST(requestFromIp('203.0.113.7'));
    expect((await POST(requestFromIp('203.0.113.7'))).status).toBe(429);
    expect((await POST(requestFromIp('203.0.113.8'))).status).toBe(200);
  });
});
