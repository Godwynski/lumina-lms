import * as React from 'react';
import { Suspense, act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
  submitForm,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
const mockRouterPush = vi.fn();
let mockSearchParamsString = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
    push: mockRouterPush,
  }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    delete rest.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={rest.alt ?? ''} {...rest} />;
  },
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

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockResolveScan = vi.fn();
const mockCheckoutBook = vi.fn();
const mockReturnBook = vi.fn();
vi.mock('@/lib/actions/circulation', () => ({
  resolveScan: (...args: unknown[]) => mockResolveScan(...args),
  checkoutBook: (...args: unknown[]) => mockCheckoutBook(...args),
  returnBook: (...args: unknown[]) => mockReturnBook(...args),
}));

const mockSettleBorrowingFine = vi.fn();
const mockExportBorrowingHistory = vi.fn();
vi.mock('@/lib/actions/history', () => ({
  settleBorrowingFine: (...args: unknown[]) => mockSettleBorrowingFine(...args),
  exportBorrowingHistory: (...args: unknown[]) => mockExportBorrowingHistory(...args),
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
const mockCancelReservation = vi.fn();
vi.mock('@/lib/actions/reservations', () => ({
  getBookAvailabilityStatus: (...args: unknown[]) => mockGetBookAvailabilityStatus(...args),
  cancelReservation: (...args: unknown[]) => mockCancelReservation(...args),
}));

const mockGetBookPublicDetails = vi.fn();
vi.mock('@/lib/actions/catalog', () => ({
  getBookPublicDetails: (...args: unknown[]) => mockGetBookPublicDetails(...args),
}));

const mockScannerStart = vi.fn();
const mockScannerStop = vi.fn();
const mockScannerClear = vi.fn();
const mockGetRunningTrackSettings = vi.fn();
let capturedQrSuccessCallback: ((text: string) => void | Promise<void>) | null = null;

vi.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class MockHtml5Qrcode {
    isScanning = true;
    start(
      _cam: unknown,
      _cfg: unknown,
      onSuccess: (text: string) => void | Promise<void>
    ) {
      capturedQrSuccessCallback = onSuccess;
      return mockScannerStart(_cam, _cfg);
    }
    stop() {
      return mockScannerStop();
    }
    clear() {
      return mockScannerClear();
    }
    getRunningTrackSettings() {
      return mockGetRunningTrackSettings();
    }
  },
}));

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

import { ReviewStep } from '@/components/circulation/steps/ReviewStep';
import { CirculationWizard } from '@/components/circulation/CirculationWizard';
import { MemberPreview } from '@/components/circulation/MemberPreview';
import { CirculationStepper } from '@/components/circulation/CirculationStepper';
import { ScanStep } from '@/components/circulation/steps/ScanStep';
import { SuccessStep } from '@/components/circulation/steps/SuccessStep';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import DigitalCard from '@/components/library/DigitalCard';
import HistoryContent from '@/app/(authenticated)/history/HistoryContent';
import type { BorrowingRecord } from '@/lib/actions/history';

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
  ) as HTMLButtonElement | undefined;
}

function findButtonByExactText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (btn) => btn.textContent?.trim() === text
  ) as HTMLButtonElement | undefined;
}

describe('Circulation & History UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsString = '';
    capturedQrSuccessCallback = null;
    mockScannerStart.mockResolvedValue(undefined);
    mockScannerStop.mockResolvedValue(undefined);
    mockGetRunningTrackSettings.mockReturnValue({ deviceId: 'cam-1' });
    mockGetBookAvailabilityStatus.mockResolvedValue({
      hasReservation: false,
      isReady: false,
      queuePosition: null,
      holdExpiresAt: null,
      nextAvailableDate: null,
    });
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
    vi.unstubAllGlobals();
  });

  describe('ReviewStep', () => {
    it('renders checkout details without overdue penalty banner', async () => {
      const { container } = await renderClient(
        <ReviewStep
          type="checkout"
          studentName="Maria Clara"
          studentId="2024-1001"
          copyCode="COPY-001"
          bookTitle="Refactoring"
          dueDate="Dec 01, 2026"
        />
      );

      expect(container).toHaveTextContent('Review Checkout');
      expect(container).toHaveTextContent('Maria Clara');
      expect(container).toHaveTextContent('2024-1001');
      expect(container).toHaveTextContent('COPY-001');
      expect(container).toHaveTextContent('Refactoring');
      expect(container).toHaveTextContent('Dec 01, 2026');
      expect(container).not.toHaveTextContent('Overdue Penalty:');
    });

    it('renders return details with overdue penalty banner when fineAmount > 0 and hides it when fineAmount === 0', async () => {
      const handle = await renderClient(
        <ReviewStep
          type="return"
          studentName="Juan Dela Cruz"
          copyCode="COPY-002"
          bookTitle="Clean Architecture"
          dueDate="Nov 10, 2026"
          borrowedAt="Nov 01, 2026"
          fineAmount={35}
          overdueDays={7}
        />
      );

      expect(handle.container).toHaveTextContent('Review Return');
      expect(handle.container).toHaveTextContent('Nov 01, 2026');
      expect(handle.container).toHaveTextContent('Overdue Penalty: ₱35.00 (7 day(s) overdue)');

      await handle.rerender(
        <ReviewStep
          type="return"
          studentName="Juan Dela Cruz"
          copyCode="COPY-002"
          bookTitle="Clean Architecture"
          dueDate="Nov 10, 2026"
          borrowedAt="Nov 01, 2026"
          fineAmount={0}
          overdueDays={0}
        />
      );

      expect(handle.container).not.toHaveTextContent('Overdue Penalty:');
    });
  });

  describe('CirculationWizard', () => {
    it('opens Overdue Penalty Settlement dialog when returning overdue copy (fineAmount > 0) and supports Return Only vs Mark as Paid vs Mark as Condoned', async () => {
      mockSearchParamsString = 'mode=return';
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'System Design',
          student_name: 'Ana Reyes',
          due_date: '2026-11-05T00:00:00Z',
          borrowed_at: '2026-10-20T00:00:00Z',
          fine_amount: 40,
          overdue_days: 8,
        },
      });

      const { container } = await renderClient(<CirculationWizard />);

      // Submit copy QR manually in step 1
      const input = container.querySelector('#circulation-code') as HTMLInputElement;
      const form = input.closest('form');
      await typeIntoInput(input, 'BOOK-QR-99');
      await submitForm(form);

      expect(container).toHaveTextContent('Review Return');
      expect(container).toHaveTextContent('Overdue Penalty: ₱40.00 (8 day(s) overdue)');

      // Click Confirm Return -> opens Overdue Penalty Settlement dialog
      const confirmBtn = findButtonByText(container, 'Confirm Return');
      await clickElement(confirmBtn);

      expect(document.body).toHaveTextContent('Overdue Penalty Settlement');
      const returnOnlyBtn = findButtonByText(document.body, 'Return Only (Pay Later)');
      const paidBtn = findButtonByText(document.body, 'Mark as Paid');
      const condonedBtn = findButtonByText(document.body, 'Mark as Condoned');
      expect(returnOnlyBtn).toBeDefined();
      expect(paidBtn).toBeDefined();
      expect(condonedBtn).toBeDefined();

      // Clicking Mark as Condoned without remarks shows validation error and stays open
      await clickElement(condonedBtn);
      expect(document.body.querySelector('[role="alert"]')).toHaveTextContent('at least 5 characters');
      expect(mockReturnBook).toHaveBeenCalledTimes(1);

      // Test Return Only (Pay Later) -> settleFine: false
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: { reservation_ready: false },
      });
      await clickElement(returnOnlyBtn);

      expect(mockReturnBook).toHaveBeenLastCalledWith({
        bookQr: 'BOOK-QR-99',
        idempotencyKey: expect.any(String),
        previewOnly: false,
        isManual: true,
        settleFine: false,
      });
      expect(container).toHaveTextContent('Return Complete');
    });

    it('calls returnBook with settleFine: true, resolution, and remarks when Mark as Paid or Mark as Condoned is chosen in the modal', async () => {
      mockSearchParamsString = 'mode=return';
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'Operating Systems',
          student_name: 'Pedro Santos',
          due_date: '2026-11-01T00:00:00Z',
          borrowed_at: '2026-10-15T00:00:00Z',
          fine_amount: 15,
          overdue_days: 3,
        },
      });

      const { container } = await renderClient(<CirculationWizard />);
      const input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'BOOK-QR-88');
      await submitForm(input.closest('form'));

      await clickElement(findButtonByText(container, 'Confirm Return'));
      expect(document.body).toHaveTextContent('Overdue Penalty Settlement');

      const remarksBox = document.body.querySelector('textarea') as HTMLTextAreaElement;
      await typeIntoInput(remarksBox, 'Library closed for holiday');

      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: { reservation_ready: true, reserved_for: 'Luz Mercado' },
      });
      await clickElement(findButtonByText(document.body, 'Mark as Condoned'));

      expect(mockReturnBook).toHaveBeenLastCalledWith({
        bookQr: 'BOOK-QR-88',
        idempotencyKey: expect.any(String),
        previewOnly: false,
        isManual: true,
        settleFine: true,
        resolution: 'CONDONED',
        remarks: 'Library closed for holiday',
      });
      expect(container).toHaveTextContent('Return Complete');
      expect(container).toHaveTextContent('Luz Mercado');
    });

    it('confirms return immediately without opening dialog when fineAmount === 0', async () => {
      mockSearchParamsString = 'mode=return';
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'On-Time Book',
          student_name: 'Elena Cruz',
          due_date: '2026-12-01T00:00:00Z',
          borrowed_at: '2026-11-10T00:00:00Z',
          fine_amount: 0,
          overdue_days: 0,
        },
      });

      const { container } = await renderClient(<CirculationWizard />);
      const input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'BOOK-ONTIME');
      await submitForm(input.closest('form'));

      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: { reservation_ready: false },
      });
      await clickElement(findButtonByText(container, 'Confirm Return'));

      expect(document.body).not.toHaveTextContent('Overdue Penalty Settlement');
      expect(mockReturnBook).toHaveBeenLastCalledWith({
        bookQr: 'BOOK-ONTIME',
        idempotencyKey: expect.any(String),
        previewOnly: false,
        isManual: true,
        settleFine: false,
      });
      expect(container).toHaveTextContent('Return Complete');
    });

    it('completes checkout wizard flow from student scan to book scan to confirmation', async () => {
      mockResolveScan.mockResolvedValueOnce({
        success: true,
        data: {
          type: 'student',
          data: {
            cardNumber: 'CARD-555',
            fullName: 'Jose Rizal',
            studentId: '2026-555',
            status: 'ACTIVE',
          },
        },
      });
      mockCheckoutBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'Noli Me Tangere',
          due_date: '2026-12-10T00:00:00Z',
        },
      });

      const { container } = await renderClient(<CirculationWizard />);
      let input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'CARD-555');
      await submitForm(input.closest('form'));

      expect(container).toHaveTextContent('Jose Rizal');

      input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'BK-NOLI');
      await submitForm(input.closest('form'));

      expect(container).toHaveTextContent('Review Checkout');
      mockCheckoutBook.mockResolvedValueOnce({ success: true, data: {} });
      await clickElement(findButtonByText(container, 'Confirm Checkout'));

      expect(container).toHaveTextContent('Checkout Complete');
    });

    it('supports Back navigation, Continue from MemberPreview, stepper step clicks, mode switching, and Start over reset', async () => {
      mockResolveScan.mockResolvedValueOnce({
        success: true,
        data: {
          type: 'student',
          data: {
            cardNumber: 'CARD-777',
            fullName: 'Melchora Aquino',
            studentId: '2026-777',
            status: 'ACTIVE',
          },
        },
      });
      mockCheckoutBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'El Filibusterismo',
          due_date: '2026-12-15T00:00:00Z',
        },
      });

      const { container } = await renderClient(<CirculationWizard />);

      // Scan student -> reaches Step 2
      const input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'CARD-777');
      await submitForm(input.closest('form'));
      expect(container).toHaveTextContent('Melchora Aquino');
      expect(container).toHaveTextContent('Scan item');

      // Click Back -> goes to Step 1 reviewingStudent state with Continue button
      await clickElement(findButtonByText(container, 'Back'));
      expect(container).toHaveTextContent('Continue');
      expect(container.querySelector('#circulation-code')).toBeNull();

      // Click Continue -> returns to Step 2
      await clickElement(findButtonByText(container, 'Continue'));
      expect(container).toHaveTextContent('Scan item');

      // Scan book -> reaches Step 3 (Review Checkout)
      const bookInput = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(bookInput, 'BK-FILI');
      await submitForm(bookInput.closest('form'));
      expect(container).toHaveTextContent('Review Checkout');
      expect(container).toHaveTextContent('Book / Item');
      expect(container).toHaveTextContent('Patron ID');

      // Click Step 1 in stepper -> returns to Step 1 reviewingStudent
      await clickElement(container.querySelector('button[aria-label="Go to step 1: Library card"]'));
      expect(container).toHaveTextContent('Continue');

      // Click Start over -> resets wizard back to clean Step 1
      await clickElement(findButtonByText(container, 'Start over'));
      expect(container).toHaveTextContent('Scan library card');
      expect(container).not.toHaveTextContent('Melchora Aquino');

      // Switch mode to Return and back to Checkout
      await clickElement(findButtonByExactText(container, 'Return'));
      expect(mockRouterReplace).toHaveBeenCalledWith('?mode=return');
      expect(container).toHaveTextContent('Scan item');

      await clickElement(findButtonByExactText(container, 'Checkout'));
      expect(mockRouterReplace).toHaveBeenCalledWith('?mode=checkout');
    });

    it('shows borrowing block panel at step 1 after card scan: library_staff sees only Start over', async () => {
      mockResolveScan.mockResolvedValueOnce({
        success: true,
        data: {
          type: 'student',
          data: {
            cardNumber: 'CARD-BLOCK-1',
            fullName: 'Andres Bonifacio',
            studentId: '2026-101',
            status: 'ACTIVE',
            block: { overdueCount: 2, receivableTotal: 25 },
          },
        },
      });

      const { container } = await renderClient(<CirculationWizard userRole="library_staff" />);
      const input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'CARD-BLOCK-1');
      await submitForm(input.closest('form'));

      expect(container).toHaveTextContent('Andres Bonifacio');
      expect(container).toHaveTextContent('Borrowing Restricted');
      expect(container).toHaveTextContent('2');
      expect(container).toHaveTextContent('₱25.00');
      // Still at step 1 (no book scan input)
      expect(container.querySelector('#circulation-code')).toBeNull();
      expect(findButtonByText(container, 'Start over')).toBeDefined();
      expect(findButtonByText(container, 'Override')).toBeUndefined();
      expect(findButtonByText(container, 'Continue')).toBeUndefined();

      await clickElement(findButtonByText(container, 'Start over'));
      expect(container).toHaveTextContent('Scan library card');
      expect(container).not.toHaveTextContent('Andres Bonifacio');
    });

    it('allows librarian to override block at step 1, validates short reason, and forwards reason to checkoutBook', async () => {
      mockResolveScan.mockResolvedValueOnce({
        success: true,
        data: {
          type: 'student',
          data: {
            cardNumber: 'CARD-BLOCK-2',
            fullName: 'Apolinario Mabini',
            studentId: '2026-102',
            status: 'ACTIVE',
            block: { overdueCount: 1, receivableTotal: 15 },
          },
        },
      });

      const { container } = await renderClient(<CirculationWizard userRole="librarian" />);
      const input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'CARD-BLOCK-2');
      await submitForm(input.closest('form'));

      expect(container).toHaveTextContent('Borrowing Restricted');
      expect(container).toHaveTextContent('₱15.00');

      await clickElement(findButtonByText(container, 'Override'));
      const reasonTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(reasonTextarea).toBeTruthy();

      // Short reason rejected inline and stays at step 1
      await typeIntoInput(reasonTextarea, 'too short');
      await clickElement(findButtonByText(container, 'Continue'));
      expect(container).toHaveTextContent('Override reason must be between 10 and 300 characters.');
      expect(container.querySelector('#circulation-code')).toBeNull();

      // Valid reason advances to step 2 (Scan item)
      await typeIntoInput(reasonTextarea, 'Librarian approved override for clearance');
      await clickElement(findButtonByText(container, 'Continue'));
      expect(container).toHaveTextContent('Scan item');
      expect(container).toHaveTextContent('Override active');

      // Scan book copy -> step 3 -> confirm checkout
      mockCheckoutBook.mockResolvedValueOnce({
        success: true,
        data: { book_title: 'Clean Architecture', due_date: '2026-12-20T00:00:00Z' },
      });
      const bookInput = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(bookInput, 'BK-CA-1');
      await submitForm(bookInput.closest('form'));

      expect(container).toHaveTextContent('Review Checkout');
      mockCheckoutBook.mockResolvedValueOnce({ success: true, data: {} });
      await clickElement(findButtonByText(container, 'Confirm Checkout'));

      expect(mockCheckoutBook).toHaveBeenLastCalledWith({
        studentCardQr: 'CARD-BLOCK-2',
        bookQr: 'BK-CA-1',
        idempotencyKey: expect.any(String),
        previewOnly: false,
        isManual: true,
        overrideReason: 'Librarian approved override for clearance',
      });
      expect(container).toHaveTextContent('Checkout Complete');
    });
  });

  describe('HistoryContent', () => {
    function makeRecord(overrides: Partial<BorrowingRecord> = {}): BorrowingRecord {
      return {
        id: 'rec-1',
        book_copy_id: 'copy-1',
        user_id: 'user-1',
        status: 'OVERDUE',
        borrowed_at: '2026-10-01T08:00:00Z',
        due_date: '2026-10-15T08:00:00Z',
        returned_at: null,
        fine_amount: 50,
        fine_settled_at: null,
        books: {
          id: 'book-1',
          title: 'Pragmatic Programmer',
          author: 'Hunt & Thomas',
          cover_url: null,
        },
        profiles: {
          id: 'user-1',
          full_name: 'Maria Clara',
          email: 'maria@sti.edu.ph',
          student_id: '2024-0001',
        },
        ...overrides,
      };
    }

    async function renderHistory(props: {
      records: BorrowingRecord[];
      statusFilter?: string;
      resolutionFilter?: string;
      userRole?: 'librarian' | 'patron';
      totalCount?: number;
    }) {
      const historyPromise = Promise.resolve({
        records: props.records,
        totalCount: props.totalCount ?? props.records.length,
      });

      let handle!: Awaited<ReturnType<typeof renderClient>>;
      await act(async () => {
        handle = await renderClient(
          <Suspense fallback={<div>Loading...</div>}>
            <HistoryContent
              historyPromise={historyPromise}
              page={1}
              statusFilter={props.statusFilter ?? 'all'}
              resolutionFilter={props.resolutionFilter}
              searchQuery=""
              userRole={props.userRole ?? 'librarian'}
            />
          </Suspense>
        );
      });
      // Allow use(historyPromise) resolution to flush
      await act(async () => {
        await historyPromise;
      });
      return handle;
    }

    it('renders all 5 filter tabs (including Settlements) and triggers router.replace keeping status=SETTLED', async () => {
      const { container } = await renderHistory({ records: [makeRecord()] });

      const tabButtons = ['All', 'Active', 'Overdue', 'Returned', 'Settlements'];
      for (const label of tabButtons) {
        const btn = Array.from(container.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === label
        );
        expect(btn).toBeDefined();
      }

      const overdueTab = findButtonByExactText(container, 'Overdue');
      await clickElement(overdueTab);
      expect(mockRouterReplace).toHaveBeenCalledWith('/history?status=OVERDUE&page=1', { scroll: false });

      const settlementsTab = findButtonByExactText(container, 'Settlements');
      await clickElement(settlementsTab);
      expect(mockRouterReplace).toHaveBeenCalledWith('/history?status=SETTLED&page=1', { scroll: false });
    });

    it('omits the Penalty column when statusFilter === "ACTIVE"', async () => {
      const { container } = await renderHistory({
        records: [makeRecord({ status: 'ACTIVE', due_date: '2099-12-31T00:00:00Z', fine_amount: 0 })],
        statusFilter: 'ACTIVE',
      });

      const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent?.trim());
      expect(headers).not.toContain('Penalty');
      expect(headers).toContain('Resource');
      expect(headers).toContain('Status');
    });

    it('shows Receivable badge + Return & Penalty Settlement dialog for unreturned overdue loans with Mark as Paid, Mark as Condoned, and Return Only', async () => {
      const record = makeRecord({ id: 'rec-accruing', returned_at: null, fine_amount: 50, fine_settled_at: null });
      const { container } = await renderHistory({ records: [record] });

      expect(container).toHaveTextContent('Receivable');
      expect(container).toHaveTextContent('₱50.00');

      const actionBtn = findButtonByText(container, 'Return / Settle');
      expect(actionBtn).toBeDefined();
      await clickElement(actionBtn);

      expect(document.body).toHaveTextContent('Return & Penalty Settlement');

      // Test return_only
      mockSettleBorrowingFine.mockResolvedValueOnce({ success: true, data: {} });
      await clickElement(findButtonByText(document.body, 'Return Only (Pay Later)'));
      expect(mockSettleBorrowingFine).toHaveBeenCalledWith({
        recordId: 'rec-accruing',
        mode: 'return_only',
      });
      expect(mockRouterRefresh).toHaveBeenCalled();

      // Re-open dialog and test Mark as Paid (return_and_settle)
      await clickElement(findButtonByText(container, 'Return / Settle'));
      mockSettleBorrowingFine.mockResolvedValueOnce({ success: true, data: {} });
      await clickElement(findButtonByText(document.body, 'Mark as Paid'));
      expect(mockSettleBorrowingFine).toHaveBeenCalledWith({
        recordId: 'rec-accruing',
        mode: 'return_and_settle',
        resolution: 'PAID',
      });
      expect(mockRouterRefresh).toHaveBeenCalledTimes(2);
    });

    it('shows Receivable badge + settlement dialog with Paid / Condoned validation on click for returned unpaid loans', async () => {
      const record = makeRecord({
        id: 'rec-unpaid',
        status: 'OVERDUE',
        returned_at: '2026-10-20T08:00:00Z',
        fine_amount: 25,
        fine_settled_at: null,
      });
      const { container } = await renderHistory({ records: [record] });

      expect(container).toHaveTextContent('Receivable');
      expect(container).toHaveTextContent('₱25.00');

      // Clicking the row opens the settlement dialog
      const row = container.querySelector('tbody tr');
      expect(row).not.toBeNull();
      await clickElement(row);
      expect(document.body).toHaveTextContent('Penalty Settlement');

      // Condoned without >= 5 chars remarks shows error and does not call action
      await clickElement(findButtonByText(document.body, 'Mark as Condoned'));
      expect(document.body.querySelector('[role="alert"]')).toHaveTextContent('at least 5 characters');
      expect(mockSettleBorrowingFine).not.toHaveBeenCalled();

      // Enter >= 5 chars remarks and click Mark as Condoned
      const remarksBox = document.body.querySelector('textarea') as HTMLTextAreaElement;
      await typeIntoInput(remarksBox, 'Waived for medical reason');
      mockSettleBorrowingFine.mockResolvedValueOnce({ success: true, data: {} });
      await clickElement(findButtonByText(document.body, 'Mark as Condoned'));

      expect(mockSettleBorrowingFine).toHaveBeenCalledWith({
        recordId: 'rec-unpaid',
        mode: 'settle',
        resolution: 'CONDONED',
        remarks: 'Waived for medical reason',
      });
      expect(mockRouterRefresh).toHaveBeenCalled();
    });

    it('renders Settlements filter (All / Paid / Condoned), columns, and read-only view for students', async () => {
      const paidRecord = makeRecord({
        id: 'rec-paid',
        status: 'RETURNED',
        returned_at: '2026-10-20T08:00:00Z',
        fine_amount: 30,
        fine_settled_at: '2026-10-21T08:00:00Z',
        fine_resolution: 'PAID',
        fine_remarks: 'Official receipt 0042',
      });
      const condonedRecord = makeRecord({
        id: 'rec-condoned',
        status: 'RETURNED',
        returned_at: '2026-10-22T08:00:00Z',
        fine_amount: 15,
        fine_settled_at: '2026-10-23T08:00:00Z',
        fine_resolution: 'CONDONED',
        fine_remarks: 'Approved by head librarian',
      });

      const { container } = await renderHistory({
        records: [paidRecord, condonedRecord],
        statusFilter: 'SETTLED',
        resolutionFilter: 'all',
        userRole: 'patron',
      });

      const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent?.trim());
      expect(headers).toEqual(['Resource', 'Fine Amount', 'Resolution', 'Remarks', 'Settled Date']);
      expect(container).toHaveTextContent('Official receipt 0042');
      expect(container).toHaveTextContent('Approved by head librarian');
      expect(container).toHaveTextContent('Paid');
      expect(container).toHaveTextContent('Condoned');
      expect(container.querySelector('textarea')).toBeNull();
      expect(findButtonByExactText(container, 'Settle')).toBeUndefined();

      // Clicking Paid / Condoned filter buttons updates URL resolution param
      const group = container.querySelector('[role="group"][aria-label="Filter settlements by resolution"]')!;
      await clickElement(findButtonByExactText(group, 'Paid'));
      expect(mockRouterReplace).toHaveBeenCalledWith('/history?status=SETTLED&resolution=PAID&page=1', { scroll: false });

      await clickElement(findButtonByExactText(group, 'Condoned'));
      expect(mockRouterReplace).toHaveBeenCalledWith('/history?status=SETTLED&resolution=CONDONED&page=1', { scroll: false });
    });

    it('renders Export (.xlsx) and Print buttons on Overdue and Settlements tabs and exports all filtered rows', async () => {
      const printSpy = vi.fn();
      vi.stubGlobal('print', printSpy);

      const overdueRecord = makeRecord({ id: 'rec-exp-1', fine_amount: 35, fine_settled_at: null });
      mockExportBorrowingHistory.mockResolvedValueOnce({
        success: true,
        data: { records: [overdueRecord], totalCount: 25 },
      });

      const { container } = await renderHistory({
        records: [overdueRecord],
        statusFilter: 'OVERDUE',
        userRole: 'librarian',
        totalCount: 25,
      });

      const exportBtn = findButtonByText(container, 'Export (.xlsx)');
      const printBtn = findButtonByText(container, 'Print');
      expect(exportBtn).toBeDefined();
      expect(printBtn).toBeDefined();

      await clickElement(printBtn);
      expect(printSpy).toHaveBeenCalledTimes(1);

      await clickElement(exportBtn);
      await act(async () => { await Promise.resolve(); });
      expect(mockExportBorrowingHistory).toHaveBeenCalledWith({
        status: 'OVERDUE',
        resolution: 'all',
        search: '',
        scope: 'logs',
      });
      expect(mockXlsxJsonToSheet).toHaveBeenCalled();
      expect(mockXlsxWriteFile).toHaveBeenCalledWith(expect.anything(), 'lumina_overdue_receivables.xlsx');
    });

    it('lets a patron export their own history from the All tab (personal scope, history filename) (P2-HIS-006)', async () => {
      const rec = makeRecord({ id: 'rec-own', fine_amount: 0 });
      mockExportBorrowingHistory.mockResolvedValueOnce({ success: true, data: { records: [rec], totalCount: 1 } });
      const { container } = await renderHistory({ records: [rec], statusFilter: 'all', userRole: 'patron', totalCount: 1 });

      await clickElement(findButtonByText(container, 'Export (.xlsx)'));
      await act(async () => { await Promise.resolve(); });
      expect(mockExportBorrowingHistory).toHaveBeenCalledWith({ status: 'all', resolution: 'all', search: '', scope: 'personal' });
      expect(mockXlsxWriteFile).toHaveBeenCalledWith(expect.anything(), 'lumina_borrowing_history.xlsx');
    });

    it('shows Paid/Condoned badge when fine_settled_at is set, hides action buttons for student role, and refreshes on realtime callback', async () => {
      const realtimeCallbacks: Array<() => void> = [];
      const mockChannel = {
        on: vi.fn().mockImplementation((_evt: string, _filter: unknown, cb: () => void) => {
          realtimeCallbacks.push(cb);
          return mockChannel;
        }),
        subscribe: vi.fn().mockReturnThis(),
      };
      mockCreateClient.mockReturnValue({
        channel: vi.fn().mockReturnValue(mockChannel),
        removeChannel: vi.fn(),
      });

      const settledRecord = makeRecord({
        id: 'rec-settled',
        status: 'RETURNED',
        returned_at: '2026-10-20T08:00:00Z',
        fine_amount: 30,
        fine_settled_at: '2026-10-21T08:00:00Z',
        fine_resolution: 'PAID',
      });
      const unpaidRecord = makeRecord({
        id: 'rec-student-unpaid',
        status: 'OVERDUE',
        returned_at: '2026-10-20T08:00:00Z',
        fine_amount: 20,
        fine_settled_at: null,
      });

      const { container } = await renderHistory({
        records: [settledRecord, unpaidRecord],
        userRole: 'patron',
      });

      expect(container).toHaveTextContent('Paid');
      expect(container).toHaveTextContent('Receivable');
      expect(findButtonByExactText(container, 'Settle')).toBeUndefined();
      expect(findButtonByExactText(container, 'Return / Settle')).toBeUndefined();

      // Trigger realtime postgres_changes callback
      expect(realtimeCallbacks.length).toBeGreaterThan(0);
      await act(async () => {
        realtimeCallbacks[0]();
      });
      expect(mockRouterRefresh).toHaveBeenCalled();
    });

    it('handles dialog Cancel, settle failure toast, borrower & book detail modals, and Clear All Filters', async () => {
      mockGetBookPublicDetails.mockResolvedValue({
        book: {
          id: 'book-1',
          title: 'Pragmatic Programmer',
          author: 'Hunt & Thomas',
          isbn: '9780201616224',
          cover_url: null,
          section: 'CS',
          location: 'Shelf 1',
          description: 'Classic book',
          available_copies: 1,
          total_copies: 1,
          categories: { name: 'CS' },
          tags: [],
          dewey_decimal: '005.1',
        },
        availability: {
          nextAvailableDate: null,
          hasReservation: false,
          isReady: false,
          queuePosition: null,
          holdExpiresAt: null,
          reservationId: null,
        },
      });

      const unreturnedRecord = makeRecord({
        id: 'rec-cancel-1',
        returned_at: null,
        fine_amount: 45,
        fine_settled_at: null,
      });
      const returnedUnpaid = makeRecord({
        id: 'rec-cancel-2',
        returned_at: '2026-10-20T08:00:00Z',
        fine_amount: 20,
        fine_settled_at: null,
      });

      const handle = await renderHistory({
        records: [unreturnedRecord, returnedUnpaid],
        userRole: 'librarian',
      });

      // Cancel Return & Penalty Settlement dialog
      await clickElement(findButtonByText(handle.container, 'Return / Settle'));
      expect(document.body).toHaveTextContent('Return & Penalty Settlement');
      await clickElement(findButtonByText(document.body, 'Cancel'));
      expect(document.body).not.toHaveTextContent('Return & Penalty Settlement');

      // Cancel Penalty Settlement dialog + error path on settle
      await clickElement(findButtonByExactText(handle.container, 'Settle'));
      expect(document.body).toHaveTextContent('Penalty Settlement');
      await clickElement(findButtonByText(document.body, 'Cancel'));
      expect(document.body).not.toHaveTextContent('Penalty Settlement');

      mockSettleBorrowingFine.mockResolvedValueOnce({ success: false, error: 'Already settled' });
      await clickElement(findButtonByExactText(handle.container, 'Settle'));
      await clickElement(findButtonByText(document.body, 'Mark as Paid'));
      expect(mockToastError).toHaveBeenCalledWith('Already settled');

      // Open BookDetailModal (read_only) from book title button
      const bookBtn = handle.container.querySelector('button[aria-label="View book details: Pragmatic Programmer"]');
      await clickElement(bookBtn);
      await act(async () => { await Promise.resolve(); });
      expect(mockGetBookPublicDetails).toHaveBeenCalledWith('book-1');
      expect(document.body).toHaveTextContent('Classic book');
      await clickElement(findButtonByExactText(document.body, 'Close'));

      // Open BorrowerDetailsModal from borrower button
      const borrowerBtn = handle.container.querySelector('button[aria-label="View borrower: Maria Clara"]');
      await clickElement(borrowerBtn);
      expect(document.body).toHaveTextContent('2024-0001');
      expect(document.body.querySelector('a[href="/users/user-1"]')).toBeInTheDocument();
      await clickElement(findButtonByExactText(document.body, 'Close'));

      // Empty state Clear All Filters
      const emptyPromise = Promise.resolve({ records: [], totalCount: 0 });
      await act(async () => {
        await handle.rerender(
          <Suspense fallback={<div>Loading...</div>}>
            <HistoryContent
              historyPromise={emptyPromise}
              page={1}
              statusFilter="OVERDUE"
              searchQuery="missing"
              userRole="librarian"
            />
          </Suspense>
        );
      });
      await act(async () => { await emptyPromise; });
      await clickElement(findButtonByText(handle.container, 'Clear All Filters'));
      expect(mockRouterReplace).toHaveBeenCalledWith('/history?page=1', { scroll: false });
    });
  });

  describe('Circulation Supporting Components & DigitalCard', () => {
    it('renders MemberPreview with verified student details', async () => {
      const { container } = await renderClient(
        <MemberPreview
          student={{
            cardNumber: 'LIB-2026',
            fullName: 'Gabriela Silang',
            studentId: '2026-0099',
            status: 'ACTIVE',
          }}
        />
      );

      expect(container).toHaveTextContent('Gabriela Silang');
      expect(container).toHaveTextContent('2026-0099');
      expect(container).toHaveTextContent('ACTIVE');
    });

    it('renders MemberPreview blocking summary and override reason when blocked', async () => {
      const { container, rerender } = await renderClient(
        <MemberPreview
          student={{
            cardNumber: 'LIB-2026',
            fullName: 'Gabriela Silang',
            studentId: '2026-0099',
            status: 'ACTIVE',
            block: { overdueCount: 2, receivableTotal: 45 },
          }}
        />
      );

      expect(container).toHaveTextContent('Borrowing Restricted');
      expect(container).toHaveTextContent('Overdue books');
      expect(container).toHaveTextContent('2');
      expect(container).toHaveTextContent('₱45.00');

      await rerender(
        <MemberPreview
          student={{
            cardNumber: 'LIB-2026',
            fullName: 'Gabriela Silang',
            studentId: '2026-0099',
            status: 'ACTIVE',
            block: { overdueCount: 2, receivableTotal: 45 },
          }}
          overrideReason="Approved by head librarian"
        />
      );

      expect(container).toHaveTextContent('Borrowing Block Overridden');
      expect(container).toHaveTextContent('Approved by head librarian');
    });

    it('renders CirculationStepper with aria-current and handles step clicks up to reachedStep', async () => {
      const onStepClick = vi.fn();
      const steps = [
        { id: 1, label: 'Student card' },
        { id: 2, label: 'Book copy' },
        { id: 3, label: 'Review checkout' },
      ];

      const { container } = await renderClient(
        <CirculationStepper
          steps={steps}
          currentStep={2}
          reachedStep={3}
          onStepClick={onStepClick}
        />
      );

      const buttons = Array.from(container.querySelectorAll('button'));
      expect(buttons[1]).toHaveAttribute('aria-current', 'step');
      expect(buttons[0]).toHaveAttribute('aria-label', 'Go to step 1: Student card');
      expect(buttons[2]).toHaveAttribute('aria-label', 'Go to step 3: Review checkout');

      await clickElement(buttons[0]);
      await clickElement(buttons[2]);
      expect(onStepClick).toHaveBeenCalledWith(1);
      expect(onStepClick).toHaveBeenCalledWith(3);
    });

    it('renders ScanStep and submits uppercased manual code', async () => {
      const onScan = vi.fn().mockResolvedValue(true);
      const { container } = await renderClient(
        <ScanStep
          title="Scan student card"
          description="Scan student library card."
          placeholder="Enter Card ID"
          onScan={onScan}
          isProcessing={false}
          actionLabel="Process"
        />
      );

      const input = container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'card-abc');
      expect(input.value).toBe('CARD-ABC');

      await submitForm(input.closest('form'));
      expect(onScan).toHaveBeenCalledWith('CARD-ABC', true);
      expect(input.value).toBe('');
    });

    it('ScanStep handles camera unavailable error, camera open/scan/switch/stop, and processing state', async () => {
      const onScan = vi.fn().mockResolvedValue(true);

      // 1. Camera unavailable (no navigator.mediaDevices)
      vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
      const handle = await renderClient(
        <ScanStep
          title="Scan book copy"
          description="Scan book QR."
          placeholder="Enter Book QR"
          onScan={onScan}
          isProcessing={false}
          actionLabel="Verify"
        />
      );

      await clickElement(findButtonByText(handle.container, 'Start camera'));
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(handle.container.querySelector('[role="alert"]')).toHaveTextContent('Camera unavailable');
      expect(findButtonByText(handle.container, 'Retry camera')).toBeDefined();

      // 2. Camera available with 2 devices -> open, decode callback, switch camera, stop camera
      const enumerateDevices = vi.fn().mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam-1' },
        { kind: 'videoinput', deviceId: 'cam-2' },
      ]);
      vi.stubGlobal('navigator', { ...navigator, mediaDevices: { enumerateDevices } });

      const input = handle.container.querySelector('#circulation-code') as HTMLInputElement;
      await typeIntoInput(input, 'DRAFT');

      await clickElement(findButtonByText(handle.container, 'Retry camera'));
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

      expect(mockScannerStart).toHaveBeenCalled();
      const switchBtn = handle.container.querySelector('button[aria-label="Switch camera"]') as HTMLButtonElement;
      expect(switchBtn.className).not.toContain('invisible');
      expect(findButtonByText(handle.container, 'Stop camera')).toBeDefined();

      // Trigger scanned QR value from html5-qrcode callback -> clears manual input
      await act(async () => {
        await capturedQrSuccessCallback?.('QR-CAMERA-1');
      });
      expect(onScan).toHaveBeenCalledWith('QR-CAMERA-1', false);
      expect(input.value).toBe('');

      // Switch camera to cam-2
      await clickElement(switchBtn);
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(mockScannerStart).toHaveBeenLastCalledWith('cam-2', expect.anything());

      // Stop camera
      await clickElement(findButtonByText(handle.container, 'Stop camera'));
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(mockScannerStop).toHaveBeenCalled();
      expect(findButtonByText(handle.container, 'Start camera')).toBeDefined();

      // 3. Processing state displays status spinner and disables submit
      await handle.rerender(
        <ScanStep
          title="Scan book copy"
          description="Scan book QR."
          placeholder="Enter Book QR"
          onScan={onScan}
          isProcessing={true}
          actionLabel="Verify"
        />
      );
      expect(handle.container.querySelector('[role="status"]')).toHaveTextContent('Verifying entry…');
      expect(findButtonByText(handle.container, 'Verifying…')).toBeDisabled();
    });

    it('ReserveTitleButton self-hydrates, handles available/queued/ready states, and surfaces API errors', async () => {
      mockGetBookAvailabilityStatus.mockResolvedValueOnce({
        hasReservation: false,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        nextAvailableDate: null,
      });

      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, message: 'Limit reached' }), { status: 400 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, queue_position: 2 }), { status: 200 }));
      vi.stubGlobal('fetch', fetchSpy);

      const onReserveSuccess = vi.fn();
      const handle = await renderClient(
        <ReserveTitleButton
          bookId="book-reserve-1"
          isAvailable={true}
          onReserveSuccess={onReserveSuccess}
        />
      );
      await act(async () => { await Promise.resolve(); });
      expect(mockGetBookAvailabilityStatus).toHaveBeenCalledWith('book-reserve-1');
      expect(handle.container).toHaveTextContent('Reserve for Pickup');

      // Error response shows toast.error
      await clickElement(findButtonByText(handle.container, 'Reserve for Pickup'));
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(mockToastError).toHaveBeenCalledWith('Limit reached');

      // Success response refreshes status and calls onReserveSuccess
      mockGetBookAvailabilityStatus.mockResolvedValueOnce({
        hasReservation: true,
        isReady: false,
        queuePosition: 2,
        holdExpiresAt: null,
        nextAvailableDate: null,
      });
      await clickElement(findButtonByText(handle.container, 'Reserve for Pickup'));
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(mockToastSuccess).toHaveBeenCalledWith('Reserved! You are at position 2 in the queue.');
      expect(onReserveSuccess).toHaveBeenCalledWith(2, 'ACTIVE', null);
      expect(handle.container).toHaveTextContent('Your Reserve');

      // Unavailable queued vs Ready states
      await handle.rerender(
        <ReserveTitleButton
          bookId="book-reserve-2"
          isAvailable={false}
          hasExistingReservation={false}
        />
      );
      expect(handle.container).toHaveTextContent('Join Waitlist');

      await handle.rerender(
        <ReserveTitleButton
          bookId="book-reserve-2"
          isAvailable={false}
          hasExistingReservation={true}
          isReady={true}
          holdExpiresAt="2026-12-20T00:00:00Z"
        />
      );
      expect(handle.container).toHaveTextContent('Ready (Until');

      await handle.rerender(
        <ReserveTitleButton
          bookId="book-reserve-2"
          isAvailable={false}
          hasExistingReservation={true}
          isReady={true}
          holdExpiresAt={null}
        />
      );
      expect(handle.container).toHaveTextContent('Ready for Pickup');
    });

    it('renders SuccessStep with reservation hold banner and reset action', async () => {
      const onReset = vi.fn();
      const { container } = await renderClient(
        <SuccessStep
          title="Return Complete"
          message="Book returned."
          nextLabel="New return"
          onReset={onReset}
          reservationReady
          reservedFor="Andres Bonifacio"
        />
      );

      expect(container).toHaveTextContent('Return Complete');
      expect(container).toHaveTextContent('Place on Hold Shelf');
      expect(container).toHaveTextContent('Andres Bonifacio');

      await clickElement(findButtonByText(container, 'New return'));
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('renders DigitalCard front and back sides with status badge and QR expand action', async () => {
      const onQrClick = vi.fn();
      const handle = await renderClient(
        <DigitalCard
          fullName="Apolinario Mabini"
          studentId="2026-0007"
          cardNumber="LIB-0007"
          department="BS Computer Science"
          status="pending"
          expiryDate="2027-05-01"
          academicYear="2026 - 2027"
          onQrClick={onQrClick}
        />
      );

      expect(handle.container).toHaveTextContent('Apolinario Mabini');
      expect(handle.container).toHaveTextContent('BS Computer Science');
      expect(handle.container).toHaveTextContent('LIB-0007');
      expect(handle.container).toHaveTextContent('2026 - 2027');
      expect(handle.container).toHaveTextContent('pending');

      const qrBtn = handle.container.querySelector('button[aria-label="Expand QR code"]');
      await clickElement(qrBtn);
      expect(onQrClick).toHaveBeenCalledTimes(1);

      await handle.rerender(
        <DigitalCard
          fullName="Apolinario Mabini"
          studentId="2026-0007"
          cardNumber="LIB-0007"
          department="BS Computer Science"
          status="active"
          expiryDate="2027-05-01"
          side="back"
          address="123 Alabang Rd"
          phone="09171234567"
          roleLabel="Student"
        />
      );

      expect(handle.container).toHaveTextContent('123 Alabang Rd');
      expect(handle.container).toHaveTextContent('09171234567');
      expect(handle.container).toHaveTextContent('Important Reminders');
      expect(handle.container).toHaveTextContent('Student');
    });
  });
});
