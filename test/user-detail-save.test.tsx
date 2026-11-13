import { act, type ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserDetailClient } from '@/app/(authenticated)/users/[id]/UserDetailClient';
import type { User } from '@/lib/types';
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn(), realtime: null as null | ((payload: unknown) => void) }));
vi.mock('next/navigation', () => { const router = { refresh: mocks.refresh }; return { useRouter: () => router }; });
vi.mock('@/lib/supabase/client', () => ({ createClient: () => {
  const channel = { on: vi.fn((_event, filter, handler) => { if (filter.table === 'profiles') mocks.realtime = handler; return channel; }), subscribe: vi.fn(() => channel) };
  return { channel: () => channel, removeChannel: vi.fn() };
} }));
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: { value: string; onValueChange: (value: string) => void; disabled?: boolean; children: ReactNode }) => <select value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, disabled }: { value: string; disabled?: boolean }) => <option value={value} disabled={disabled}>{value}</option>,
}));
const initial: User = { id: 'u1', name: 'Assistant', email: 'assistant@example.test', role: 'student_assistant', status: 'ACTIVE', department: 'Library', student_id: null, address: null, phone: null, avatarUrl: null, joined: 'Nov 2026', updatedAt: '2026-11-13T00:00:00Z', permissions: {} };
let root: Root;
let host: HTMLDivElement;
const save = () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Save Changes')!;
async function edit(selector: string, value: string) {
  const el = host.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  const prototype = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.fetch.mockReset(); mocks.refresh.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
  host = document.body.appendChild(document.createElement('div')); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it('disables Save initially, after reverting a role change, and immediately after a successful save', async () => {
  await act(async () => root.render(<UserDetailClient initialUser={initial} currentRole="super_admin" />));
  expect(save()).toBeDisabled();
  await edit('select', 'student'); expect(save()).toBeEnabled();
  await edit('select', 'student_assistant'); expect(save()).toBeDisabled();
  await edit('select', 'student');
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, user: { ...initial, role: 'student' } }) });
  await act(async () => save().click());
  const [, request] = mocks.fetch.mock.calls.find(([url]) => url === '/api/users')!;
  expect(JSON.parse(request.body)).toMatchObject({ student_id: '', address: '', phone: '' });
  expect(save()).toBeDisabled();
  await edit('select', 'student_assistant'); expect(save()).toBeEnabled();
  await edit('select', 'student'); expect(save()).toBeDisabled();
});
it('syncs refreshed profile props without manufacturing unsaved changes or overwriting edits', async () => {
  await act(async () => root.render(<UserDetailClient initialUser={initial} currentRole="super_admin" />));
  const updated = { ...initial, name: 'Updated assistant', permissions: { view_admin_dashboard: false } };
  await act(async () => root.render(<UserDetailClient initialUser={updated} currentRole="super_admin" />));
  expect(host.querySelector('input')).toHaveValue('Updated assistant');
  expect(save()).toBeDisabled();
  await edit('input', 'Unsaved name');
  await act(async () => root.render(<UserDetailClient initialUser={{ ...updated, phone: '09123456789' }} currentRole="super_admin" />));
  expect(host.querySelector('input')).toHaveValue('Unsaved name');
  expect(host.querySelector('input[placeholder="Contact number"]')).toHaveValue('09123456789');
  expect(save()).toBeEnabled();
});
it('labels the existing assistant permission Inventory and does not dirty the form when toggled back off', async () => {
  await act(async () => root.render(<UserDetailClient initialUser={initial} currentRole="super_admin" />));
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Manage Assistant Permissions'))!.click());
  const toggle = document.querySelector<HTMLButtonElement>('[aria-labelledby="perm-view_admin_dashboard-label"]')!;
  expect(document.getElementById('perm-view_admin_dashboard-label')).toHaveTextContent('Inventory');
  await act(async () => toggle.click()); expect(save()).toBeEnabled();
  await act(async () => toggle.click()); expect(save()).toBeDisabled();
});

it('accepts realtime saved profile updates while preserving an edited field', async () => {
  await act(async () => root.render(<UserDetailClient initialUser={initial} currentRole="super_admin" />));
  await edit('input', 'Draft assistant');
  await act(async () => mocks.realtime!({ eventType: 'UPDATE', new: { id: initial.id, full_name: 'Server assistant', email: initial.email, role: initial.role, status: 'ACTIVE', department: 'Research', permissions: { view_admin_dashboard: false } } }));
  expect(host.querySelector('input')).toHaveValue('Draft assistant');
  expect(host.querySelector('input[placeholder="e.g. IT, Admin"]')).toHaveValue('Research');
  expect(save()).toBeEnabled();
  await edit('input', 'Server assistant'); expect(save()).toBeDisabled();
});
it('keeps a failed save dirty and preserves edits made while a save is in flight', async () => {
  await act(async () => root.render(<UserDetailClient initialUser={initial} currentRole="super_admin" />));
  await edit('input', 'First edit');
  mocks.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, message: 'Save failed' }) });
  await act(async () => save().click()); expect(save()).toBeEnabled();
  let finish: (response: unknown) => void = () => {};
  mocks.fetch.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => save().click());
  await edit('input', 'Second edit');
  await act(async () => finish({ ok: true, json: async () => ({ ok: true, user: { ...initial, name: 'First edit' } }) }));
  expect(host.querySelector('input')).toHaveValue('Second edit');
  expect(save()).toBeEnabled();
  await edit('input', 'First edit'); expect(save()).toBeDisabled();
});
