import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/admin/audit-logs/import/route';
import { getMe } from '@/lib/auth-helpers';

vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getMe: vi.fn(),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(),
}));
const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ insert }) }) }));

// M16: an imported file must not be able to say who did what.
describe('POST /api/admin/audit-logs/import', () => {
  it('attributes imported rows to the importer and marks them imported', async () => {
    vi.mocked(getMe).mockResolvedValue({
      user: { id: 'importer-1', email: 'admin@x' },
      profile: { id: 'importer-1', role: 'super_admin', status: 'ACTIVE', email: 'admin@x' },
      role: 'super_admin',
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof getMe>>);

    const logs = [{ entity_type: 'book', action: 'delete', admin_id: 'someone-else', details: { note: 'x' } }];
    const res = await POST(new Request('http://localhost/api/admin/audit-logs/import', { method: 'POST', body: JSON.stringify({ logs }) }));

    expect(res.status).toBe(200);
    expect(insert.mock.calls[0][0][0]).toMatchObject({
      admin_id: 'importer-1',
      details: { note: 'x', imported: true, original_admin_id: 'someone-else' },
    });
  });
});
