import * as React from 'react';
import { Suspense, act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockSupabaseClient,
  createMockQueryBuilder,
  type MockSupabaseClientHelper,
} from '@/test/mocks/supabase';
import { renderClient, cleanupClients, clickElement } from '@/test/helpers/render';

const mockRevalidateTag = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockRouterRefresh = vi.fn();

let serverSupa: MockSupabaseClientHelper;
let safeSupa: MockSupabaseClientHelper;
let adminSupa: MockSupabaseClientHelper;

const mockCreateServerClient = vi.fn(async () => serverSupa.client);
const mockCreateSafeClient = vi.fn(() => safeSupa.client);
const mockCreateAdminClient = vi.fn(() => adminSupa.client);
const mockCreateBrowserClient = vi.fn();

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/',
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateServerClient(),
  createSafeClient: () => mockCreateSafeClient(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateBrowserClient(),
}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import {
  createBook,
  updateBook,
  softDeleteBook,
  restoreBook,
} from '@/lib/actions/catalog/books';
import { addBookCopies, updateBookCopyStatus } from '@/lib/actions/catalog/copies';
import { POST as categoriesPost } from '@/app/api/admin/categories/route';
import {
  PUT as categoryByIdPut,
  DELETE as categoryByIdDelete,
} from '@/app/api/admin/categories/[id]/route';
import { AttendanceClient } from '@/app/(authenticated)/attendance/AttendanceClient';
import AnalyticsPage from '@/app/(authenticated)/analytics/page';
import { AnalyticsClient } from '@/app/(authenticated)/analytics/AnalyticsClient';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { getMe, getPreferences } from '@/lib/auth-helpers';

function setupStaffAuth(
  helper: MockSupabaseClientHelper,
  role: 'super_admin' | 'librarian' | 'student' = 'librarian',
  userId = 'user-1'
) {
  helper.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email: `${role}@sti.edu.ph`, app_metadata: { role } } },
    error: null,
  });
  helper.setTableResponse('profiles', {
    id: userId,
    email: `${role}@sti.edu.ph`,
    full_name: 'Test User',
    role,
    status: 'ACTIVE',
    permissions: {
      manage_circulation: true,
      manage_attendance: true,
      view_admin_dashboard: true,
    },
  });
}

describe('P1 Server Data & Caching Optimizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverSupa = createMockSupabaseClient();
    safeSupa = createMockSupabaseClient();
    adminSupa = createMockSupabaseClient();
    mockCreateServerClient.mockImplementation(async () => serverSupa.client);
    mockCreateSafeClient.mockImplementation(() => safeSupa.client);
    mockCreateAdminClient.mockImplementation(() => adminSupa.client);
    mockCreateBrowserClient.mockReturnValue({
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
  });

  it('Item 1: createBook, updateBook, softDeleteBook, and restoreBook revalidate public-books tag', async () => {
    setupStaffAuth(serverSupa, 'librarian', 'lib-1');

    // createBook
    serverSupa.setTableResponse('books', { id: 'book-1', title: 'Clean Code', isbn: '9780132350884' });
    serverSupa.setTableResponse('book_copies', null);
    const created = await createBook({
      bookData: { title: 'Clean Code', author: 'Robert Martin', isbn: '9780132350884', is_active: true },
      copiesCount: 1,
    });
    expect(created.success).toBe(true);
    expect(mockRevalidateTag).toHaveBeenCalledWith('public-books', 'max');

    // updateBook
    mockRevalidateTag.mockClear();
    serverSupa.setTableResponse('books', { id: 'book-1', title: 'Clean Code 2e' });
    const updated = await updateBook({ id: 'book-1', bookData: { title: 'Clean Code 2e' } });
    expect(updated.success).toBe(true);
    expect(mockRevalidateTag).toHaveBeenCalledWith('public-books', 'max');
    expect(mockRevalidateTag).toHaveBeenCalledWith('book-book-1', 'max');

    // softDeleteBook
    mockRevalidateTag.mockClear();
    serverSupa.setTableResponse('book_copies', null, null, 0);
    serverSupa.setTableResponse('reservations', null, null, 0);
    serverSupa.setTableResponse('books', { id: 'book-1', title: 'Clean Code 2e', is_active: false });
    const archived = await softDeleteBook('book-1');
    expect(archived.success).toBe(true);
    expect(mockRevalidateTag).toHaveBeenCalledWith('public-books', 'max');

    // restoreBook
    mockRevalidateTag.mockClear();
    serverSupa.setTableResponse('books', { id: 'book-1', title: 'Clean Code 2e', is_active: true });
    const restored = await restoreBook('book-1');
    expect(restored.success).toBe(true);
    expect(mockRevalidateTag).toHaveBeenCalledWith('public-books', 'max');
  });

  it('Item 2: copies actions and category routes revalidate /inventory and /student-catalog/<id> instead of /catalog', async () => {
    setupStaffAuth(serverSupa, 'super_admin', 'admin-1');

    // addBookCopies
    serverSupa.setTableResponse('book_copies', null);
    const added = await addBookCopies({ bookId: 'book-42', copiesCount: 2 });
    expect(added.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/student-catalog/book-42');
    expect(mockRevalidatePath).not.toHaveBeenCalledWith('/catalog/book-42');

    // updateBookCopyStatus
    mockRevalidatePath.mockClear();
    const currentCopy = createMockQueryBuilder({ status: 'AVAILABLE' });
    const updatedId = createMockQueryBuilder([{ id: 'copy-1' }]);
    const updatedRow = createMockQueryBuilder({ id: 'copy-1', book_id: 'book-42', status: 'MAINTENANCE' });
    let copyCalls = 0;
    const origFrom = serverSupa.from.getMockImplementation();
    serverSupa.from.mockImplementation((table: string) => {
      if (table === 'book_copies') {
        copyCalls += 1;
        if (copyCalls === 1) return currentCopy;
        if (copyCalls === 2) return updatedId;
        return updatedRow;
      }
      return origFrom ? origFrom(table) : serverSupa.getTableBuilder(table);
    });
    const statusRes = await updateBookCopyStatus({ id: 'copy-1', status: 'MAINTENANCE' });
    expect(statusRes.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/student-catalog/book-42');
    expect(mockRevalidatePath).not.toHaveBeenCalledWith('/catalog');
    expect(mockRevalidatePath).not.toHaveBeenCalledWith('/catalog/book-42');

    // Categories POST, PUT, DELETE
    serverSupa = createMockSupabaseClient();
    setupStaffAuth(serverSupa, 'super_admin', 'admin-1');
    mockRevalidatePath.mockClear();

    serverSupa.setTableResponse('categories', {
      id: 'cat-1',
      name: 'Physics',
      slug: 'physics',
      is_active: true,
    });
    const postRes = await categoriesPost(
      new Request('http://localhost/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Physics' }),
      })
    );
    expect(postRes.status).toBe(201);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory', 'page');
    expect(mockRevalidatePath).not.toHaveBeenCalledWith('/catalog', 'page');

    mockRevalidatePath.mockClear();
    const catBuilder = serverSupa.getTableBuilder('categories');
    catBuilder.single
      .mockResolvedValueOnce({ data: { id: 'cat-1', name: 'Physics', slug: 'physics', description: null, is_active: true }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cat-1', name: 'Astrophysics', slug: 'astrophysics', description: null, is_active: true }, error: null });
    const putRes = await categoryByIdPut(
      new Request('http://localhost/api/admin/categories/cat-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Astrophysics' }),
      }),
      { params: Promise.resolve({ id: 'cat-1' }) }
    );
    expect(putRes.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory', 'page');
    expect(mockRevalidatePath).not.toHaveBeenCalledWith('/catalog', 'page');

    mockRevalidatePath.mockClear();
    serverSupa.setTableResponse('categories', null);
    const delRes = await categoryByIdDelete(
      new Request('http://localhost/api/admin/categories/cat-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'cat-1' }) }
    );
    expect(delRes.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory', 'page');
    expect(mockRevalidatePath).not.toHaveBeenCalledWith('/catalog', 'page');
  });

  it('Item 3: AttendanceClient debounces/coalesces realtime bursts and omits personal refetch for staff', async () => {
    vi.useFakeTimers();
    setupStaffAuth(serverSupa, 'librarian', 'staff-1');
    serverSupa.setTableResponse('attendance', [
      {
        id: 'att-1',
        check_in_at: '2026-11-16T01:00:00Z',
        check_out_at: null,
        user_id: 'stu-1',
        notes: null,
        profiles: { full_name: 'Maria Clara', student_id: '2024-0001' },
      },
    ]);

    const handlers: Array<() => void> = [];
    const channelMock = {
      on: vi.fn((_event: string, _filter: unknown, cb: () => void) => {
        handlers.push(cb);
        return channelMock;
      }),
      subscribe: vi.fn(() => channelMock),
    };
    mockCreateBrowserClient.mockReturnValue({
      channel: vi.fn(() => channelMock),
      removeChannel: vi.fn(),
    });

    const todayP = Promise.resolve([]);
    const allP = Promise.resolve([]);
    const personalP = Promise.resolve([]);

    await act(async () => {
      await renderClient(
        React.createElement(
          Suspense,
          { fallback: React.createElement('div', null, 'Loading') },
          React.createElement(AttendanceClient, {
            systemTodayPromise: todayP,
            systemAllPromise: allP,
            personalHistoryPromise: personalP,
            isStaff: true,
            userId: 'staff-1',
          })
        )
      );
    });
    await act(async () => {
      await Promise.all([todayP, allP, personalP]);
    });

    expect(handlers).toHaveLength(2); // attendance + profiles
    serverSupa.from.mockClear();

    // Fire a burst of 5 realtime events across both tables
    await act(async () => {
      handlers[0]();
      handlers[1]();
      handlers[0]();
      handlers[1]();
      handlers[0]();
    });

    // Before debounce window expires, no queries have fired
    expect(serverSupa.from).not.toHaveBeenCalled();

    // Advance past 300ms debounce window -> exactly 1 coalesced refresh (2 attendance queries: today + all, no personal user_id query)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    const attCalls = serverSupa.from.mock.calls.filter(([t]) => t === 'attendance');
    expect(attCalls).toHaveLength(2);
    const attBuilder = serverSupa.getTableBuilder('attendance');
    expect(attBuilder.eq).not.toHaveBeenCalledWith('user_id', 'staff-1');

    // In-flight coalescing: if an event fires while a refresh is pending, only 1 trailing refresh runs
    serverSupa.from.mockClear();
    let resolveInFlight!: (val: { data: unknown; error: unknown }) => void;
    const inFlightBuilder = createMockQueryBuilder([]);
    inFlightBuilder.limit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveInFlight = resolve;
        })
    );
    serverSupa.from.mockImplementation((table: string) => {
      if (table === 'attendance') return inFlightBuilder;
      return serverSupa.getTableBuilder(table);
    });

    await act(async () => {
      handlers[0]();
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(serverSupa.from.mock.calls.filter(([t]) => t === 'attendance')).toHaveLength(2);

    // Burst 2 events while first refresh is still in flight
    await act(async () => {
      handlers[0]();
      handlers[1]();
      await vi.advanceTimersByTimeAsync(350);
    });
    // Should NOT start a second concurrent fetch while in flight
    expect(serverSupa.from.mock.calls.filter(([t]) => t === 'attendance')).toHaveLength(2);

    // Resolve first in-flight refresh -> triggers exactly 1 trailing refresh
    serverSupa.setTableResponse('attendance', []);
    serverSupa.from.mockImplementation((table: string) => serverSupa.getTableBuilder(table));
    await act(async () => {
      resolveInFlight({ data: [], error: null });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(serverSupa.from.mock.calls.filter(([t]) => t === 'attendance')).toHaveLength(4);
  });

  it('Item 3b: AttendanceClient personal view debounces realtime bursts and fetches personal history', async () => {
    vi.useFakeTimers();
    setupStaffAuth(serverSupa, 'student', 'stu-9');
    serverSupa.setTableResponse('attendance', []);

    const handlers: Array<() => void> = [];
    const channelMock = {
      on: vi.fn((_event: string, _filter: unknown, cb: () => void) => {
        handlers.push(cb);
        return channelMock;
      }),
      subscribe: vi.fn(() => channelMock),
    };
    mockCreateBrowserClient.mockReturnValue({
      channel: vi.fn(() => channelMock),
      removeChannel: vi.fn(),
    });

    const personalP = Promise.resolve([]);
    await act(async () => {
      await renderClient(
        React.createElement(
          Suspense,
          { fallback: React.createElement('div', null, 'Loading') },
          React.createElement(AttendanceClient, {
            personalHistoryPromise: personalP,
            isStaff: false,
            userId: 'stu-9',
          })
        )
      );
    });
    await act(async () => {
      await personalP;
    });

    serverSupa.from.mockClear();
    await act(async () => {
      handlers[0]();
      handlers[1]();
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(serverSupa.from.mock.calls.filter(([t]) => t === 'attendance')).toHaveLength(1);
    expect(serverSupa.getTableBuilder('attendance').eq).toHaveBeenCalledWith('user_id', 'stu-9');
  });

  it('Item 4: AnalyticsPage prefetches default summary + scoped stats in parallel, avoiding client mount round-trip while keeping range switching working', async () => {
    setupStaffAuth(serverSupa, 'super_admin', 'admin-1');

    // Scoped getDashboardStats skips unused tables
    serverSupa.setTableResponse('borrowing_records', null, null, 7);
    serverSupa.setTableResponse('attendance', null, null, 19);
    serverSupa.setTableResponse('books', null, null, 340);
    serverSupa.setTableResponse('profiles', {
      id: 'admin-1',
      role: 'super_admin',
      status: 'ACTIVE',
      permissions: null,
    }, null, 120);

    const scopedStats = await getDashboardStats({ role: 'super_admin', scope: 'analytics' });
    expect(scopedStats.activeBorrows).toBe(7);
    expect(scopedStats.attendanceToday).toBe(19);
    expect(scopedStats.totalBooks).toBe(340);
    expect(scopedStats.totalUsers).toBe(120);
    expect(scopedStats.recentBooks).toEqual([]);
    expect(serverSupa.from).not.toHaveBeenCalledWith('library_cards');
    expect(serverSupa.from).not.toHaveBeenCalledWith('reservations');
    expect(serverSupa.rpc).not.toHaveBeenCalled();
    expect(safeSupa.from).not.toHaveBeenCalled();

    // Full AnalyticsPage -> AnalyticsClient hydration flow
    serverSupa = createMockSupabaseClient();
    setupStaffAuth(serverSupa, 'super_admin', 'admin-1');
    serverSupa.setTableResponse('borrowing_records', null, null, 14);
    serverSupa.setTableResponse('attendance', null, null, 42);
    serverSupa.setTableResponse('books', [
      { id: 'book-99', author: 'Frank Herbert', isbn: '9780441172719' },
    ], null, 520);
    serverSupa.setTableResponse('profiles', {
      id: 'admin-1',
      role: 'super_admin',
      status: 'ACTIVE',
      permissions: null,
    }, null, 180);

    serverSupa.setRpcResponse(
      {
        attendanceTrends: [{ label: 'Nov 1', count: 10 }],
        borrowingTrends: [{ label: 'Nov 1', count: 5 }],
        categoryDistribution: [{ name: 'Sci-Fi', value: 5 }],
        peakHours: [{ hour: '10 AM', count: 8 }],
        popularBooks: [{ id: 'book-99', title: 'Dune', count: 12 }],
      },
      null,
      'get_analytics_summary_window'
    );

    const pageEl = await AnalyticsPage();
    expect(pageEl).not.toBeNull();

    const { container } = await renderClient(pageEl as React.ReactElement);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Server-prefetched summary and stats are rendered immediately
    expect(container).toHaveTextContent('Dune');
    expect(container).toHaveTextContent('Frank Herbert');
    expect(container).toHaveTextContent('42');
    expect(container).toHaveTextContent('520');
    // Only the 1 server RPC call ran — no extra client round-trip after hydration!
    const rpcCallsBeforeSwitch = serverSupa.rpc.mock.calls.filter(
      ([fn]) => fn === 'get_analytics_summary_window'
    );
    expect(rpcCallsBeforeSwitch).toHaveLength(1);

    // Switching range to 7 Days triggers client fetch for the new range
    serverSupa.setRpcResponse(
      {
        attendanceTrends: [{ label: 'Nov 14', count: 3 }],
        borrowingTrends: [{ label: 'Nov 14', count: 1 }],
        categoryDistribution: [],
        peakHours: [],
        popularBooks: [],
      },
      null,
      'get_analytics_summary_window'
    );

    const btn7d = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('7 Days')
    );
    await clickElement(btn7d);
    await act(async () => {
      await Promise.resolve();
    });

    const rpcCallsAfterSwitch = serverSupa.rpc.mock.calls.filter(
      ([fn]) => fn === 'get_analytics_summary_window'
    );
    expect(rpcCallsAfterSwitch).toHaveLength(2);
    expect(btn7d).toHaveAttribute('aria-pressed', 'true');
    expect(container).toHaveTextContent('No circulation data recorded');

    // Fallback: when initialSummaryPromise resolves to null, AnalyticsClient fetches on mount
    cleanupClients();
    serverSupa.rpc.mockClear();
    const fallbackStats = Promise.resolve({
      activeBorrows: 2,
      pendingApprovals: 0,
      myActiveBorrows: 0,
      recentBooks: [],
      attendanceToday: 5,
      totalBooks: 50,
      totalUsers: 20,
    });
    serverSupa.setRpcResponse(
      {
        attendanceTrends: [],
        borrowingTrends: [],
        categoryDistribution: [],
        peakHours: [],
        popularBooks: [{ id: 'book-fallback', title: 'Fallback Title', count: 3 }],
      },
      null,
      'get_analytics_summary_window'
    );
    serverSupa.setTableResponse('books', [{ id: 'book-fallback', author: 'Fallback Author', isbn: null }]);

    const fallbackRender = await renderClient(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', null, 'Loading') },
        React.createElement(AnalyticsClient, {
          statsPromise: fallbackStats,
          initialSummaryPromise: Promise.resolve(null),
          role: 'librarian',
        })
      )
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fallbackRender.container).toHaveTextContent('Fallback Title');
    expect(serverSupa.rpc).toHaveBeenCalledWith('get_analytics_summary_window', expect.any(Object));
  });

  it('Item 5: DashboardContent does not query ui_preferences', async () => {
    setupStaffAuth(serverSupa, 'student', 'stu-1');
    serverSupa.setTableResponse('library_cards', { card_number: 'LC-1', status: 'ACTIVE', expires_at: '2027-01-01' });
    serverSupa.setTableResponse('system_settings', []);
    serverSupa.setTableResponse('attendance', []);
    serverSupa.setTableResponse('reservations', []);
    serverSupa.setTableResponse('borrowing_records', null, null, 0);
    serverSupa.setRpcResponse([], null, 'get_borrowing_history_v2');
    safeSupa.setTableResponse('books', []);

    const el = await DashboardContent({ searchParams: Promise.resolve({}) });
    expect(el).not.toBeNull();
    expect(serverSupa.from).not.toHaveBeenCalledWith('ui_preferences');
    expect(serverSupa.from).toHaveBeenCalledWith('attendance');
  });

  it('Item 6: getMe skips ui_preferences; getPreferences queries profiles and ui_preferences in parallel after getUser', async () => {
    // 1. getMe() alone does NOT query ui_preferences
    setupStaffAuth(serverSupa, 'student', 'stu-1');
    const me = await getMe();
    expect(me?.role).toBe('student');
    expect(serverSupa.from).toHaveBeenCalledWith('profiles');
    expect(serverSupa.from).not.toHaveBeenCalledWith('ui_preferences');

    // 2. getPreferences() starts ui_preferences query BEFORE profiles query resolves (parallel!)
    serverSupa = createMockSupabaseClient();
    let resolveProfile!: (val: { data: unknown; error: unknown }) => void;
    const pendingProfile = new Promise<{ data: unknown; error: unknown }>((resolve) => {
      resolveProfile = resolve;
    });

    const profileBuilder = createMockQueryBuilder(null);
    profileBuilder.single = vi.fn(() => pendingProfile);

    const prefsBuilder = createMockQueryBuilder({ preferences: { compact: true } });

    serverSupa.auth.getUser.mockResolvedValue({
      data: { user: { id: 'stu-2', app_metadata: { role: 'student' } } },
      error: null,
    });
    serverSupa.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileBuilder;
      if (table === 'ui_preferences') return prefsBuilder;
      return serverSupa.getTableBuilder(table);
    });

    const prefsPromise = getPreferences();

    // Yield microtasks so getAuthSession resolves and fires both queries
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Crucial assertion: ui_preferences was queried BEFORE profiles resolved!
    expect(serverSupa.from).toHaveBeenCalledWith('profiles');
    expect(serverSupa.from).toHaveBeenCalledWith('ui_preferences');

    resolveProfile({ data: { id: 'stu-2', role: 'student', status: 'ACTIVE' }, error: null });
    expect(await prefsPromise).toEqual({ compact: true });

    // 3. Returns {} if profile is missing even when ui_preferences has data
    serverSupa = createMockSupabaseClient();
    serverSupa.auth.getUser.mockResolvedValue({
      data: { user: { id: 'stu-missing', app_metadata: {} } },
      error: null,
    });
    serverSupa.setTableResponse('profiles', null, null);
    serverSupa.setTableResponse('ui_preferences', { preferences: { compact: true } }, null);
    expect(await getPreferences()).toEqual({});
  });
});
