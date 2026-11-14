import { act, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { toggleAttendanceByCard, getAttendanceHistory } from '@/lib/actions/attendance';
import { AttendanceClient } from '@/app/(authenticated)/attendance/AttendanceClient';

vi.mock('@/lib/actions/attendance', () => ({
  toggleAttendanceByCard: vi.fn(),
  getAttendanceHistory: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  }),
}));
const { scan } = vi.hoisted(() => ({ scan: { onScan: async (_value: string) => {} } }));
vi.mock('@/hooks/use-scan-feedback', () => ({ useScanFeedback: () => ({ playScanCue: vi.fn() }) }));
vi.mock('@/hooks/use-scanner', () => ({
  useScanner: (options: { onScan: (value: string) => Promise<void> }) => { scan.onScan = options.onScan; return ({
    cameraOpen: false, startScanner: vi.fn(), stopCamera: vi.fn(),
    scannerId: 'test-scanner', cameraIssue: null,
  }); },
}));

it('does not register a camera read until the librarian confirms it', async () => {
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
 vi.mocked(getAttendanceHistory).mockResolvedValue([]);
 vi.mocked(toggleAttendanceByCard).mockResolvedValue({ success: true, data: { status: 'IN', userName: 'Student', recordedAt: new Date().toISOString(), message: 'Welcome', description: 'Timed in successfully.' } });
 const el = document.body.appendChild(document.createElement('div')); const root = createRoot(el); const records = Promise.resolve([]);
 try {
  await act(async () => root.render(<Suspense><AttendanceClient personalHistoryPromise={records} systemTodayPromise={records} systemAllPromise={records} isStaff userId="staff" /></Suspense>));
  await act(async () => el.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
  await act(async () => scan.onScan('CARD-123'));
  await act(async () => scan.onScan('DIFFERENT-CARD'));
  expect(toggleAttendanceByCard).not.toHaveBeenCalled();
  const register = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Register attendance'));
  expect(register).toBeDefined();
  await act(async () => { register!.click(); register!.click(); });
  expect(toggleAttendanceByCard).toHaveBeenCalledTimes(1);
  expect(toggleAttendanceByCard).toHaveBeenCalledWith({ cardNumber: 'CARD-123', isManual: false, confirmed: true });
 } finally { act(() => root.unmount()); el.remove(); }
});
