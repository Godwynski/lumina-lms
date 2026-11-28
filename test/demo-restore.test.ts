import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, demoLoginRateLimiter } from '@/app/api/demo-login/route';

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signIn } }),
}));

const email = 'demo.aquino@alabang.sti.edu.ph';
const accessCode = 'evaluator-only-access-code-1234';
const password = 'server-only-demo-password-5678';
const submit = (body: unknown) => POST(new Request('http://localhost/api/demo-login', {
  method: 'POST',
  body: JSON.stringify(body),
}));

describe('Quick Demo Access', () => {
  beforeEach(() => {
    vi.stubEnv('DEMO_ACCESS_CODE', accessCode);
    vi.stubEnv('DEMO_PASSWORD', password);
    signIn.mockReset();
    demoLoginRateLimiter.reset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('signs the approved demo account in using only server credentials', async () => {
    signIn.mockResolvedValue({ data: { user: { id: 'demo' } }, error: null });
    expect((await submit({ email, accessCode })).status).toBe(200);
    expect(signIn).toHaveBeenCalledExactlyOnceWith({ email, password });
  });

  it('stays disabled without full server configuration', async () => {
    vi.stubEnv('DEMO_ACCESS_CODE', '');
    expect((await submit({ email, accessCode })).status).toBe(404);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects missing or incorrect access codes before authentication', async () => {
    expect((await submit({ email })).status).toBe(403);
    expect((await submit({ email, accessCode: password })).status).toBe(403);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects malformed requests and accounts outside the demo list', async () => {
    expect((await submit(null)).status).toBe(400);
    expect((await submit({ email: 'other@alabang.sti.edu.ph', accessCode })).status).toBe(400);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('throttles repeated attempts', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await submit({ email })).status).toBe(403);
    }
    expect((await submit({ email, accessCode })).status).toBe(429);
    expect(signIn).not.toHaveBeenCalled();
  });
});
