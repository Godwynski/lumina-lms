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

const mockToggleAttendanceByCard = vi.fn();
const mockGetAttendanceHistory = vi.fn();
vi.mock('@/lib/actions/attendance', () => ({
  toggleAttendanceByCard: (...args: unknown[]) => mockToggleAttendanceByCard(...args),
  getAttendanceHistory: (...args: unknown[]) => mockGetAttendanceHistory(...args),
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
import { RoleBadge } from '@/components/common/RoleBadge';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { FieldGroup } from '@/components/common/FieldGroup';
import { Input } from '@/components/ui/input';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import { CategoryDialog } from '@/components/admin/categories/CategoryDialog';
import { CancelReservationDialog } from '@/components/catalog/CancelReservationDialog';

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
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

    it('renders accessible #attendance-card-id input and submits card check-in/check-out', async () => {
      const { container } = await renderStaffAttendance();

      const cardInput = container.querySelector('#attendance-card-id') as HTMLInputElement;
      expect(cardInput).toBeInTheDocument();
      const label = container.querySelector('label[for="attendance-card-id"]');
      expect(label).toHaveTextContent('Card ID or student number');

      const updatedRecord = makeAttendance({
        id: 'att-2',
        check_out_at: '2026-11-14T10:00:00Z',
      });
      mockToggleAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: {
          status: 'OUT',
          recordedAt: '2026-11-14T10:00:00Z',
          message: 'Checked out Maria Clara',
          description: 'Checked out successfully.',
          userName: 'Maria Clara',
        },
      });
      mockGetAttendanceHistory.mockResolvedValue([updatedRecord]);

      await typeIntoInput(cardInput, 'LIB-1001');
      await submitForm(cardInput.closest('form'));

      expect(mockToggleAttendanceByCard).toHaveBeenCalledWith({
        cardNumber: 'LIB-1001',
        isManual: true,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Transaction recorded',
        expect.objectContaining({ description: 'Checked out Maria Clara' })
      );
      expect(cardInput.value).toBe('');
    });

    it('opens Gate Attendance Scanner modal and restores focus to trigger on Escape', async () => {
      const { container } = await renderStaffAttendance();

      const trigger = findButtonByText(container, 'Start camera')!;
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

      await pressKey(dialog, 'Escape');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(document.body.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
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
          <RoleBadge role="admin" />
          <RoleBadge role="librarian" />
          <RoleBadge role="student_assistant" />
          <RoleBadge role="student" />
          <RoleBadge role="guest" />
        </div>
      );

      expect(container).toHaveTextContent('Active');
      expect(container).toHaveTextContent('Overdue');
      expect(container).toHaveTextContent('Returned');
      expect(container).toHaveTextContent('Ready');
      expect(container).toHaveTextContent('custom_state');
      expect(container).toHaveTextContent('Administrator');
      expect(container).toHaveTextContent('Librarian');
      expect(container).toHaveTextContent('Student Assistant');
      expect(container).toHaveTextContent('Student');
      expect(container).toHaveTextContent('guest');
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
