import * as React from 'react';
import { Suspense, act } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  pressKey,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
const mockRouter = {
  push: mockRouterPush,
  replace: mockRouterReplace,
  refresh: mockRouterRefresh,
};
let mockSearchParams = new URLSearchParams('');

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/student-catalog',
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    void _fill;
    void _priority;
    void _unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ''} {...rest} />;
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

const mockXlsxWriteFile = vi.fn();
const mockXlsxJsonToSheet = vi.fn((rows: unknown) => ({ rows }));
const mockXlsxBookNew = vi.fn(() => ({ SheetNames: [], Sheets: {} }));
const mockXlsxBookAppendSheet = vi.fn((wb: { SheetNames: string[] }, _ws: unknown, name: string) => {
  wb.SheetNames.push(name);
});
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: (rows: unknown) => mockXlsxJsonToSheet(rows),
    book_new: () => mockXlsxBookNew(),
    book_append_sheet: (wb: { SheetNames: string[] }, ws: unknown, name: string) =>
      mockXlsxBookAppendSheet(wb, ws, name),
  },
  writeFile: (...args: unknown[]) => mockXlsxWriteFile(...args),
}));

const mockGetUsers = vi.fn();
vi.mock('@/lib/actions/users', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
}));

const mockExportBorrowingHistory = vi.fn();
const mockSettleBorrowingFine = vi.fn();
const mockGetUserBorrowingHistory = vi.fn().mockResolvedValue({ success: true, data: { records: [], totalCount: 0 } });
vi.mock('@/lib/actions/history', () => ({
  exportBorrowingHistory: (...args: unknown[]) => mockExportBorrowingHistory(...args),
  settleBorrowingFine: (...args: unknown[]) => mockSettleBorrowingFine(...args),
  getUserBorrowingHistory: (...args: unknown[]) => mockGetUserBorrowingHistory(...args),
}));

const mockRecordAttendanceByCard = vi.fn();
const mockGetAttendanceHistory = vi.fn();
vi.mock('@/lib/actions/attendance', () => ({
  recordAttendanceByCard: (...args: unknown[]) => mockRecordAttendanceByCard(...args),
  getAttendanceHistory: (...args: unknown[]) => mockGetAttendanceHistory(...args),
}));

const mockGetAnalyticsSummary = vi.fn();
vi.mock('@/lib/actions/analytics', () => ({
  getAnalyticsSummary: (...args: unknown[]) => mockGetAnalyticsSummary(...args),
}));

vi.mock('@/lib/actions/catalog', () => ({
  getBooksForExport: vi.fn().mockResolvedValue([]),
  batchImportBooks: vi.fn(),
  getBookAdminDetails: vi.fn(),
  getBookPublicDetails: vi.fn(),
  getCategories: vi.fn(),
}));

const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockRefreshNotifs = vi.fn();
const mockGetMe = vi.fn();
vi.mock('@/lib/auth-helpers', () => ({
  getMe: () => mockGetMe(),
}));

const mockUseNotifications = vi.fn();
vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => mockUseNotifications(),
}));

import { Download, Trash2 } from 'lucide-react';
import { OverflowActionsMenu } from '@/components/common/OverflowActionsMenu';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AnimationProvider } from '@/components/providers/animation-provider';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { BatchTaskProvider } from '@/components/providers/BatchTaskProvider';
import { StudentCatalogClient } from '@/app/(authenticated)/student-catalog/StudentCatalogClient';
import { ModernInventoryClient } from '@/components/inventory/ModernInventoryClient';
import { AttendanceClient } from '@/app/(authenticated)/attendance/AttendanceClient';
import HistoryContent from '@/app/(authenticated)/history/HistoryContent';
import { UsersContent } from '@/app/(authenticated)/users/UsersContent';
import { UserDetailClient } from '@/app/(authenticated)/users/[id]/UserDetailClient';
import { AnalyticsClient } from '@/app/(authenticated)/analytics/AnalyticsClient';
import { AuditLogClient } from '@/components/admin/AuditLogClient';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { StatusBanner } from '@/components/catalog/StatusBanner';
import { CompactPagination } from '@/components/ui/compact-pagination';
import NotificationsPage from '@/app/(authenticated)/notifications/page';
import UserDetailPage from '@/app/(authenticated)/users/[id]/page';
import type { Book, Category, ProfileData, User } from '@/lib/types';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
  ) as HTMLButtonElement | undefined;
}

describe('Mobile Layout & Progressive Disclosure Behavioral Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('');
    mockCreateClient.mockReturnValue({
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn().mockResolvedValue('ok'),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ jobs: [], logs: [], total: 0 }), { status: 200 }))
      )
    );
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('OverflowActionsMenu renders null when empty, exposes aria-haspopup/aria-expanded, fires handlers, skips disabled items, and restores focus on Escape', async () => {
    const emptyHandle = await renderClient(<OverflowActionsMenu actions={[]} />);
    expect(emptyHandle.container.innerHTML).toBe('');
    emptyHandle.unmount();

    const onExport = vi.fn();
    const onDelete = vi.fn();
    const { container } = await renderClient(
      <OverflowActionsMenu
        label="Item actions"
        actions={[
          { id: 'export', label: 'Export Data', icon: Download, onSelect: onExport },
          { id: 'disabled', label: 'Locked Action', disabled: true, onSelect: onDelete },
          { id: 'delete', label: 'Delete Item', icon: Trash2, destructive: true, onSelect: onDelete },
        ]}
      />
    );

    const trigger = container.querySelector('button[aria-label="Item actions"]') as HTMLButtonElement;
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Open via keyboard Enter
    await pressKey(trigger, 'Enter');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    expect(menuItems.map((m) => m.textContent?.trim())).toEqual([
      'Export Data',
      'Locked Action',
      'Delete Item',
    ]);

    // Disabled item does not fire
    await clickElement(menuItems[1]);
    expect(onDelete).not.toHaveBeenCalled();

    // Active item fires handler
    await clickElement(menuItems[0]);
    expect(onExport).toHaveBeenCalledTimes(1);

    // Reopen and close with Escape restores focus to trigger
    trigger.focus();
    await pressKey(trigger, 'Enter');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = document.body.querySelector('[role="menu"]') as HTMLElement;
    await pressKey(menu, 'Escape');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(trigger);
  });

  it('SheetContent responsiveBottom opens on trigger, closes on Escape, and returns focus to trigger', async () => {
    const { container } = await renderClient(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Open Mobile Sheet</button>
        </SheetTrigger>
        <SheetContent side="right" responsiveBottom>
          <SheetTitle>Filter Sheet</SheetTitle>
          <SheetDescription>Choose filter options</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    const trigger = findButtonByText(container, 'Open Mobile Sheet')!;
    trigger.focus();
    await clickElement(trigger);
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain('bottom-0');
    expect(dialog.className).toContain('rounded-t-3xl');
    expect(dialog.className).toContain('sm:right-0');

    await pressKey(dialog, 'Escape');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('StudentCatalogClient mobile filter sheet tracks active filter count, fires category/available/reset handlers, and restores focus', async () => {
    const books: Book[] = [
      {
        id: 'b-1',
        title: 'Clean Code',
        author: 'Robert Martin',
        isbn: '9780132350884',
        available_copies: 2,
        total_copies: 2,
        is_active: true,
      },
    ];
    const categories: Category[] = [
      { id: 'cat-1', name: 'Computer Science' },
      { id: 'cat-2', name: 'History' },
    ];

    mockSearchParams = new URLSearchParams('category=cat-1&available=true');
    const { container } = await renderClient(
      <AnimationProvider>
        <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="patron">
          <Suspense fallback={<div>Loading</div>}>
            <StudentCatalogClient
              booksPromise={Promise.resolve({ books, total: 1, hasMore: false })}
              categoriesPromise={Promise.resolve(categories)}
              reservationsPromise={Promise.resolve([])}
              initialFilters={{
                q: '',
                categoryId: 'cat-1',
                availableOnly: true,
                page: 1,
                sortBy: 'newest',
              }}
            />
          </Suspense>
        </PreferencesProvider>
      </AnimationProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    const filterTrigger = container.querySelector('button[aria-label="Catalog filters (2 active)"]') as HTMLButtonElement;
    expect(filterTrigger).toBeInTheDocument();
    expect(filterTrigger).toHaveTextContent('2');

    filterTrigger.focus();
    await clickElement(filterTrigger);
    expect(document.body).toHaveTextContent('Catalog Filters');

    // Toggle category inside bottom sheet
    await clickElement(findButtonByText(document.body, 'History'));
    expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining('category=cat-1%2Ccat-2'), { scroll: false });

    // Toggle availability inside bottom sheet
    await clickElement(findButtonByText(document.body, 'Available copies only'));
    expect(mockRouterReplace).toHaveBeenCalledWith(expect.not.stringContaining('available=true'), { scroll: false });

    // Reset clears filters
    await clickElement(findButtonByText(document.body, 'Reset'));
    expect(mockRouterReplace).toHaveBeenCalledWith('?', { scroll: false });

    // Close via Escape returns focus to trigger
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    await pressKey(dialog, 'Escape');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(document.activeElement).toBe(filterTrigger);
  });

  it('ModernInventoryClient surfaces mobile overflow menu for Batch Operations when canManage=true and hides admin controls when canManage=false', async () => {
    const profile: ProfileData = {
      id: 'lib-1',
      full_name: 'Librarian',
      email: 'lib@lumina.edu',
      role: 'librarian',
      status: 'ACTIVE',
      student_id: null,
      department: null,
      avatar_url: null,
      address: null,
      phone: null,
      updated_at: '2026-01-01T00:00:00Z',
    };
    const categories: Category[] = [{ id: 'cat-1', name: 'Science' }];

    mockSearchParams = new URLSearchParams('status=ARCHIVED&categoryId=cat-1');
    const managedHandle = await renderClient(
      <AnimationProvider>
        <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="librarian" initialProfile={profile}>
          <BatchTaskProvider>
            <ModernInventoryClient books={[]} totalItems={0} categories={categories} canManage={true} />
          </BatchTaskProvider>
        </PreferencesProvider>
      </AnimationProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    // Active filter count badge = 2 (status=ARCHIVED + categoryId=cat-1)
    const filtersBtn = managedHandle.container.querySelector('button[aria-label="Filters (2 active)"]')!;
    expect(filtersBtn).toHaveTextContent('2');

    // Mobile overflow opens Batch Operations dialog
    const overflowTrigger = managedHandle.container.querySelector(
      'button[aria-label="Inventory actions"]'
    ) as HTMLButtonElement;
    expect(overflowTrigger).toBeInTheDocument();
    await pressKey(overflowTrigger, 'Enter');

    const batchMenuItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Batch Operations')
    ) as HTMLElement;
    expect(batchMenuItem).toBeDefined();
    await clickElement(batchMenuItem);
    expect(document.body).toHaveTextContent('Batch Catalog Operations');

    const isbnTabBtn = findButtonByText(document.body, 'ISBN Fallback')!;
    const exportTabBtn = findButtonByText(document.body, 'Export Data')!;
    expect(findButtonByText(document.body, 'Import Sheet')).toHaveAttribute('aria-pressed', 'true');
    await clickElement(isbnTabBtn);
    expect(isbnTabBtn).toHaveAttribute('aria-pressed', 'true');
    await clickElement(exportTabBtn);
    expect(exportTabBtn).toHaveAttribute('aria-pressed', 'true');

    await pressKey(document.body.querySelector('[role="dialog"]') as HTMLElement, 'Escape');
    managedHandle.unmount();

    // Role-gated: canManage=false hides Add Item & Inventory actions overflow menu
    const staffHandle = await renderClient(
      <AnimationProvider>
        <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="library_staff" initialProfile={profile}>
          <BatchTaskProvider>
            <ModernInventoryClient books={[]} totalItems={0} categories={categories} canManage={false} />
          </BatchTaskProvider>
        </PreferencesProvider>
      </AnimationProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(staffHandle.container.querySelector('button[aria-label="Inventory actions"]')).toBeNull();
    expect(staffHandle.container.querySelector('a[href="/inventory/add"]')).toBeNull();
  });

  it('AttendanceClient mobile overflow menu triggers Export (.xlsx)', async () => {
    const todayRecords = [
      {
        id: 'att-1',
        user_id: 'stu-1',
        check_in_at: '2026-11-17T08:00:00Z',
        check_out_at: null,
        notes: null,
        profiles: { full_name: 'Ana Reyes', student_id: '2026-0001' },
      },
    ];

    const { container } = await renderClient(
      <Suspense fallback={<div>Loading</div>}>
        <AttendanceClient
          systemTodayPromise={Promise.resolve(todayRecords)}
          systemAllPromise={Promise.resolve(todayRecords)}
          personalHistoryPromise={Promise.resolve([])}
          isStaff={true}
          userId="staff-1"
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });

    const overflowTrigger = container.querySelector(
      'button[aria-label="Attendance log actions"]'
    ) as HTMLButtonElement;
    await pressKey(overflowTrigger, 'Enter');

    const exportItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Export (.xlsx)')
    ) as HTMLElement;
    await clickElement(exportItem);

    await vi.waitFor(() => {
      expect(mockXlsxWriteFile).toHaveBeenCalledWith(expect.anything(), 'lumina_attendance_logs.xlsx');
    });
  });

  it('HistoryContent mobile overflow menu appears on every tab and fires Export/Print', async () => {
    const printSpy = vi.fn();
    vi.stubGlobal('print', printSpy);
    mockExportBorrowingHistory.mockResolvedValue({
      success: true,
      data: {
        records: [
          {
            id: 'rec-1',
            borrowed_at: '2026-10-01T00:00:00Z',
            due_date: '2026-10-15T00:00:00Z',
            returned_at: null,
            status: 'OVERDUE',
            fine_amount: 40,
            fine_settled_at: null,
            books: { id: 'b-1', title: 'Clean Code', author: 'Martin', cover_url: null },
            profiles: { full_name: 'Ana', student_id: '2026-1', email: 'ana@lumina.edu' },
          },
        ],
        totalCount: 1,
      },
    });

    const activeHandle = await renderClient(
      <Suspense fallback={<div>Loading</div>}>
        <HistoryContent
          historyPromise={Promise.resolve({ records: [], totalCount: 0 })}
          page={1}
          statusFilter="ACTIVE"
          searchQuery=""
          userRole="librarian"
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });
    // Export/print is available on every tab now (P4-HIS-006).
    expect(activeHandle.container.querySelector('button[aria-label="History report actions"]')).not.toBeNull();
    activeHandle.unmount();

    const overdueHandle = await renderClient(
      <Suspense fallback={<div>Loading</div>}>
        <HistoryContent
          historyPromise={Promise.resolve({ records: [], totalCount: 0 })}
          page={1}
          statusFilter="OVERDUE"
          searchQuery=""
          userRole="librarian"
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });

    const trigger = overdueHandle.container.querySelector(
      'button[aria-label="History report actions"]'
    ) as HTMLButtonElement;
    expect(trigger).toBeInTheDocument();

    await pressKey(trigger, 'Enter');
    const printItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Print')
    ) as HTMLElement;
    await clickElement(printItem);
    expect(printSpy).toHaveBeenCalledTimes(1);

    await pressKey(trigger, 'Enter');
    const exportItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Export (.xlsx)')
    ) as HTMLElement;
    await clickElement(exportItem);
    await vi.waitFor(() => {
      expect(mockXlsxWriteFile).toHaveBeenCalledWith(expect.anything(), 'lumina_overdue_receivables.xlsx');
    });
  });

  it('AnalyticsClient mobile overflow menu fires Export (.xlsx) and Print handlers', async () => {
    const printSpy = vi.fn();
    vi.stubGlobal('print', printSpy);
    mockGetAnalyticsSummary.mockResolvedValue({
      borrowingTrends: [{ label: 'Nov 1', count: 5 }],
      attendanceTrends: [{ label: 'Nov 1', count: 10 }],
      categoryDistribution: [{ name: 'Fiction', value: 5 }],
      peakHours: [{ hour: '10:00', count: 8 }],
      popularBooks: [],
    });

    const { container } = await renderClient(
      <Suspense fallback={<div>Loading</div>}>
        <AnalyticsClient
          statsPromise={Promise.resolve({
            activeBorrows: 3,
            pendingApprovals: 1,
            myActiveBorrows: 0,
            recentBooks: [],
            attendanceToday: 12,
            totalBooks: 100,
            totalUsers: 50,
          })}
          role="super_admin"
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });

    const trigger = container.querySelector('button[aria-label="Analytics report actions"]') as HTMLButtonElement;
    await pressKey(trigger, 'Enter');
    await clickElement(
      Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
        el.textContent?.includes('Print')
      ) as HTMLElement
    );
    expect(printSpy).toHaveBeenCalledTimes(1);

    await pressKey(trigger, 'Enter');
    await clickElement(
      Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
        el.textContent?.includes('Export (.xlsx)')
      ) as HTMLElement
    );
    await vi.waitFor(() => {
      expect(mockXlsxWriteFile).toHaveBeenCalled();
    });
  });

  it('UsersContent mobile filter sheet enforces role gating and shows active badge count', async () => {
    mockGetUsers.mockResolvedValue({ users: [], total: 0 });
    const sampleUser: User = {
      id: 'u-1',
      name: 'Juan',
      email: 'juan@lumina.edu',
      role: 'patron',
      status: 'ACTIVE',
      department: 'BSCS',
      student_id: '2026-1',
      avatarUrl: null,
      address: null,
      phone: null,
      joined: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const libHandle = await renderClient(
      <Suspense fallback={<div>Loading</div>}>
        <UsersContent
          usersPromise={Promise.resolve({ users: [sampleUser], count: 1 })}
          currentRole="librarian"
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });

    await clickElement(findButtonByText(libHandle.container, 'Filter'));
    expect(findButtonByText(document.body, 'Super Admin')).toBeUndefined();
    await clickElement(findButtonByText(document.body, 'Pending Review'));
    expect(mockGetUsers).toHaveBeenCalledWith(expect.objectContaining({ tab: 'review' }));
    expect(findButtonByText(libHandle.container, 'Filter')).toHaveTextContent('1');
  });

  it('UserDetailClient mobile overflow menu shows Archive only for super_admin and hides it for librarian', async () => {
    const targetUser: User = {
      id: 'u-2',
      name: 'Maria Clara',
      email: 'maria@lumina.edu',
      role: 'patron',
      status: 'ACTIVE',
      department: 'BSIT',
      student_id: '2026-2',
      avatarUrl: null,
      address: null,
      phone: null,
      joined: '2026-01-01',
      updatedAt: '2026-01-01',
      permissions: {},
    };

    const libHandle = await renderClient(
      <UserDetailClient initialUser={targetUser} currentRole="librarian" />
    );
    const libTrigger = libHandle.container.querySelector(
      'button[aria-label="More user actions"]'
    ) as HTMLButtonElement;
    await pressKey(libTrigger, 'Enter');
    const libMenuTexts = Array.from(document.body.querySelectorAll('[role="menuitem"]')).map((m) =>
      m.textContent?.trim()
    );
    expect(libMenuTexts).toContain('Other Information');
    expect(libMenuTexts).not.toContain('Archive');
    await pressKey(document.body.querySelector('[role="menu"]') as HTMLElement, 'Escape');
    libHandle.unmount();

    const adminHandle = await renderClient(
      <UserDetailClient initialUser={targetUser} currentRole="super_admin" />
    );
    const adminTrigger = adminHandle.container.querySelector(
      'button[aria-label="More user actions"]'
    ) as HTMLButtonElement;
    await pressKey(adminTrigger, 'Enter');
    const archiveMenuItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((m) =>
      m.textContent?.includes('Archive')
    ) as HTMLElement;
    expect(archiveMenuItem).toBeDefined();
    await clickElement(archiveMenuItem);
    expect(document.body).toHaveTextContent('Archive Identity');
  });

  it('AuditLogClient mobile overflow menu labels Export / Import for super_admin and Export for librarian', async () => {
    const libHandle = await renderClient(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AuditLogClient userRole="librarian" />
      </SWRConfig>
    );
    const libTrigger = libHandle.container.querySelector(
      'button[aria-label="Audit log actions"]'
    ) as HTMLButtonElement;
    await pressKey(libTrigger, 'Enter');
    const libItem = document.body.querySelector('[role="menuitem"]') as HTMLElement;
    expect(libItem.textContent?.trim()).toBe('Export');
    await pressKey(document.body.querySelector('[role="menu"]') as HTMLElement, 'Escape');
    libHandle.unmount();

    const adminHandle = await renderClient(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AuditLogClient userRole="super_admin" />
      </SWRConfig>
    );
    const adminTrigger = adminHandle.container.querySelector(
      'button[aria-label="Audit log actions"]'
    ) as HTMLButtonElement;
    await pressKey(adminTrigger, 'Enter');
    const adminItem = document.body.querySelector('[role="menuitem"]') as HTMLElement;
    expect(adminItem.textContent?.trim()).toBe('Export / Import');
  });

  it('CategoryManagement header stacks cleanly and keeps Bulk Management + Add Category interactive', async () => {
    const { container } = await renderClient(
      <CategoryManagement initialCategories={[{ id: 'c1', name: 'Science', slug: 'science', is_active: true }]} />
    );
    const addBtn = findButtonByText(container, 'Add Category')!;
    const bulkBtn = findButtonByText(container, 'Bulk Management')!;
    expect(addBtn).toBeInTheDocument();
    expect(bulkBtn).toBeInTheDocument();

    await clickElement(bulkBtn);
    expect(findButtonByText(container, 'Save Changes')).toBeInTheDocument();
    expect(findButtonByText(container, 'Discard')).toBeInTheDocument();
  });

  it('NotificationsPage renders Clear unread inline with TabsList and calls markAllAsRead', async () => {
    mockUseNotifications.mockReturnValue({
      notifications: [
        {
          id: 'n1',
          user_id: 'u1',
          title: 'Hold Ready',
          content: 'Pick up your book.',
          type: 'RESERVATION_READY',
          priority: 'medium',
          is_read: false,
          metadata: {},
          created_at: '2026-11-17T00:00:00Z',
        },
      ],
      unreadCount: 1,
      olderUnread: 0,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      loading: false,
      error: null,
      refresh: mockRefreshNotifs,
      hasMore: false,
      loadingMore: false,
      loadMore: vi.fn(),
      searchNotifications: vi.fn().mockResolvedValue([]),
    });

    const { container } = await renderClient(<NotificationsPage />);
    const clearBtn = findButtonByText(container, 'Clear unread')!;
    expect(clearBtn).toBeInTheDocument();
    await clickElement(clearBtn);
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('StatusBanner formats ready hold expiry deterministically in Asia/Manila', async () => {
    const { container } = await renderClient(
      <StatusBanner
        book={{ available_copies: 1 }}
        availability={{
          hasReservation: true,
          isReady: true,
          queuePosition: null,
          nextAvailableDate: null,
          reservationId: 'res-1',
          holdExpiresAt: '2026-11-16T10:00:00.000Z',
        }}
      />
    );
    expect(container).toHaveTextContent('Copy Ready for Pickup');
    expect(container).toHaveTextContent('Mon, Nov 16');
  });

  it('AuditLogClient renders responsive mobile cards with expandable diff toggle and desktop table', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              logs: [
                {
                  id: 'log-1',
                  action: 'checkout',
                  entity_type: 'borrowing_record',
                  created_at: '2026-11-16T11:28:51.000Z',
                  admin_id: 'a1',
                  profiles: { full_name: 'Kaye Marasigan', email: 'kaye@sti.edu' },
                  book_title: 'On Liberty',
                  reason: 'Desk checkout',
                  old_value: { status: 'AVAILABLE' },
                  new_value: { status: 'BORROWED' },
                },
              ],
              total: 1,
            }),
            { status: 200 }
          )
        )
      )
    );

    const { container } = await renderClient(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AuditLogClient userRole="librarian" />
      </SWRConfig>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    const desktopTableWrapper = container.querySelector('div.hidden.lg\\:block');
    expect(desktopTableWrapper?.querySelector('table')).toBeInTheDocument();

    const toggleBtn = container.querySelector('div.lg\\:hidden button[aria-expanded]') as HTMLButtonElement;
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    await clickElement(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(container).toHaveTextContent('Value Changes');
    expect(container).toHaveTextContent('BORROWED');
  });

  it('CompactPagination advances and rewinds pages via Previous/Next buttons', async () => {
    const onPageChange = vi.fn();
    const { container } = await renderClient(
      <CompactPagination page={2} totalItems={30} pageSize={10} onPageChange={onPageChange} />
    );

    const prevBtn = container.querySelector('button[aria-label="Previous page"]') as HTMLButtonElement;
    const nextBtn = container.querySelector('button[aria-label="Next page"]') as HTMLButtonElement;
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    await clickElement(prevBtn);
    await clickElement(nextBtn);
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('UserDetailPage rejects non-UUID segments like "new" with notFound() instead of querying Postgres', async () => {
    mockGetMe.mockResolvedValueOnce({
      role: 'super_admin',
      user: { id: 'sa-1' },
      profile: { id: 'sa-1', role: 'super_admin', status: 'ACTIVE' },
      supabase: {},
    });
    const tree = UserDetailPage({ params: Promise.resolve({ id: 'new' }) }) as React.ReactElement<{
      children: React.ReactElement<{ children: React.ReactElement<{ params: Promise<{ id: string }> }> }>;
    }>;
    const loaderEl = tree.props.children.props.children;
    const loaderFn = loaderEl.type as unknown as (props: { params: Promise<{ id: string }> }) => Promise<unknown>;
    await expect(loaderFn(loaderEl.props)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
