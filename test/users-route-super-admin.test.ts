import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/users/route';
import { getMe } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMockSupabaseClient } from '@/test/mocks/supabase';

vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getMe: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAuditActivity: vi.fn() }));

// M17: the only super admin must not demote or deactivate themselves.
describe('PATCH /api/users: super admin editing their own account', () => {
  const adminRow = { id: 'admin-1', role: 'super_admin', status: 'ACTIVE', email: 'admin.fac@alabang.sti.edu.ph' };

  beforeEach(() => {
    vi.clearAllMocks();
    const db = createMockSupabaseClient();
    db.setTableResponse('profiles', adminRow);
    const admin = createMockSupabaseClient();
    admin.setTableResponse('profiles', adminRow);
    vi.mocked(createAdminClient).mockReturnValue(admin.client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(getMe).mockResolvedValue({
      user: { id: 'admin-1' },
      profile: adminRow,
      role: 'super_admin',
      supabase: db.client,
    } as unknown as Awaited<ReturnType<typeof getMe>>);
  });

  const patch = (body: object) =>
    PATCH(new Request('http://localhost/api/users', { method: 'PATCH', body: JSON.stringify({ id: 'admin-1', ...body }) }), {
      params: Promise.resolve({}),
    });

  it.each([{ role: 'librarian' }, { status: 'ARCHIVED' }])('refuses %o', async (change) => {
    const res = await patch(change);
    expect(res.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('still saves their profile when role and status are unchanged', async () => {
    const res = await patch({ role: 'super_admin', status: 'active', phone: '+63 900 000 0001' });
    expect(res.status).toBe(200);
  });
});
