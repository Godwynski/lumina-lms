import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { GET, dynamic } from '@/app/(auth)/callback/route';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/library-card-assets.server', () => ({
  ensureStaticLibraryCardAssets: vi.fn().mockResolvedValue(true),
}));

describe('Auth Callback Route Handler (GET /callback)', () => {
  let mockSupabase: {
    auth: {
      exchangeCodeForSession: Mock;
      getUser: Mock;
      signOut: Mock;
    };
    from: Mock;
  };

  let mockAdmin: {
    from: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn(),
        getUser: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };
    (createClient as Mock).mockResolvedValue(mockSupabase);

    mockAdmin = {
      from: vi.fn(),
    };
    (createAdminClient as Mock).mockReturnValue(mockAdmin);
  });

  it('exports dynamic set to force-dynamic to guarantee fresh cookie evaluation', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('redirects to error page if no code and no providerError is given', async () => {
    const req = new Request('http://localhost:3000/callback');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/error?error=No%20code%20provided');
  });

  it('redirects to error page with providerError if present', async () => {
    const req = new Request('http://localhost:3000/callback?error_description=Access%20Denied');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/error?error=Access%20Denied');
  });

  it('redirects to error page when exchangeCodeForSession fails (e.g. PKCE verifier missing)', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: 'PKCE code verifier not found in storage' },
    });

    const req = new Request('http://localhost:3000/callback?code=bad-code');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/error?error=PKCE%20code%20verifier%20not%20found%20in%20storage');
  });

  it('successfully exchanges code, detects existing profile, and redirects to dashboard', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'neri.376375@alabang.sti.edu.ph',
        },
      },
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'user-123' },
            error: null,
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/callback?code=valid-code');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('respects x-forwarded-host header in production environments', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'neri.376375@alabang.sti.edu.ph',
        },
      },
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'user-123' },
            error: null,
          }),
        }),
      }),
    });

    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      const req = new Request('http://127.0.0.1:3000/callback?code=valid-code', {
        headers: {
          'x-forwarded-host': 'stilumina.vercel.app',
        },
      });
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://stilumina.vercel.app/dashboard');
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  it('rejects unapproved email domain, signs out, and redirects to restricted_access', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'intruder-123',
          email: 'stranger@gmail.com',
        },
      },
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });

    const req = new Request('http://localhost:3000/callback?code=valid-code');
    const res = await GET(req);

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/error?error=restricted_access');
  });

  it('provisions new profile for valid STI student email when profile is absent', async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'new-student-456',
          email: 'delacruz.123456@alabang.sti.edu.ph',
          user_metadata: {
            full_name: 'Juan Dela Cruz',
            avatar_url: 'https://example.com/avatar.png',
          },
        },
      },
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockAdmin.from.mockReturnValue({
      insert: insertMock,
    });

    const req = new Request('http://localhost:3000/callback?code=valid-code');
    const res = await GET(req);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-student-456',
        email: 'delacruz.123456@alabang.sti.edu.ph',
        full_name: 'Juan Dela Cruz',
        avatar_url: 'https://example.com/avatar.png',
        role: 'student',
        status: 'PENDING',
      })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });
});
