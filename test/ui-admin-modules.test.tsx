import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { renderClient, cleanupClients, clickElement } from './helpers/render';

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockRouterRefresh = vi.fn();
const mockGetMe = vi.fn();
const mockGetUsers = vi.fn();
const mockGetUserBorrowingHistory = vi.fn();
const mockRecordAttendanceByCard = vi.fn();
const mockGetAttendanceHistory = vi.fn();
const mockGetAnalyticsSummary = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getMe: () => mockGetMe(),
}));

vi.mock('@/lib/actions/users', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  createUserWithPassword: vi.fn(),
}));

vi.mock('@/lib/actions/history', () => ({
  getUserBorrowingHistory: (...args: unknown[]) => mockGetUserBorrowingHistory(...args),
}));

vi.mock('@/lib/actions/attendance', () => ({
  recordAttendanceByCard: (...args: unknown[]) => mockRecordAttendanceByCard(...args),
  getAttendanceHistory: (...args: unknown[]) => mockGetAttendanceHistory(...args),
}));

vi.mock('@/lib/actions/analytics', () => ({
  getAnalyticsSummary: (...args: unknown[]) => mockGetAnalyticsSummary(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    return {
      channel: () => channel,
      removeChannel: vi.fn(),
    };
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const capturedRechartsProps: {
  line?: Record<string, unknown>;
  pie?: Record<string, unknown>;
  bar?: Record<string, unknown>;
} = {};

vi.mock('recharts', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Box,
    LineChart: Box,
    PieChart: Box,
    BarChart: Box,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Cell: () => null,
    Line: (props: Record<string, unknown>) => {
      capturedRechartsProps.line = props;
      return <div data-testid="mock-line" />;
    },
    Pie: (props: Record<string, unknown>) => {
      capturedRechartsProps.pie = props;
      return <div data-testid="mock-pie" />;
    },
    Bar: (props: Record<string, unknown>) => {
      capturedRechartsProps.bar = props;
      return <div data-testid="mock-bar" />;
    },
  };
});

import NewUserPage, { NewUserContent } from '@/app/(authenticated)/users/new/page';
import { UsersContent } from '@/app/(authenticated)/users/UsersContent';
import { UserDetailClient } from '@/app/(authenticated)/users/[id]/UserDetailClient';
import { AttendanceClient } from '@/app/(authenticated)/attendance/AttendanceClient';
import { TrendChart, CategoryPieChart, PeakHoursBarChart } from '@/app/(authenticated)/analytics/AnalyticsCharts';
import { AnalyticsClient } from '@/app/(authenticated)/analytics/AnalyticsClient';
import { AuditLogClient } from '@/components/admin/AuditLogClient';
import { AuditLogExportImportModal } from '@/components/admin/AuditLogExportImportModal';
import type { User } from '@/lib/types';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe('B6 Admin Modules (Users, Attendance, Analytics, Audit)', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockGetMe.mockReset();
    mockGetUsers.mockReset();
    mockGetUserBorrowingHistory.mockReset();
    capturedRechartsProps.line = undefined;
    capturedRechartsProps.pie = undefined;
    capturedRechartsProps.bar = undefined;
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
  });

  it('F26: /users/new redirects patron, library_staff, and unauthenticated users, and allows librarian/super_admin', async () => {
    // Also verify the page wrapper contains NewUserContent inside Suspense
    const pageEl = NewUserPage();
    expect(pageEl).toBeTruthy();

    mockGetMe.mockResolvedValueOnce(null);
    await expect(NewUserContent()).rejects.toThrow('NEXT_REDIRECT:/');

    mockGetMe.mockResolvedValueOnce({ role: 'patron' });
    await expect(NewUserContent()).rejects.toThrow('NEXT_REDIRECT:/dashboard');

    mockGetMe.mockResolvedValueOnce({ role: 'library_staff' });
    await expect(NewUserContent()).rejects.toThrow('NEXT_REDIRECT:/dashboard');

    mockGetMe.mockResolvedValueOnce({ role: 'librarian' });
    const libEl = await NewUserContent();
    const { container } = await renderClient(libEl);
    expect(container).toHaveTextContent('Access Details');
    expect(container).toHaveTextContent('Send Invitation');
  });

  it('F27: UsersContent renders Invite User link, nowrap IDs, and avoids initial Refreshing spinner under StrictMode', async () => {
    const sampleUsers: User[] = [
      {
        id: 'u-1',
        name: 'Benedict Galang',
        email: 'demo.galang@alabang.sti.edu.ph',
        role: 'librarian',
        status: 'ACTIVE',
        department: 'Library',
        student_id: 'FAC-DEMO.GALANG',
        avatarUrl: null,
        address: null,
        phone: null,
        joined: 'Jan 2026',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const { container } = await renderClient(
      <React.StrictMode>
        <UsersContent
          usersPromise={Promise.resolve({ users: sampleUsers, count: 1 })}
          currentRole="librarian"
        />
      </React.StrictMode>
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(mockGetUsers).not.toHaveBeenCalled();
    expect(container).not.toHaveTextContent('Refreshing...');
    expect(container.querySelector('a[href="/users/new"]')).toHaveTextContent('Invite User');

    const idSpan = Array.from(container.querySelectorAll('table span')).find(
      (s) => s.textContent === 'FAC-DEMO.GALANG'
    );
    expect(idSpan).toBeDefined();
    expect(idSpan!.className).toContain('whitespace-nowrap');
  });

  it('F28: UserDetailClient surfaces Verify & Approve immediately for PENDING users and hides empty history thead', async () => {
    const pendingUser: User = {
      id: 'p-1',
      name: 'Pending Student',
      email: 'pending@alabang.sti.edu.ph',
      role: 'patron',
      status: 'PENDING',
      department: 'BSCS',
      student_id: 'STU-1001',
      avatarUrl: null,
      address: null,
      phone: null,
      joined: 'Nov 2026',
      updatedAt: '2026-11-01T00:00:00Z',
    };

    const { container } = await renderClient(
      <UserDetailClient
        initialUser={pendingUser}
        currentRole="librarian"
        initialHistory={{ records: [], totalCount: 0 }}
      />
    );

    const verifyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Verify & Approve')
    );
    expect(verifyBtn).toBeDefined();
    expect(container).toHaveTextContent('No borrowing history');
    expect(container.querySelector('table thead')).toBeNull();

    await clickElement(verifyBtn!);
    expect(document.body).toHaveTextContent('ID Verification');
  });

  it('F23 & F24: AttendanceClient stacks gate input cleanly on mobile with nowrap IDs/times and renders static All-Time History', async () => {
    const records = [
      {
        id: 'att-1',
        user_id: 'u-1',
        check_in_at: '2026-11-16T11:23:00.000Z',
        check_out_at: null,
        notes: null,
        profiles: { full_name: 'Paolo Bautista', student_id: 'STU-20220271' },
      },
    ];

    const staffHandle = await renderClient(
      <AttendanceClient
        systemTodayPromise={Promise.resolve(records)}
        systemAllPromise={Promise.resolve(records)}
        personalHistoryPromise={Promise.resolve([])}
        isStaff={true}
        userId="staff-1"
      />
    );

    const gateForm = staffHandle.container.querySelector('form[aria-label="Log attendance"]');
    expect(gateForm).toBeInTheDocument();
    expect(gateForm!.className).toContain('w-full');

    const mobileId = Array.from(staffHandle.container.querySelectorAll('span')).find(
      (s) => s.textContent === 'STU-20220271'
    );
    expect(mobileId).toBeDefined();
    expect(mobileId!.className).toContain('whitespace-nowrap');

    cleanupClients();

    const patronHandle = await renderClient(
      <AttendanceClient
        personalHistoryPromise={Promise.resolve(records)}
        isStaff={false}
        userId="u-1"
      />
    );

    const allTimeLabel = Array.from(patronHandle.container.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('All-Time History')
    );
    expect(allTimeLabel).toBeDefined();
    expect(allTimeLabel!.className).not.toContain('border');
  });

  it('F25: AnalyticsCharts disables Recharts mount animations, connects nulls, untruncates genre labels, and renders high-contrast demand bars', async () => {
    const { container } = await renderClient(
      <div>
        <TrendChart
          title="Circulation Trends"
          color="hsl(var(--primary))"
          data={[
            { label: 'Nov 1', count: 2 },
            { label: 'Nov 2', count: 0 },
            { label: 'Nov 3', count: 3 },
          ]}
        />
        <CategoryPieChart
          title="Genre Popularity"
          data={[
            { name: 'History & Biography', value: 22 },
            { name: 'Computer Science', value: 8 },
          ]}
        />
        <PeakHoursBarChart
          title="Peak Visiting Hours"
          color="hsl(var(--primary))"
          data={[{ hour: '10 AM', count: 5 }]}
        />
      </div>
    );

    expect(capturedRechartsProps.line?.isAnimationActive).toBe(false);
    expect(capturedRechartsProps.line?.connectNulls).toBe(true);
    expect(capturedRechartsProps.pie?.isAnimationActive).toBe(false);
    expect(capturedRechartsProps.bar?.isAnimationActive).toBe(false);

    const genreSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'History & Biography'
    );
    expect(genreSpan).toBeDefined();
    expect(genreSpan!.className).not.toContain('truncate');

    cleanupClients();

    const analyticsHandle = await renderClient(
      <AnalyticsClient
        role="librarian"
        statsPromise={Promise.resolve({
          activeBorrows: 2,
          pendingApprovals: 1,
          myActiveBorrows: 0,
          recentBooks: [],
          attendanceToday: 3,
          totalBooks: 50,
          totalUsers: 10,
        })}
        initialSummaryPromise={Promise.resolve({
          attendanceTrends: [{ label: 'Nov 1', count: 3 }],
          peakHours: [{ hour: '10 AM', count: 5 }],
          borrowingTrends: [{ label: 'Nov 1', count: 2 }],
          categoryDistribution: [{ name: 'History & Biography', value: 22 }],
          popularBooks: [
            { id: 'b-1', title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', count: 4 },
          ],
        })}
        initialDates={{ from: '2026-10-18', to: '2026-11-16' }}
      />
    );

    const demandBarFill = analyticsHandle.container.querySelector('.bg-primary.rounded-full');
    expect(demandBarFill).toBeInTheDocument();
  });

  it('F33 & F34: AuditLogClient renders mobile/tablet cards without min-w-[1000px] clipping and AuditLogExportImportModal aligns format cards', async () => {
    const sampleLog = {
      id: 'log-1',
      admin_id: 'admin-1',
      entity_type: 'book',
      entity_id: 'b-1',
      action: 'create',
      reason: 'Added book',
      details: { added: [{ title: 'Clean Code' }] },
      old_value: null,
      new_value: null,
      created_at: '2026-11-16T10:00:00.000Z',
      profiles: { full_name: 'Elena Reyes', email: 'elena@lumina.edu', role: 'librarian' },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ logs: [sampleLog], total: 1 }), { status: 200 }))
    );

    const { container } = await renderClient(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AuditLogClient />
      </SWRConfig>
    );

    await vi.waitFor(() => {
      expect(container.querySelector('table')).toBeInTheDocument();
    });

    const table = container.querySelector('table')!;
    expect(table.className).not.toContain('min-w-[1000px]');
    expect(container.querySelector('.lg\\:hidden')).toHaveTextContent('Elena Reyes');

    cleanupClients();

    await renderClient(
      <AuditLogExportImportModal isOpen={true} onClose={vi.fn()} currentFilters={{}} />
    );

    const formatBtns = Array.from(document.body.querySelectorAll('button[aria-pressed]')).filter((b) =>
      /Spreadsheet CSV|Developer JSON|Excel XLSX/.test(b.textContent || '')
    );
    expect(formatBtns).toHaveLength(3);
    for (const btn of formatBtns) {
      expect(btn.className).toContain('h-full');
      expect(btn.className).not.toContain('col-span-2');
    }
  });
});
