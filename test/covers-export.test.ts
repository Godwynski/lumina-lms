import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/catalog/export/covers/route';
import { getMe } from '@/lib/auth-helpers';
import { fetchImage } from '@/lib/fetch-image';
import JSZip from 'jszip';

vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getMe: vi.fn(),
}));
vi.mock('@/lib/fetch-image', () => ({ fetchImage: vi.fn() }));

// M22: bounded parallel downloads and unique file names.
describe('GET /api/catalog/export/covers', () => {
  it('downloads at most 10 covers at a time and gives every file a unique name', async () => {
    const books = Array.from({ length: 25 }, () => ({ title: 'Same Title', isbn: null, cover_url: 'https://x.test/c.png' }));
    const query = { select: () => query, not: () => Promise.resolve({ data: books, error: null }) };
    vi.mocked(getMe).mockResolvedValue({
      user: { id: 'lib-1' },
      profile: { id: 'lib-1', role: 'librarian', status: 'ACTIVE' },
      role: 'librarian',
      supabase: { from: () => query },
    } as unknown as Awaited<ReturnType<typeof getMe>>);

    let running = 0;
    let peak = 0;
    vi.mocked(fetchImage).mockImplementation(async () => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return { buffer: Buffer.from('img'), contentType: 'image/png' };
    });

    const res = await GET(new Request('http://localhost/api/catalog/export/covers'));
    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));

    expect(peak).toBeLessThanOrEqual(10);
    expect(Object.keys(zip.files).filter((n) => !n.endsWith('/'))).toHaveLength(25);
  });
});
