import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useNotifications } from '@/hooks/use-notifications';
import { createMockSupabaseClient } from '@/test/mocks/supabase';
const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: getClient }));
it('reloads notifications on subscription and deduplicates realtime inserts', async () => {
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
 const helper = createMockSupabaseClient();
 helper.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'student' } } } });
 helper.setTableResponse('notifications', [], null, 0);
 let subscribed: (status: string) => void = () => {};
 let inserted: (payload: unknown) => void = () => {};
 const channel = { on: vi.fn((_event, filter, callback) => { if (filter.event === 'INSERT') inserted = callback; return channel; }), subscribe: vi.fn(callback => { subscribed = callback; return channel; }) };
 getClient.mockReturnValue({ ...helper.client, channel: () => channel, removeChannel: vi.fn() });
 function Probe() { const { notifications } = useNotifications(); return <span>{notifications.length}</span>; }
 const el = document.body.appendChild(document.createElement('div')); const root = createRoot(el);
 try {
   await act(async () => root.render(<Probe />));
   const row = { id: 'n1', user_id: 'student', title: 'Notice', content: 'Message', is_read: false };
   helper.setTableResponse('notifications', [row], null, 1);
   await act(async () => subscribed('SUBSCRIBED'));
   expect(el).toHaveTextContent('1');
   await act(async () => inserted({ new: row }));
   expect(el).toHaveTextContent('1');
   helper.setTableResponse('notifications', [row, { ...row, id: 'n2' }], null, 2);
   await act(async () => window.dispatchEvent(new Event('focus')));
   expect(el).toHaveTextContent('2');
 } finally { act(() => root.unmount()); el.remove(); }
});
