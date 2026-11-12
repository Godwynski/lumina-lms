import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/notifications/bulk/route';
const { rpc, senderCopy } = vi.hoisted(() => ({ rpc: vi.fn(), senderCopy: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ getMe: async () => ({ user: { id: 'sender' }, profile: { status: 'ACTIVE' }, role: 'librarian', supabase: { rpc } }) }));
vi.mock('@/lib/notifications', () => ({ sendNotification: senderCopy, sendBulkNotifications: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: 2, error: null }); });
it.each(['students', 'all'])('sends only to the selected %s audience', async target => {
 const result = await POST(new Request('http://localhost/api/notifications/bulk', { method: 'POST', body: JSON.stringify({ target, title: 'Notice', content: 'Message' }) }));
 expect(result.status).toBe(200);
 expect(await result.json()).toMatchObject({ success: true, count: 2 });
 expect(rpc).toHaveBeenCalledWith('send_bulk_notifications_by_target', expect.objectContaining({ p_target: target }));
 expect(senderCopy).not.toHaveBeenCalled();
});
it('reports an empty audience without claiming delivery', async () => {
 rpc.mockResolvedValue({ data: 0, error: null });
 const result = await POST(new Request('http://localhost/api/notifications/bulk', { method: 'POST', body: JSON.stringify({ target: 'students', title: 'Notice', content: 'Message' }) }));
 expect(result.status).toBe(400);
});
