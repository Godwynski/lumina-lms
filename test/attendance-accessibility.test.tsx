import { act, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
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
vi.mock('@/hooks/use-scanner', () => ({
  useScanner: () => ({
    cameraOpen: false, startScanner: vi.fn(), stopCamera: vi.fn(),
    scannerId: 'test-scanner', cameraIssue: 'Camera permission denied.',
  }),
}));

it('keeps initial focus and returns focus to the attendance scanner trigger after Escape', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const records = Promise.resolve([]);
  try {
    await act(async () => root.render(
      <Suspense><AttendanceClient personalHistoryPromise={records} systemTodayPromise={records}
        systemAllPromise={records} isStaff userId="demo" /></Suspense>
    ));
    expect(document.activeElement).toBe(document.body);
    expect(container.querySelector('#attendance-card-id')).toHaveAccessibleName('Card ID or student number');
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
    trigger.focus();
    await act(async () => trigger.click());
    expect(document.querySelector('[role="dialog"]')).toHaveAccessibleName('Gate Attendance Scanner');
    expect(document.querySelector('[role="alert"]')).toHaveTextContent('Camera permission denied.');
    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(trigger).toHaveFocus();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
