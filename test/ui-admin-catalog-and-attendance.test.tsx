import * as React from 'react';
import { Suspense, act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
  submitForm,
  pressKey,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: vi.fn(),
  },
}));

const mockRecordAttendanceByCard = vi.fn();
const mockGetAttendanceHistory = vi.fn();
vi.mock('@/lib/actions/attendance', () => ({
  recordAttendanceByCard: (...args: unknown[]) => mockRecordAttendanceByCard(...args),
  getAttendanceHistory: (...args: unknown[]) => mockGetAttendanceHistory(...args),
}));

const mockXlsxWriteFile = vi.fn();
const mockXlsxJsonToSheet = vi.fn((_rows?: unknown[]) => ({}));
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: (rows: unknown[]) => mockXlsxJsonToSheet(rows),
    book_new: () => ({}),
    book_append_sheet: vi.fn(),
  },
  writeFile: (...args: unknown[]) => mockXlsxWriteFile(...args),
}));

const mockGetBookAvailabilityStatus = vi.fn();
vi.mock('@/lib/actions/reservations', () => ({
  getBookAvailabilityStatus: (...args: unknown[]) => mockGetBookAvailabilityStatus(...args),
}));

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

import { AttendanceClient } from '@/app/(authenticated)/attendance/AttendanceClient';
import type { AttendanceRecord } from '@/lib/actions/attendance';
import { PolicyField } from '@/components/admin/policies/PolicyField';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LuminaTable, type LuminaColumn } from '@/components/common/LuminaTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RoleBadge, ROLE_LABELS, getRoleLabel } from '@/components/common/RoleBadge';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { FieldGroup } from '@/components/common/FieldGroup';
import { Input } from '@/components/ui/input';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import { CategoryDialog } from '@/components/admin/categories/CategoryDialog';
import { CancelReservationDialog } from '@/components/catalog/CancelReservationDialog';

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase()) ||
    btn.getAttribute('aria-label')?.toLowerCase() === text.toLowerCase()
  ) as HTMLButtonElement | undefined;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe('Admin, Catalog & Attendance UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    });
  });

  afterEach(() => {
    cleanupClients();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('AttendanceClient', () => {
    function makeAttendance(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
      return {
        id: 'att-1',
        user_id: 'stu-1',
        check_in_at: '2026-11-14T08:30:00Z',
        check_out_at: null,
        profiles: { full_name: 'Maria Clara', student_id: '2024-0001' },
        ...overrides,
      };
    }

    async function renderStaffAttendance(
      today: AttendanceRecord[] = [makeAttendance()],
      all: AttendanceRecord[] = [makeAttendance()]
    ) {
      const todayP = Promise.resolve(today);
      const allP = Promise.resolve(all);
      const personalP = Promise.resolve([]);

      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <Suspense fallback={<div>Loading...</div>}>
            <AttendanceClient
              systemTodayPromise={todayP}
              systemAllPromise={allP}
              personalHistoryPromise={personalP}
              isStaff={true}
              userId="staff-1"
            />
          </Suspense>
        );
      });
      await act(async () => {
        await Promise.all([todayP, allP, personalP]);
      });
      return handle;
    }

    async function chooseManualMode(root: ParentNode, label: string) {
      const trigger = root.querySelector('button[aria-label="Change attendance action"]')!;
      await pressKey(trigger, 'Enter');
      const items = [...document.body.querySelectorAll('[role="menuitemradio"]')];
      const item = items.find((entry) => entry.textContent === label);
      expect(item).toBeInTheDocument();
      await clickElement(item);
      await vi.waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(document.activeElement).toBe(root.querySelector('#attendance-card-id'));
      });
    }

    it('uses a split action to choose check-out without submitting and records the active mode on form submit', async () => {
      const { container } = await renderStaffAttendance();

      const cardInput = container.querySelector('#attendance-card-id') as HTMLInputElement;
      expect(cardInput).toBeInTheDocument();
      const label = container.querySelector('label[for="attendance-card-id"]');
      expect(label).toHaveTextContent('Card or patron ID');
      expect(findButtonByText(container, 'Scan QR')).toBeEnabled();
      expect(findButtonByText(container, 'Date range')).toHaveAttribute('aria-expanded', 'false');
      const submit = cardInput.form?.querySelector('button[type="submit"]');
      expect(submit).toHaveTextContent(/^Check in$/);
      expect(submit).toHaveClass('bg-primary');
      expect(submit).toBeDisabled();
      const menuTrigger = container.querySelector('button[aria-label="Change attendance action"]');
      expect(menuTrigger).toBeEnabled();
      expect(menuTrigger).toHaveAttribute('type', 'button');

      await chooseManualMode(container, 'Check out');
      expect(submit).toHaveTextContent(/^Check out$/);
      expect(submit).toBeDisabled();
      await typeIntoInput(cardInput, 'LIB-1001');
      await chooseManualMode(container, 'Check in');
      await chooseManualMode(container, 'Check out');
      expect(submit).toBeEnabled();
      expect(cardInput.value).toBe('LIB-1001');
      expect(mockRecordAttendanceByCard).not.toHaveBeenCalled();

      const updatedRecord = makeAttendance({
        id: 'att-2',
        check_out_at: '2026-11-14T10:00:00Z',
      });
      mockRecordAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: {
          status: 'OUT',
          outcome: 'CHECKED_OUT',
          userId: 'stu-1',
          recordedAt: '2026-11-14T10:00:00Z',
          message: 'Checked out Maria Clara',
          description: 'Checked out successfully.',
          userName: 'Maria Clara',
        },
      });
      mockGetAttendanceHistory.mockResolvedValue([updatedRecord]);
      mockGetAttendanceHistory.mockRejectedValueOnce(new Error('Today summary refresh failed'));

      await submitForm(cardInput.closest('form'));

      expect(mockRecordAttendanceByCard).toHaveBeenCalledWith({
        cardNumber: 'LIB-1001',
        mode: 'out',
        isManual: true,
      });
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(container.querySelector('[aria-label="Attendance controls"] [role="status"]')).toHaveTextContent('Checked out Maria Clara');
      expect(cardInput.value).toBe('');
    });

    it('leaves a rejected manual entry in place and shows the reason in the recording section', async () => {
      const { container } = await renderStaffAttendance();
      await clickElement(findButtonByText(container, 'Enter ID'));
      const entry = container.querySelector<HTMLInputElement>('#attendance-card-id')!;
      await typeIntoInput(entry, 'INVALID-CARD');
      mockRecordAttendanceByCard.mockResolvedValueOnce({ success: false, error: 'Card not found.' });
      await submitForm(entry.form);
      expect(container.querySelector('[aria-label="Attendance controls"] [role="alert"]')).toHaveTextContent('Card not found.');
      expect(entry).toHaveValue('INVALID-CARD');
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('keeps an error banner until it is dismissed with ×, and clears it when the ID is edited', async () => {
      const { container } = await renderStaffAttendance();
      await clickElement(findButtonByText(container, 'Enter ID'));
      const entry = container.querySelector<HTMLInputElement>('#attendance-card-id')!;
      const alert = () => container.querySelector('[aria-label="Attendance controls"] [role="alert"]');

      await typeIntoInput(entry, 'INVALID-CARD');
      mockRecordAttendanceByCard.mockResolvedValueOnce({ success: false, error: 'Card not found.' });
      await submitForm(entry.form);
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(alert()).toHaveTextContent('Card not found.');
      await clickElement(alert()!.querySelector('button[aria-label="Dismiss message"]'));
      expect(alert()).toBeNull();

      mockRecordAttendanceByCard.mockResolvedValueOnce({ success: false, error: 'Card not found.' });
      await submitForm(entry.form);
      expect(alert()).toHaveTextContent('Card not found.');
      await typeIntoInput(entry, 'INVALID-CARD-2');
      expect(alert()).toBeNull();
    });

    it('hides a success banner after 4 seconds and offers no dismiss button on it', async () => {
      const { container } = await renderStaffAttendance();
      await clickElement(findButtonByText(container, 'Enter ID'));
      const entry = container.querySelector<HTMLInputElement>('#attendance-card-id')!;
      await typeIntoInput(entry, 'LIB-1001');
      mockRecordAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: { status: 'IN', outcome: 'CHECKED_IN', userId: 'stu-7', userName: 'Ana Cruz', recordedAt: '2026-11-14T09:00:00Z', message: 'Checked in Ana Cruz', description: 'Timed in successfully.' },
      });
      vi.useFakeTimers();
      try {
        await submitForm(entry.form);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        const status = () => container.querySelector('[aria-label="Attendance controls"] [role="status"]');
        expect(status()).toHaveTextContent('Checked in Ana Cruz');
        expect(status()!.querySelector('button')).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(3900); });
        expect(status()).toHaveTextContent('Checked in Ana Cruz');
        await act(async () => { await vi.advanceTimersByTimeAsync(200); });
        expect(status()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('labels an updated check-in in the inline banner', async () => {
      const { container } = await renderStaffAttendance();
      await clickElement(findButtonByText(container, 'Enter ID'));
      const entry = container.querySelector<HTMLInputElement>('#attendance-card-id')!;
      await typeIntoInput(entry, 'LIB-1001');
      mockRecordAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: { status: 'IN', outcome: 'UPDATED', userId: 'stu-7', userName: 'Ana Cruz', recordedAt: '2026-11-14T09:00:00Z', message: 'Checked in Ana Cruz', description: 'Updated.' },
      });
      await submitForm(entry.form);
      expect(container.querySelector('[aria-label="Attendance controls"] [role="status"]')).toHaveTextContent('Check-in updated · Checked in Ana Cruz');
    });

    it('on camera failure shows only Retry camera and announces the reason to screen readers', async () => {
      const { container } = await renderStaffAttendance();
      await clickElement(findButtonByText(container, 'Scan QR'));
      const dialog = () => document.querySelector('[role="dialog"]')!;
      await vi.waitFor(() => expect(dialog().querySelector('[role="alert"]')).toHaveTextContent('Camera unavailable'));
      expect(dialog().querySelector('[role="alert"]')).toHaveClass('sr-only');
      expect(findButtonByText(dialog(), 'Enter ID instead')).toBeFalsy();
      expect(findButtonByText(dialog(), 'Retry camera')).toBeTruthy();
      expect(mockRecordAttendanceByCard).not.toHaveBeenCalled();
    });

    it('keeps the toolbar compact and switches between manual entry and filters without losing a draft', async () => {
      const { container } = await renderStaffAttendance();
      const disclosure = findButtonByText(container, 'Enter ID')!;
      const camera = findButtonByText(container, 'Scan QR')!;
      expect(disclosure).toHaveAttribute('aria-expanded', 'false');
      const form = container.querySelector('form[aria-label="Log attendance"]')!;
      expect(disclosure).toHaveAttribute('aria-controls', form.id);
      const field = form.querySelector('input')!;
      const toolbar = container.querySelector('[aria-label="Attendance controls"]')!;
      const filterToggle = findButtonByText(toolbar, 'Date range')!;
      const dates = toolbar.querySelector('form[aria-label="Date range"]')!;
      const sort = toolbar.querySelector('select[aria-label="Sort by"]')!;
      expect(toolbar.querySelectorAll('h2')).toHaveLength(0);
      expect(dates).not.toBeVisible();
      expect(sort).not.toBeVisible();
      await clickElement(disclosure);
      expect(disclosure).toHaveAttribute('aria-expanded', 'true');
      expect(document.activeElement).toBe(field);
      await typeIntoInput(field, 'LIB-1001');
      await clickElement(filterToggle);
      expect(disclosure).toHaveAttribute('aria-expanded', 'false');
      expect(filterToggle).toHaveAttribute('aria-expanded', 'true');
      expect(dates).toBeVisible();
      expect(sort).toBeVisible();
      expect(camera).toBeEnabled();
      const search = toolbar.querySelector('input[type="search"]');
      expect(search).toHaveAttribute('placeholder', 'Search logs');
      expect(camera.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await clickElement(disclosure);
      expect(filterToggle).toHaveAttribute('aria-expanded', 'false');
      expect(dates).not.toBeVisible();
      expect(field).toHaveValue('LIB-1001');
      expect(mockRecordAttendanceByCard).not.toHaveBeenCalled();
    });

    it('shows ALREADY_IN warning and disables Check-In for that person until they check out', async () => {
      const { container } = await renderStaffAttendance();
      const cardInput = container.querySelector('#attendance-card-id') as HTMLInputElement;
      const form = cardInput.closest('form')!;
      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

      mockRecordAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: {
          status: 'ALREADY_IN',
          outcome: 'ALREADY_IN',
          userId: 'stu-1',
          userName: 'Maria Clara',
          recordedAt: '2026-11-14T08:30:00Z',
          message: 'You are already checked in',
          description: 'Maria Clara is already checked in.',
        },
      });

      await typeIntoInput(cardInput, 'LIB-1001');
      await submitForm(form);

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('You are already checked in');
      expect(mockToastError).not.toHaveBeenCalled();
      // Check-In is disabled for Maria Clara
      expect(submitBtn).toBeDisabled();

      // Typing a different patron's ID re-enables Check-In for that other person
      await typeIntoInput(cardInput, 'LIB-2002');
      expect(submitBtn).not.toBeDisabled();

      // Re-typing Maria Clara's ID disables Check-In again until checkout
      await typeIntoInput(cardInput, 'LIB-1001');
      expect(submitBtn).toBeDisabled();

      // Switching to Check-Out enables submission so staff can check Maria Clara out
      await clickElement(findButtonByText(alert!, 'Switch to Check-Out'));
      expect(submitBtn).not.toBeDisabled();
      expect(submitBtn).toHaveTextContent(/^Check out$/);

      mockRecordAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: {
          status: 'OUT',
          outcome: 'CHECKED_OUT',
          userId: 'stu-1',
          userName: 'Maria Clara',
          recordedAt: '2026-11-14T10:00:00Z',
          message: 'Goodbye, Maria Clara!',
          description: 'Timed out successfully.',
        },
      });
      mockGetAttendanceHistory.mockResolvedValue([
        makeAttendance({ check_out_at: '2026-11-14T10:00:00Z' }),
      ]);
      await submitForm(form);

      // Warning cleared and Check-In for LIB-1001 is no longer blocked
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
      await chooseManualMode(container, 'Check in');
      await typeIntoInput(cardInput, 'LIB-1001');
      expect(submitBtn).not.toBeDisabled();
    });

    it('keeps attendance status and search in the logs while report actions live in Analytics', async () => {
      const autoClosedRecord = makeAttendance({
        id: 'att-auto',
        check_in_at: '2026-11-13T09:00:00Z',
        check_out_at: '2026-11-13T17:00:00Z',
        notes: 'No Log Out',
      });
      const normalRecord = makeAttendance({
        id: 'att-normal',
        check_in_at: '2026-11-14T08:00:00Z',
        check_out_at: '2026-11-14T11:00:00Z',
        notes: null,
      });

      const { container } = await renderStaffAttendance([autoClosedRecord, normalRecord], [autoClosedRecord, normalRecord]);
      expect(container).toHaveTextContent('No Log Out');

      expect(container.querySelector('[aria-label="Search attendance by patron name or ID"]')).toBeInTheDocument();
      expect(findButtonByText(container, 'Export (.xlsx)')).toBeUndefined();
      expect(container.querySelector('[aria-label="Attendance log actions"]')).toBeNull();
    });

    it('shows the Manila date, both times and checkout status together in a stacked log', async () => {
      const record = makeAttendance({ check_in_at: '2026-11-13T16:30:00Z', check_out_at: '2026-11-13T17:45:00Z', notes: 'No Log Out' });
      const { container } = await renderStaffAttendance([record], [record]);
      const log = container.querySelector('article')!;
      expect(log).toHaveTextContent('Maria Clara');
      expect(log).toHaveTextContent('2024-0001');
      expect(log).toHaveTextContent('Nov 14, 2026');
      expect(log).toHaveTextContent(/Check in\s*12:30 AM/);
      expect(log).toHaveTextContent(/Check out\s*01:45 AM/);
      expect(log).toHaveTextContent('No Log Out');
    });

    it('opens Gate Attendance Scanner modal and restores focus to trigger on Escape', async () => {
      const { container } = await renderStaffAttendance();

      const trigger = findButtonByText(container, 'Scan QR')!;
      expect(trigger).toBeDefined();
      // DialogContent checks getClientRects().length before restoring focus; simulate visible geometry in jsdom
      trigger.getClientRects = () =>
        [{ width: 100, height: 32, top: 0, left: 0, right: 100, bottom: 32 }] as unknown as DOMRectList;

      await act(async () => {
        trigger.focus();
      });
      await clickElement(trigger);

      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
      expect(document.body).toHaveTextContent('Gate Attendance Scanner');
      const scannerMode = dialog?.querySelector('[aria-label="Scanner attendance mode"]')!;
      expect(scannerMode).toHaveClass('mx-auto', 'sm:w-fit');
      const scannerOut = findButtonByText(scannerMode, 'Check-Out')!;
      await clickElement(scannerOut);
      expect(scannerOut).toHaveAttribute('aria-pressed', 'true');
      expect(scannerOut).toHaveClass('text-primary');
      expect(scannerOut).toHaveTextContent(/^Check-Out$/);

      await pressKey(dialog, 'Escape');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(document.body.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
      expect(container.querySelector('form[aria-label="Log attendance"] button[type="submit"]')).toHaveTextContent(/^Check out$/);
    });

    it('opens all history by default and applies or clears dates from a disclosure', async () => {
      const open = makeAttendance({ id: 'open', check_in_at: '2026-11-13T16:00:00Z' });
      const closed = makeAttendance({ id: 'closed', check_in_at: '2026-11-14T02:00:00Z', check_out_at: '2026-11-14T03:00:00Z' });
      const older = makeAttendance({ id: 'older', check_in_at: '2026-11-12T05:00:00Z', profiles: { full_name: 'Earlier Patron' } });
      const archive = makeAttendance({ id: 'archive', check_in_at: '2024-03-01T05:00:00Z', profiles: { full_name: 'Matching Patron' } });
      const all = [open, closed, older];
      const { container } = await renderStaffAttendance([open, closed], all);
      expect(container).not.toHaveTextContent('closed today');
      expect(findButtonByText(container, 'Today')).toBeUndefined();
      expect(findButtonByText(container, 'All History')).toBeUndefined();
      expect(container.querySelector('tbody')).toHaveTextContent('Earlier Patron');
      const filters = container.querySelector('[aria-label="Attendance controls"]')!;
      const toggle = findButtonByText(filters, 'Date range')!;
      const search = filters.querySelector<HTMLInputElement>('input[type="search"]')!;
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await clickElement(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const [from, to] = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
      expect(from).toBeVisible();
      await typeIntoInput(from, '2024-03-02');
      await typeIntoInput(to, '2024-03-01');
      await submitForm(from.form!);
      expect(container.querySelector('[role="alert"]')).toHaveTextContent('To date on or after the From date');
      expect(mockGetAttendanceHistory).not.toHaveBeenCalled();
      expect(container.querySelector('tbody')).toHaveTextContent('Earlier Patron');

      await typeIntoInput(from, '2024-03-01');
      mockGetAttendanceHistory.mockResolvedValueOnce([archive]);
      await submitForm(from.form!);
      await vi.waitFor(() => expect(container.querySelector('tbody')).toHaveTextContent('Matching Patron'));
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAccessibleName('Date range: Mar 1, 2024');
      expect(from).not.toBeVisible();
      expect(document.activeElement).toBe(toggle);
      expect(mockGetAttendanceHistory).toHaveBeenLastCalledWith(undefined, { range: 'all', limit: 300, dateRange: { from: '2024-03-01', to: '2024-03-01' } });

      vi.useFakeTimers();
      mockGetAttendanceHistory.mockResolvedValueOnce([]);
      await typeIntoInput(search, 'Earlier Patron');
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(mockGetAttendanceHistory).toHaveBeenLastCalledWith(undefined, {
        range: 'all', limit: 300, search: 'Earlier Patron', dateRange: { from: '2024-03-01', to: '2024-03-01' },
      });
      expect(container).toHaveTextContent('No logs found');
      expect(container).not.toHaveTextContent('Matching Patron');
      mockGetAttendanceHistory.mockResolvedValueOnce([older]);
      await clickElement(toggle);
      expect(filters.querySelector('form[aria-label="Date range"]')).toHaveTextContent('Mar 1, 2024');
      await clickElement(findButtonByText(filters, 'Clear dates'));
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(container.querySelector('tbody')).toHaveTextContent('Earlier Patron');
      expect(toggle).toHaveTextContent('Date range');
      expect(document.activeElement).toBe(toggle);
      expect(search).toHaveValue('Earlier Patron');
    });

    it('retries a failed date lookup and discards draft changes on Escape', async () => {
      const record = makeAttendance();
      const { container } = await renderStaffAttendance([record], [record]);
      const toggle = findButtonByText(container, 'Date range')!;
      await clickElement(toggle);
      const from = container.querySelector<HTMLInputElement>('input[type="date"]')!;
      await typeIntoInput(from, '2026-11-13');
      await pressKey(from, 'Escape');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(document.activeElement).toBe(toggle);
      await clickElement(toggle);
      expect(from).toHaveValue('');
      await typeIntoInput(from, '2026-11-14');
      mockGetAttendanceHistory.mockRejectedValueOnce(new Error('Network failure'));
      await submitForm(from.form!);
      await vi.waitFor(() => expect(container.querySelector('[role="alert"]:not([hidden])')).toHaveTextContent("Couldn't load attendance records"));
      mockGetAttendanceHistory.mockResolvedValueOnce([record]);
      await clickElement(findButtonByText(container, 'Retry'));
      await vi.waitFor(() => expect(container.querySelector('tbody')).toHaveTextContent('Maria Clara'));
      expect(findButtonByText(container, 'Retry')).toBeUndefined();
      expect(mockGetAttendanceHistory).toHaveBeenLastCalledWith(undefined, { range: 'all', limit: 300, dateRange: { from: '2026-11-14' } });
    });

    it('keeps staff search and dates, resets pagination, and requests a newly sorted database window', async () => {
      const initial = Array.from({ length: 12 }, (_, index) => makeAttendance({ id: `attendance-${index}` }));
      const oldest = makeAttendance({ id: 'older', profiles: { full_name: 'Oldest matching patron' } });
      const { container } = await renderStaffAttendance([], initial);
      const filters = container.querySelector('[aria-label="Attendance controls"]')!;
      expect(mockGetAttendanceHistory).not.toHaveBeenCalled();

      vi.useFakeTimers();
      mockGetAttendanceHistory.mockResolvedValue(initial);
      await typeIntoInput(filters.querySelector<HTMLInputElement>('input[type="search"]'), 'match');
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      await clickElement(findButtonByText(filters, 'Date range'));
      const from = filters.querySelector<HTMLInputElement>('input[type="date"]')!;
      await typeIntoInput(from, '2025-01-01');
      await submitForm(from.form!);
      await clickElement(container.querySelector('[aria-label="Next page"]'));
      expect(container.querySelector('[aria-label="Page 2 of 2"]')).toBeInTheDocument();
      mockGetAttendanceHistory.mockClear();
      const pending = Promise.withResolvers<AttendanceRecord[]>();
      mockGetAttendanceHistory.mockReturnValueOnce(pending.promise);
      await clickElement(container.querySelector('th button[aria-label="Sort by Check Out"]'));
      expect(mockGetAttendanceHistory).toHaveBeenCalledExactlyOnceWith(undefined, {
        range: 'all', limit: 300, search: 'match', sort: 'checkout-desc', dateRange: { from: '2025-01-01' },
      });
      expect(container.querySelector('[aria-busy="true"] tbody tr')).toHaveTextContent('Maria Clara');
      await act(async () => { pending.resolve([oldest, ...initial]); });
      expect(container.querySelector('tbody tr')).toHaveTextContent('Oldest matching patron');
      expect(container.querySelector('[aria-label="Page 1 of 2"]')).toBeInTheDocument();
      expect(container.querySelector('th[aria-sort="descending"]')).toHaveTextContent('Check Out');
    });

    it('renders personal student view with All-Time History and Still in library badge', async () => {
      const personalP = Promise.resolve([makeAttendance({ check_out_at: null })]);
      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <Suspense fallback={<div>Loading...</div>}>
            <AttendanceClient
              personalHistoryPromise={personalP}
              isStaff={false}
              userId="stu-1"
            />
          </Suspense>
        );
      });
      await act(async () => {
        await personalP;
      });

      expect(handle.container).toHaveTextContent('All-Time History');
      expect(handle.container).toHaveTextContent('Still in library');
      expect(handle.container.querySelector('#attendance-card-id')).not.toBeInTheDocument();
      expect(findButtonByText(handle.container, 'Enter ID')).toBeUndefined();
      expect(findButtonByText(handle.container, 'Scan QR')).toBeUndefined();
      expect(findButtonByText(handle.container, 'Date range')).toBeUndefined();
    });

    it('filters the personal history by a Manila date range and clears it (P2-ATT-002)', async () => {
      const personalP = Promise.resolve([
        makeAttendance({ id: 'new', check_in_at: '2026-11-14T08:30:00Z', check_out_at: '2026-11-14T09:30:00Z' }),
        makeAttendance({ id: 'old', check_in_at: '2024-03-01T00:30:00Z', check_out_at: '2024-03-01T03:45:00Z' }),
      ]);
      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <Suspense fallback={<div>Loading...</div>}>
            <AttendanceClient personalHistoryPromise={personalP} isStaff={false} userId="stu-1" />
          </Suspense>
        );
      });
      await act(async () => { await personalP; });

      const [fromInput, toInput] = Array.from(handle.container.querySelectorAll<HTMLInputElement>('input[type="date"]'));
      const rowCount = () => handle.container.querySelectorAll('tbody tr').length;
      expect(rowCount()).toBe(2);

      await typeIntoInput(fromInput, '2024-03-01');
      await typeIntoInput(toInput, '2024-03-01');
      expect(handle.container).toHaveTextContent('Filtered History');
      expect(rowCount()).toBe(1);
      expect(handle.container).toHaveTextContent('Mar 01, 2024');

      await clickElement(findButtonByText(handle.container, 'Clear dates'));
      expect(handle.container).toHaveTextContent('All-Time History');
      expect(rowCount()).toBe(2);
    });

    it('orders the full personal date result before slicing and keeps open sessions last both ways', async () => {
      const personalP = Promise.resolve([
        ...Array.from({ length: 11 }, (_, index) => {
          const day = String(12 - index).padStart(2, '0');
          return makeAttendance({ id: day, check_in_at: `2026-11-${day}T00:00:00Z`, check_out_at: `2026-11-${day}T02:00:00Z` });
        }),
        makeAttendance({ id: 'open', check_in_at: '2026-11-01T00:00:00Z' }),
        makeAttendance({ id: 'outside-filter', check_in_at: '2024-03-01T00:30:00Z', check_out_at: '2024-03-01T01:30:00Z' }),
      ]);
      const { container } = await renderClient(
        <Suspense fallback={<div>Loading...</div>}>
          <AttendanceClient personalHistoryPromise={personalP} userId="stu-1" />
        </Suspense>,
      );
      await act(async () => { await personalP; });
      await typeIntoInput(container.querySelector<HTMLInputElement>('input[type="date"]'), '2026-11-01');
      await clickElement(container.querySelector('[aria-label="Next page"]'));
      expect(container.querySelector('[aria-label="Page 2 of 2"]')).toBeInTheDocument();

      const sort = container.querySelector<HTMLSelectElement>('select[aria-label="Sort by"]')!;
      await act(async () => {
        sort.value = 'checkout-asc';
        sort.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(container.querySelector('tbody tr')).toHaveTextContent('Nov 02, 2026');
      expect(container.querySelector('th[aria-sort="ascending"]')).toHaveTextContent('Check Out');
      expect(container.querySelector('[aria-label="Page 1 of 2"]')).toBeInTheDocument();
      expect(container.querySelector('tbody')).not.toHaveTextContent('Still in library');

      await clickElement(container.querySelector('th[aria-sort="ascending"] button'));
      expect(container.querySelector('tbody tr')).toHaveTextContent('Nov 12, 2026');
      expect(container.querySelector('th[aria-sort="descending"]')).toHaveTextContent('Check Out');
      expect(container.querySelector('tbody')).not.toHaveTextContent('Still in library');
      await clickElement(container.querySelector('[aria-label="Next page"]'));
      expect(Array.from(container.querySelectorAll('tbody tr')).at(-1)).toHaveTextContent('Still in library');
      expect(mockGetAttendanceHistory).not.toHaveBeenCalled();
    });
  });

  describe('PolicyField', () => {
    it('displays PHP / Day unit for overdue_fine_per_day and validates numeric bounds', async () => {
      const onChange = vi.fn();
      const onInvalidChange = vi.fn();

      const handle = await renderClient(
        <TooltipProvider>
          <PolicyField
            policyKey="overdue_fine_per_day"
            value="5"
            initialValue="5"
            onChange={onChange}
            onInvalidChange={onInvalidChange}
            disabled={false}
            loading={false}
          />
        </TooltipProvider>
      );

      expect(handle.container).toHaveTextContent('Daily Overdue Fine');
      expect(handle.container).toHaveTextContent('PHP / Day');

      const input = handle.container.querySelector('input') as HTMLInputElement;
      expect(input).toHaveAttribute('aria-label', 'Daily Overdue Fine (php / day)');
      expect(input.labels?.[0]).toHaveTextContent('Daily Overdue Fine');
      // The unit sits beside the box, not overlaid on the number.
      const unit = input.nextElementSibling as HTMLElement;
      expect(unit).toHaveTextContent('PHP / Day');
      expect(unit.className).not.toContain('absolute');
      expect(input.className).not.toMatch(/\bpr-20\b/);

      // Valid numeric change
      await typeIntoInput(input, '15');
      expect(onInvalidChange).toHaveBeenLastCalledWith(false);
      expect(onChange).toHaveBeenLastCalledWith('15');
      expect(handle.container.querySelector('[role="alert"]')).toBeNull();

      // Out of max bounds (> 500)
      await typeIntoInput(input, '999');
      expect(onInvalidChange).toHaveBeenLastCalledWith(true);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(handle.container.querySelector('[role="alert"]')).toHaveTextContent('Only up to 500 allowed');

      // Empty string
      await typeIntoInput(input, '');
      expect(onInvalidChange).toHaveBeenLastCalledWith(true);
      expect(handle.container.querySelector('[role="alert"]')).toHaveTextContent('Enter a value.');
    });

    it('displays Days/Books units and Modified badge when value differs from initialValue', async () => {
      const handle = await renderClient(
        <TooltipProvider>
          <PolicyField
            policyKey="loan_period_days"
            value="21"
            initialValue="14"
            onChange={vi.fn()}
            disabled={false}
            loading={false}
          />
        </TooltipProvider>
      );
      expect(handle.container).toHaveTextContent('Days');
      expect(handle.container).toHaveTextContent('Modified');

      await handle.rerender(
        <TooltipProvider>
          <PolicyField
            policyKey="max_borrow_limit"
            value="5"
            initialValue="5"
            onChange={vi.fn()}
            disabled={false}
            loading={false}
          />
        </TooltipProvider>
      );
      expect(handle.container).toHaveTextContent('Books');
      expect(handle.container).not.toHaveTextContent('Modified');
    });

    it('renders time input for library_closing_time and validates 24-hour HH:MM format', async () => {
      const onChange = vi.fn();
      const onInvalidChange = vi.fn();

      const handle = await renderClient(
        <TooltipProvider>
          <PolicyField
            policyKey="library_closing_time"
            value="17:00"
            initialValue="17:00"
            onChange={onChange}
            onInvalidChange={onInvalidChange}
            disabled={false}
            loading={false}
          />
        </TooltipProvider>
      );

      expect(handle.container).toHaveTextContent('Library Closing Time');
      const input = handle.container.querySelector('input') as HTMLInputElement;
      expect(input).toHaveAttribute('type', 'time');
      expect(input).toHaveAttribute('aria-label', 'Library Closing Time');

      await typeIntoInput(input, '19:30');
      expect(onInvalidChange).toHaveBeenLastCalledWith(false);
      expect(onChange).toHaveBeenLastCalledWith('19:30');
      expect(handle.container.querySelector('[role="alert"]')).toBeNull();

      await typeIntoInput(input, '25:00');
      expect(onInvalidChange).toHaveBeenLastCalledWith(true);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(handle.container.querySelector('[role="alert"]')).toHaveTextContent('HH:MM');

      await typeIntoInput(input, '');
      expect(onInvalidChange).toHaveBeenLastCalledWith(true);
      expect(handle.container.querySelector('[role="alert"]')).toHaveTextContent('Enter a time');
    });
  });

  describe('Common & Catalog Components', () => {
    it('LuminaTable renders rows, handles click & keyboard Enter, and renders empty state action', async () => {
      interface Row {
        id: string;
        name: string;
      }
      const columns: LuminaColumn<Row>[] = [{ header: 'Name', accessor: 'name' }];
      const onRowClick = vi.fn();
      const onClear = vi.fn();

      const handle = await renderClient(
        <LuminaTable
          data={[{ id: '1', name: 'Clean Code' }]}
          columns={columns}
          onRowClick={onRowClick}
        />
      );

      const desktopRow = handle.container.querySelector('tbody tr');
      expect(desktopRow).toHaveTextContent('Clean Code');
      await clickElement(desktopRow);
      await pressKey(desktopRow, 'Enter');
      expect(onRowClick).toHaveBeenCalledTimes(2);
      expect(onRowClick).toHaveBeenCalledWith({ id: '1', name: 'Clean Code' });

      await handle.rerender(
        <LuminaTable
          data={[]}
          columns={columns}
          emptyState={{
            title: 'No books',
            description: 'Nothing here',
            action: { label: 'Reset', onClick: onClear },
          }}
        />
      );
      expect(handle.container).toHaveTextContent('No books');
      await clickElement(findButtonByText(handle.container, 'Reset'));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('StatusBadge and RoleBadge render normalized labels for known and fallback values', async () => {
      const { container } = await renderClient(
        <div>
          <StatusBadge status="ACTIVE" />
          <StatusBadge status="OVERDUE" />
          <StatusBadge status="RETURNED" />
          <StatusBadge status="READY" />
          <StatusBadge status="custom_state" />
          <RoleBadge role="super_admin" />
          <RoleBadge role="admin" />
          <RoleBadge role="librarian" />
          <RoleBadge role="library_staff" />
          <RoleBadge role="patron" />
          <RoleBadge role="guest" />
        </div>
      );

      expect(container).toHaveTextContent('Active');
      expect(container).toHaveTextContent('Overdue');
      expect(container).toHaveTextContent('Returned');
      expect(container).toHaveTextContent('Ready');
      expect(container).toHaveTextContent('custom_state');
      expect(container).toHaveTextContent('Super Admin');
      expect(container).toHaveTextContent('Administrator');
      expect(container).toHaveTextContent('Librarian');
      expect(container).toHaveTextContent('Library Staff');
      expect(container).toHaveTextContent('Patron');
      expect(container).toHaveTextContent('guest');
      expect(ROLE_LABELS.patron).toBe('Patron');
      expect(ROLE_LABELS.library_staff).toBe('Library Staff');
      expect(getRoleLabel('library_staff')).toBe('Library Staff');
      expect(getRoleLabel('patron')).toBe('Patron');
    });

    it('CompactPagination displays range and triggers onPageChange with boundary disabled states', async () => {
      const onPageChange = vi.fn();
      const handle = await renderClient(
        <CompactPagination page={1} totalItems={25} pageSize={10} onPageChange={onPageChange} />
      );

      expect(handle.container).toHaveTextContent('Showing 1-10 of 25');
      const prevBtn = handle.container.querySelector('button[aria-label="Previous page"]') as HTMLButtonElement;
      const nextBtn = handle.container.querySelector('button[aria-label="Next page"]') as HTMLButtonElement;
      expect(prevBtn).toBeDisabled();
      expect(nextBtn).not.toBeDisabled();

      await clickElement(nextBtn);
      expect(onPageChange).toHaveBeenCalledWith(2);

      await handle.rerender(
        <CompactPagination page={3} totalItems={25} pageSize={10} onPageChange={onPageChange} />
      );
      expect(handle.container).toHaveTextContent('Showing 21-25 of 25');
      expect(handle.container.querySelector('button[aria-label="Next page"]')).toBeDisabled();
    });

    it('NotificationItem marks read and routes on click, or delegates to onOpen when supplied', async () => {
      const onMarkRead = vi.fn();
      const onOpen = vi.fn();
      const notification = {
        id: 'notif-1',
        user_id: 'u-1',
        title: 'Overdue Notice',
        content: 'Please return your book.',
        type: 'OVERDUE' as const,
        priority: 'high' as const,
        is_read: false,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const handle = await renderClient(
        <NotificationItem notification={notification} onMarkRead={onMarkRead} />
      );

      expect(handle.container).toHaveTextContent('Unread: Overdue Notice');
      const markBtn = handle.container.querySelector('button[aria-label=\'Mark "Overdue Notice" as read\']');
      await clickElement(markBtn);
      expect(onMarkRead).toHaveBeenCalledWith('notif-1');
      expect(mockRouterPush).not.toHaveBeenCalled();

      const rowBtn = findButtonByText(handle.container, 'Overdue Notice');
      await clickElement(rowBtn);
      expect(onMarkRead).toHaveBeenCalledTimes(2);
      expect(mockRouterPush).toHaveBeenCalledWith('/history');

      await handle.rerender(
        <NotificationItem notification={notification} onMarkRead={onMarkRead} onOpen={onOpen} />
      );
      await clickElement(findButtonByText(handle.container, 'Overdue Notice'));
      expect(onOpen).toHaveBeenCalledWith(notification);
    });

    it('FieldGroup links Label htmlFor with Input via FieldControlIdContext', async () => {
      const { container } = await renderClient(
        <FieldGroup label="Library Card Number">
          <Input placeholder="Enter card" />
        </FieldGroup>
      );

      const label = container.querySelector('label');
      const input = container.querySelector('input');
      expect(label?.getAttribute('for')).toBeTruthy();
      expect(input?.getAttribute('id')).toBe(label?.getAttribute('for'));
    });

    it('ReserveTitleButton places reservation via API and displays ready/queue states', async () => {
      const onReserveSuccess = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, queue_position: 1 }),
      });
      vi.stubGlobal('fetch', fetchMock);
      mockGetBookAvailabilityStatus.mockResolvedValue({
        hasReservation: true,
        isReady: true,
        queuePosition: 1,
        holdExpiresAt: '2026-12-01T00:00:00Z',
        nextAvailableDate: null,
      });

      const handle = await renderClient(
        <ReserveTitleButton
          bookId="book-1"
          isAvailable={true}
          hasExistingReservation={false}
          onReserveSuccess={onReserveSuccess}
        />
      );

      const reserveBtn = findButtonByText(handle.container, 'Reserve for Pickup');
      expect(reserveBtn).toBeDefined();
      await clickElement(reserveBtn);

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/circulation/reservations',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ bookId: 'book-1' }) })
      );
      expect(onReserveSuccess).toHaveBeenCalledWith(1, 'READY', '2026-12-01T00:00:00Z');
      expect(handle.container).toHaveTextContent('Ready (Until');

      await handle.rerender(
        <ReserveTitleButton
          bookId="book-2"
          isAvailable={false}
          hasExistingReservation={true}
          queuePosition={3}
          isReady={false}
        />
      );
      expect(handle.container).toHaveTextContent('Your Queue #3');
    });

    it('CategoryDialog auto-generates slug for new categories and validates submission', async () => {
      const onSave = vi.fn();
      function DialogHarness() {
        const [formData, setFormData] = React.useState({
          name: '',
          slug: '',
          description: '',
        });
        return (
          <TooltipProvider>
            <CategoryDialog
              isOpen={true}
              onOpenChange={vi.fn()}
              editingId={null}
              formData={formData}
              setFormData={setFormData}
              onSave={onSave}
              loading={false}
              error={null}
            />
          </TooltipProvider>
        );
      }

      await renderClient(<DialogHarness />);

      const nameInput = document.body.querySelector('#name') as HTMLInputElement;
      const slugInput = document.body.querySelector('#slug') as HTMLInputElement;
      const saveBtn = findButtonByText(document.body, 'Add Category')!;
      expect(saveBtn).toBeDisabled();

      await typeIntoInput(nameInput, 'Computer Science');
      expect(slugInput.value).toBe('computer-science');
      expect(saveBtn).not.toBeDisabled();

      await clickElement(saveBtn);
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('CancelReservationDialog shows hold warning when isReady and invokes onConfirmCancel', async () => {
      const onConfirmCancel = vi.fn();
      await renderClient(
        <CancelReservationDialog
          open={true}
          onOpenChange={vi.fn()}
          bookTitle="Domain-Driven Design"
          isCancelling={false}
          onConfirmCancel={onConfirmCancel}
          isReady={true}
        />
      );

      expect(document.body).toHaveTextContent('Cancel Reservation?');
      expect(document.body).toHaveTextContent('currently held for you');
      expect(document.body).toHaveTextContent('Domain-Driven Design');

      await clickElement(findButtonByText(document.body, 'Yes, Cancel'));
      expect(onConfirmCancel).toHaveBeenCalledTimes(1);
    });
  });
});
