import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, demoLoginRateLimiter } from '@/app/api/demo-login/route';

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signIn } }),
}));

const email = 'demo.aquino@alabang.sti.edu.ph';
const password = 'server-only-demo-password-5678';
const submit = (body: unknown) => POST(new Request('http://localhost/api/demo-login', {
  method: 'POST',
  body: JSON.stringify(body),
}));

describe('Quick Demo Access', () => {
  beforeEach(() => {
    vi.stubEnv('DEMO_ONLY', 'true');
    vi.stubEnv('DEMO_PASSWORD', password);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://demo.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'demo-publishable-key');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      disable_signup: true, external: { azure: false },
    })));
    signIn.mockReset();
    demoLoginRateLimiter.reset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('signs the approved demo account in with one click and server credentials', async () => {
    signIn.mockResolvedValue({ data: { user: { id: 'demo' } }, error: null });
    expect((await submit({ email })).status).toBe(200);
    expect(signIn).toHaveBeenCalledExactlyOnceWith({ email, password });
  });

  it('stays disabled outside demo mode', async () => {
    vi.stubEnv('DEMO_ONLY', '');
    expect((await submit({ email })).status).toBe(404);
    expect(signIn).not.toHaveBeenCalled();
  });

  it.each([
    { disable_signup: false, external: { azure: false } },
    { disable_signup: true, external: { azure: true } },
  ])('rejects public access if institutional account creation is still enabled', async (settings) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(settings));
    expect((await submit({ email })).status).toBe(503);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('fails closed when authentication settings cannot be verified', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'));
    expect((await submit({ email })).status).toBe(503);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects malformed requests and accounts outside the demo list', async () => {
    expect((await submit(null)).status).toBe(400);
    expect((await submit({ email: 'other@alabang.sti.edu.ph' })).status).toBe(400);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('throttles repeated attempts', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await submit({})).status).toBe(400);
    }
    expect((await submit({ email })).status).toBe(429);
    expect(signIn).not.toHaveBeenCalled();
  });
});
