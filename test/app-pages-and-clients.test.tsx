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

// ─── External Boundary Mocks ────────────────────────────────────────────────

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
const mockRouter = {
  push: mockRouterPush,
  replace: mockRouterReplace,
  refresh: mockRouterRefresh,
};
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
let mockSearchParams = new URLSearchParams('');
let mockPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    onError,
    className,
  }: {
    src: string;
    alt?: string;
    onError?: () => void;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ''} onError={onError} className={className} />
  ),
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

const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockChannelOn = vi.fn();
const mockChannelSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();
const mockClientChannel = vi.fn();
const mockCreateBrowserClient = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateBrowserClient(),
}));

const mockServerGetUser = vi.fn();
const mockServerProfileSingle = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: () => mockServerGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockServerProfileSingle(),
        }),
      }),
    }),
  }),
}));

const mockGetMe = vi.fn();
const mockGetPreferences = vi.fn();
vi.mock('@/lib/auth-helpers', () => ({
  getMe: () => mockGetMe(),
  getPreferences: () => mockGetPreferences(),
  getUserRole: async () => 'super_admin',
}));

const mockGetPublicBookById = vi.fn();
vi.mock('@/lib/actions/public-catalog', () => ({
  getPublicBookById: (...args: unknown[]) => mockGetPublicBookById(...args),
  getPublicBooksCached: vi.fn(),
  getCategoriesCached: vi.fn(),
}));

const mockGetAnalyticsSummary = vi.fn();
vi.mock('@/lib/actions/analytics', () => ({
  getAnalyticsSummary: (...args: unknown[]) => mockGetAnalyticsSummary(...args),
}));

const mockCreateBook = vi.fn();
const mockGetCategories = vi.fn();
const mockGetBookAdminDetails = vi.fn();
const mockGetBookPublicDetails = vi.fn();
vi.mock('@/lib/actions/catalog', () => ({
  createBook: (...args: unknown[]) => mockCreateBook(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  getBooksForExport: vi.fn().mockResolvedValue([]),
  batchImportBooks: vi.fn(),
  lookupAndImportISBN: vi.fn(),
  getBookAdminDetails: (...args: unknown[]) => mockGetBookAdminDetails(...args),
  getBookPublicDetails: (...args: unknown[]) => mockGetBookPublicDetails(...args),
}));

const mockFetchISBNDetails = vi.fn();
vi.mock('@/lib/actions/isbn-lookup', () => ({
  fetchISBNDetails: (...args: unknown[]) => mockFetchISBNDetails(...args),
}));

const mockReserveTitle = vi.fn();
const mockCancelReservation = vi.fn();
const mockGetBookAvailabilityStatus = vi.fn();
vi.mock('@/lib/actions/reservations', () => ({
  reserveTitle: (...args: unknown[]) => mockReserveTitle(...args),
  cancelReservation: (...args: unknown[]) => mockCancelReservation(...args),
  getBookAvailabilityStatus: (...args: unknown[]) => mockGetBookAvailabilityStatus(...args),
  getMyReservations: vi.fn().mockResolvedValue([]),
}));

const mockGetUsers = vi.fn();
const mockInviteUser = vi.fn();
vi.mock('@/lib/actions/users', () => ({
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  inviteUser: (...args: unknown[]) => mockInviteUser(...args),
}));

const mockCompressImage = vi.fn();
vi.mock('@/lib/image-utils', () => ({
  compressImage: (...args: unknown[]) => mockCompressImage(...args),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  ),
  LineChart: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
    <div data-testid="recharts-line-chart" data-points={data?.length ?? 0}>
      {children}
    </div>
  ),
  Line: ({ stroke }: { stroke?: string }) => (
    <div data-testid="recharts-line" data-stroke={stroke} />
  ),
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-pie-chart">{children}</div>
  ),
  Pie: ({ data, children }: { data?: Array<{ name: string; value: number }>; children?: React.ReactNode }) => (
    <div
      data-testid="recharts-pie"
      data-items={data?.length ?? 0}
      data-first-name={data?.[0]?.name ?? ''}
    >
      {children}
    </div>
  ),
  Cell: ({ fill }: { fill?: string }) => <div data-testid="recharts-cell" data-fill={fill} />,
  BarChart: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
    <div data-testid="recharts-bar-chart" data-bars={data?.length ?? 0}>
      {children}
    </div>
  ),
  Bar: ({ fill }: { fill?: string }) => <div data-testid="recharts-bar" data-fill={fill} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

// ─── Polyfills for jsdom ────────────────────────────────────────────────────

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// ─── Imports Under Test ─────────────────────────────────────────────────────

import { useSWRConfig } from 'swr';
import RootError from '@/app/error';
import RootNotFound from '@/app/not-found';
import sitemap from '@/app/sitemap';
import AuthErrorPage from '@/app/(auth)/error/page';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import UpdatePasswordPage from '@/app/(auth)/update-password/page';
import PublicBookDetailPage from '@/app/(public)/book/[id]/page';

import {
  TrendChart,
  CategoryPieChart,
  PeakHoursBarChart,
  ChartSkeleton,
} from '@/app/(authenticated)/analytics/AnalyticsCharts';
import { AnalyticsClient } from '@/app/(authenticated)/analytics/AnalyticsClient';
import { CatalogContent, CatalogSkeleton } from '@/app/(authenticated)/inventory/CatalogContent';
import { AddBookClient } from '@/app/(authenticated)/inventory/add/AddBookClient';
import { StudentCatalogClient } from '@/app/(authenticated)/student-catalog/StudentCatalogClient';
import { StudentBookDetailClient } from '@/app/(authenticated)/student-catalog/[id]/StudentBookDetailClient';
import { UsersContent } from '@/app/(authenticated)/users/UsersContent';
import { NewUserClient } from '@/app/(authenticated)/users/new/NewUserClient';
import { UserDetailClient } from '@/app/(authenticated)/users/[id]/UserDetailClient';
import { StreamedNav } from '@/app/(authenticated)/_components/StreamedNav';
import { StreamedUserNav } from '@/app/(authenticated)/_components/StreamedUserNav';
import { SWRProvider } from '@/app/(authenticated)/_components/SWRProvider';
import NavAnimatePresence from '@/app/(authenticated)/NavAnimatePresence';
import DashboardLoading from '@/app/(authenticated)/dashboard/DashboardLoading';

import { BatchTaskProvider } from '@/components/providers/BatchTaskProvider';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { SidebarProvider } from '@/components/ui/sidebar';

import AuthenticatedLoading from '@/app/(authenticated)/loading';
import DashboardRouteLoading from '@/app/(authenticated)/dashboard/loading';
import InventoryLoading from '@/app/(authenticated)/inventory/loading';
import InventoryAddLoading from '@/app/(authenticated)/inventory/add/loading';
import CirculationLoading from '@/app/(authenticated)/circulation/loading';
import HistoryLoading from '@/app/(authenticated)/history/loading';
import AttendanceLoading from '@/app/(authenticated)/attendance/loading';
import UsersLoading from '@/app/(authenticated)/users/loading';
import UsersNewLoading from '@/app/(authenticated)/users/new/loading';
import UsersDetailLoading from '@/app/(authenticated)/users/[id]/loading';
import AuditLoading from '@/app/(authenticated)/audit/loading';
import StudentCatalogLoading from '@/app/(authenticated)/student-catalog/loading';
import StudentCatalogDetailLoading from '@/app/(authenticated)/student-catalog/[id]/loading';
import PoliciesLoading from '@/app/(authenticated)/policies/loading';
import AnalyticsLoading from '@/app/(authenticated)/analytics/loading';
import ProfileLoading from '@/app/(authenticated)/profile/loading';
import SecurityLoading from '@/app/(authenticated)/security/loading';

import type { Book, Category, User } from '@/lib/types';
import type { AnalyticsSummary } from '@/lib/actions/analytics';
import type { BookDetail, AvailabilityStatus } from '@/components/catalog/types';

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
  ) as HTMLButtonElement | undefined;
}

describe('App Router Pages, Clients & Loading Skeletons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockSearchParams = new URLSearchParams('');
    mockPathname = '/dashboard';

    mockChannelSubscribe.mockImplementation(() => ({ unsubscribe: vi.fn() }));
    mockChannelOn.mockReturnThis();
    mockClientChannel.mockReturnValue({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    });
    mockCreateBrowserClient.mockReturnValue({
      channel: mockClientChannel,
      removeChannel: mockRemoveChannel,
      auth: {
        resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
        updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      },
    });
    mockGetCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Computer Science' },
      { id: 'cat-2', name: 'Literature' },
    ]);
    mockGetPreferences.mockResolvedValue({});
  });

  afterEach(() => {
    cleanupClients();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ─── 1. Root & Auth / Public Pages ────────────────────────────────────────

  describe('Root Error, NotFound & Sitemap', () => {
    it('renders app/error.tsx, logs error, triggers reset, and shows digest only in development', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const reset = vi.fn();
      const err = Object.assign(new Error('Database timeout'), { digest: 'DIGEST-42' });

      vi.stubEnv('NODE_ENV', 'development');
      const { container } = await renderClient(<RootError error={err} reset={reset} />);

      expect(container).toHaveTextContent('Something went wrong');
      expect(container).toHaveTextContent('Error Digest: DIGEST-42');
      expect(container).toHaveTextContent('Database timeout');
      expect(consoleErrorSpy).toHaveBeenCalledWith(err);

      const homeLink = container.querySelector('a[href="/"]');
      expect(homeLink).toHaveTextContent('Go to Home');

      const tryAgainBtn = findButtonByText(container, 'Try again');
      await clickElement(tryAgainBtn);
      expect(reset).toHaveBeenCalledTimes(1);

      cleanupClients();
      vi.stubEnv('NODE_ENV', 'production');
      const prodRender = await renderClient(<RootError error={err} reset={reset} />);
      expect(prodRender.container).not.toHaveTextContent('Error Digest:');
    });

    it('renders app/not-found.tsx and marks clicked navigation link as aria-busy', async () => {
      const { container } = await renderClient(<RootNotFound />);

      expect(container).toHaveTextContent('Page Not Found');
      const homeLink = container.querySelector('a[href="/"]');
      const dashLink = container.querySelector('a[href="/dashboard"]');
      expect(homeLink).toBeInTheDocument();
      expect(dashLink).toBeInTheDocument();

      homeLink?.addEventListener('click', (e) => e.preventDefault());
      dashLink?.addEventListener('click', (e) => e.preventDefault());

      await clickElement(homeLink);
      expect(homeLink).toHaveAttribute('aria-busy', 'true');
      expect(dashLink).toHaveAttribute('aria-busy', 'false');

      await clickElement(dashLink);
      expect(dashLink).toHaveAttribute('aria-busy', 'true');
    });

    it('builds app/sitemap.ts entries with default and configured NEXT_PUBLIC_SITE_URL', () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
      const defaultEntries = sitemap();
      expect(defaultEntries).toHaveLength(1);
      expect(defaultEntries[0].url).toBe('https://stilumina.vercel.app');
      expect(defaultEntries[0].changeFrequency).toBe('daily');
      expect(defaultEntries[0].priority).toBe(1);
      expect(defaultEntries[0].lastModified).toBeInstanceOf(Date);

      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://library.example.edu');
      const customEntries = sitemap();
      expect(customEntries[0].url).toBe('https://library.example.edu');
    });
  });

  describe('Auth Pages: error, forgot-password, update-password', () => {
    it('renders app/(auth)/error/page.tsx branches for archived, restricted, PKCE, and generic errors', async () => {
      const archived = await renderClient(
        <AuthErrorPage searchParams={Promise.resolve({ error: 'archived_account' })} />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(archived.container).toHaveTextContent('Authentication Error');
      expect(archived.container).toHaveTextContent('Your account has been archived');
      expect(archived.container.querySelector('a[href="/"]')).toHaveTextContent('Back to Sign In');
      cleanupClients();

      const restricted = await renderClient(
        <AuthErrorPage searchParams={Promise.resolve({ error: 'restricted_access' })} />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(restricted.container).toHaveTextContent('STI Alabang');
      expect(restricted.container).toHaveTextContent('firstname.lastname@alabang.sti.edu.ph');
      cleanupClients();

      const pkce = await renderClient(
        <AuthErrorPage searchParams={Promise.resolve({ error: 'PKCE code verifier missing' })} />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(pkce.container).toHaveTextContent('login session timed out');
      cleanupClients();

      const generic = await renderClient(
        <AuthErrorPage searchParams={Promise.resolve({ error: 'oauth_failed' })} />
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(generic.container).toHaveTextContent('Error: oauth_failed');
    });

    it('renders app/(auth)/forgot-password/page.tsx and submits resetPasswordForEmail', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });
      const { container } = await renderClient(<ForgotPasswordPage />);

      expect(container).toHaveTextContent('Reset your password securely.');
      const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
      await typeIntoInput(emailInput, 'librarian@alabang.sti.edu.ph');

      const form = container.querySelector('form') as HTMLFormElement;
      await submitForm(form);

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('librarian@alabang.sti.edu.ph', {
        redirectTo: `${window.location.origin}/update-password`,
      });
      expect(container).toHaveTextContent('Check your email');
    });

    it('redirects students from app/(auth)/update-password/page.tsx and renders form for staff', async () => {
      mockServerGetUser.mockResolvedValue({ data: { user: { id: 'stu-1' } } });
      mockServerProfileSingle.mockResolvedValue({ data: { role: 'student' } });

      await expect(UpdatePasswordPage()).rejects.toThrow('NEXT_REDIRECT:/security');

      mockServerGetUser.mockResolvedValue({ data: { user: { id: 'lib-1' } } });
      mockServerProfileSingle.mockResolvedValue({ data: { role: 'librarian' } });
      mockUpdateUser.mockResolvedValue({ error: null });

      const element = await UpdatePasswordPage();
      const { container } = await renderClient(element);

      expect(container).toHaveTextContent('Set a new password for your account.');
      const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
      await typeIntoInput(passwordInput, 'StrongPass!123');
      await submitForm(container.querySelector('form'));

      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'StrongPass!123' });
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Public Book Detail Page: app/(public)/book/[id]/page.tsx', () => {
    it('renders book metadata when found and fallback message when missing', async () => {
      mockGetPublicBookById.mockResolvedValue({
        id: 'book-1',
        title: 'Clean Architecture',
        author: 'Robert C. Martin',
        isbn: '9780134494166',
        available_copies: 3,
        section: 'CS-A',
        location: '2nd Floor',
        cover_url: null,
        categories: { name: 'Software Engineering' },
        tags: ['Architecture', 'Design'],
      });

      const found = await renderClient(
        <PublicBookDetailPage params={Promise.resolve({ id: 'book-1' })} />
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(found.container.querySelector('a[href="/"]')).toHaveTextContent('Back to Library');
      expect(found.container).toHaveTextContent('Clean Architecture');
      expect(found.container).toHaveTextContent('Robert C. Martin');
      expect(found.container).toHaveTextContent('3 Available');
      expect(found.container).toHaveTextContent('CS-A - 2nd Floor');
      expect(found.container).toHaveTextContent('9780134494166');
      expect(found.container).toHaveTextContent('Software Engineering');
      expect(found.container).toHaveTextContent('Architecture');
      cleanupClients();

      mockGetPublicBookById.mockResolvedValue(null);
      const missing = await renderClient(
        <PublicBookDetailPage params={Promise.resolve({ id: 'missing-id' })} />
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(missing.container).toHaveTextContent('Book not found.');
    });
  });

  // ─── 2. Analytics Charts & Client ─────────────────────────────────────────

  describe('AnalyticsCharts & AnalyticsClient', () => {
    it('renders TrendChart, CategoryPieChart, PeakHoursBarChart, and ChartSkeleton for data & empty states', async () => {
      const onTrendSelect = vi.fn();
      const onCategorySelect = vi.fn();
      const onBarSelect = vi.fn();

      const { container } = await renderClient(
        <div>
          <TrendChart
            title="Circulation Trends"
            color="#111"
            onSelect={onTrendSelect}
            data={[
              { label: 'Mon', count: 4 },
              { label: 'Tue', count: 7 },
            ]}
          />
          <TrendChart title="Empty Trend" color="#222" data={[]} />
          <CategoryPieChart
            title="Genre Popularity"
            onSelect={onCategorySelect}
            data={[
              { name: 'Sci-Fi', value: 10 },
              { name: 'History', value: 5 },
              { name: 'Math', value: 3 },
              { name: 'Art', value: 2 },
              { name: 'Bio', value: 2 },
              { name: 'Chem', value: 1 },
              { name: 'Music', value: 1 },
            ]}
          />
          <CategoryPieChart title="Empty Genres" data={[]} />
          <PeakHoursBarChart
            title="Peak Visiting Hours"
            color="#333"
            onSelect={onBarSelect}
            data={[{ hour: '09:00', count: 12 }]}
          />
          <ChartSkeleton title="Loading Chart" />
        </div>
      );

      expect(container).toHaveTextContent('View Details');
      expect(container).toHaveTextContent('Mon: 4. View records');
      expect(container).toHaveTextContent('24'); // Total across 7 genres
      expect(container).toHaveTextContent('Sci-Fi');
      expect(container).toHaveTextContent('Music');
      expect(container).toHaveTextContent('Waiting for activity...');
      expect(container).toHaveTextContent('09:00: 12. View records');
      expect(container).toHaveTextContent('Loading Chart');

      await clickElement(findButtonByText(container, 'Mon: 4. View records'));
      expect(onTrendSelect).toHaveBeenCalledWith({ label: 'Mon', count: 4 });

      await clickElement(findButtonByText(container, 'Sci-Fi'));
      expect(onCategorySelect).toHaveBeenCalledWith('Sci-Fi');

      await clickElement(findButtonByText(container, '09:00: 12. View records'));
      expect(onBarSelect).toHaveBeenCalledWith('09:00');

      const lineCharts = container.querySelectorAll('[data-testid="recharts-line-chart"]');
      expect(lineCharts[0]).toHaveAttribute('data-points', '2');
      expect(lineCharts[1]).toHaveAttribute('data-points', '7'); // Ghost points
    });

    it('renders AnalyticsClient stats, loads summary, switches ranges, handles errors, and opens book modal', async () => {
      const summary30: AnalyticsSummary = {
        borrowingTrends: [{ label: 'Nov 1', count: 5 }],
        attendanceTrends: [{ label: 'Nov 1', count: 10 }],
        categoryDistribution: [{ name: 'Fiction', value: 5 }],
        peakHours: [{ hour: '10:00', count: 8 }],
        popularBooks: [
          { id: 'book-99', title: 'Dune', author: 'Frank Herbert', isbn: '9780441172719', count: 12 },
        ],
      };
      const summary7: AnalyticsSummary = {
        borrowingTrends: [{ label: 'Nov 14', count: 2 }],
        attendanceTrends: [{ label: 'Nov 14', count: 4 }],
        categoryDistribution: [{ name: 'Science', value: 2 }],
        peakHours: [{ hour: '14:00', count: 3 }],
        popularBooks: [],
      };
      mockGetAnalyticsSummary
        .mockResolvedValueOnce(summary30)
        .mockResolvedValueOnce(summary7);

      mockGetBookAdminDetails.mockResolvedValue({
        book: {
          id: 'book-99',
          title: 'Dune',
          author: 'Frank Herbert',
          isbn: '9780441172719',
          available_copies: 1,
          total_copies: 2,
          categories: { name: 'Fiction' },
          tags: [],
        },
        copies: [],
        queue: [],
      });

      const statsPromise = Promise.resolve({
        activeBorrows: 14,
        pendingApprovals: 3,
        myActiveBorrows: 0,
        recentBooks: [],
        attendanceToday: 42,
        totalBooks: 520,
        totalUsers: 180,
      });

      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <AnalyticsClient statsPromise={statsPromise} role="super_admin" />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(container).toHaveTextContent('42');
      expect(container).toHaveTextContent('520');
      expect(container).toHaveTextContent('180');
      expect(container).toHaveTextContent('Dune');
      expect(mockGetAnalyticsSummary).toHaveBeenCalledWith(
        '30d',
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
      );

      // Open book modal from High Demand Catalog
      await clickElement(findButtonByText(container, 'Dune'));
      expect(mockGetBookAdminDetails).toHaveBeenCalledWith('book-99');

      // Switch range to 7 Days
      const btn7d = findButtonByText(container, '7 Days');
      await clickElement(btn7d);
      expect(mockGetAnalyticsSummary).toHaveBeenCalledWith(
        '7d',
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
      );
      expect(btn7d).toHaveAttribute('aria-pressed', 'true');
      expect(container).toHaveTextContent('No circulation data recorded');

      // Error + Retry flow when summary is cleared: remount with rejection
      cleanupClients();
      mockGetAnalyticsSummary.mockRejectedValueOnce(new Error('Down'));
      const errRender = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <AnalyticsClient statsPromise={statsPromise} role="librarian" />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(errRender.container.querySelector('[role="alert"]')).toHaveTextContent(
        "Analytics data couldn't be loaded."
      );
      expect(mockToastError).toHaveBeenCalledWith('Failed to load analytics data');

      mockGetAnalyticsSummary.mockResolvedValueOnce(summary30);
      await clickElement(findButtonByText(errRender.container, 'Retry'));
      expect(errRender.container).toHaveTextContent('Dune');
    });
  });

  // ─── 3. Inventory CatalogContent & AddBookClient ──────────────────────────

  describe('CatalogContent & AddBookClient', () => {
    it('renders CatalogSkeleton and CatalogContent with ModernInventoryClient', async () => {
      const skeleton = await renderClient(<CatalogSkeleton />);
      expect(skeleton.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      cleanupClients();

      const books: Book[] = [
        {
          id: 'b-1',
          title: 'Designing Data-Intensive Applications',
          author: 'Martin Kleppmann',
          isbn: '9781449373320',
          category_id: 'cat-1',
          categories: { name: 'Computer Science' },
          available_copies: 2,
          total_copies: 3,
          tags: ['Distributed Systems'],
          location: 'Shelf 4',
          section: 'Tech',
          is_active: true,
          created_at: '2026-11-01T00:00:00Z',
        },
      ];
      const categories: Category[] = [{ id: 'cat-1', name: 'Computer Science' }];

      const { container } = await renderClient(
        <BatchTaskProvider>
          <Suspense fallback={<div>Loading</div>}>
            <CatalogContent
              dataPromise={Promise.resolve({ data: books, count: 1 })}
              categories={categories}
              page={1}
              q=""
              stock="all"
              categoryId=""
              canManage={true}
            />
          </Suspense>
        </BatchTaskProvider>
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(container).toHaveTextContent('Designing Data-Intensive Applications');
      expect(container).toHaveTextContent('Martin Kleppmann');
    });

    it('handles ISBN lookup via fetchISBNDetails (success, not found) and book creation in AddBookClient', async () => {
      mockFetchISBNDetails.mockResolvedValueOnce({
        success: true,
        book: {
          isbn: '9780132350884',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          cover_url: '',
          tags: ['Software', 'Agile'],
          description: 'A handbook of agile software craftsmanship.',
          published_year: 2008,
          dewey_decimal: '005.1',
        },
      });

      const { container } = await renderClient(<AddBookClient />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetCategories).toHaveBeenCalled();

      const isbnInput = container.querySelector('input[placeholder="Enter ISBN-10 or ISBN-13"]') as HTMLInputElement;
      await typeIntoInput(isbnInput, '9780132350884');
      await clickElement(findButtonByText(container, 'Fetch Data'));

      expect(mockFetchISBNDetails).toHaveBeenCalledWith('9780132350884');
      expect(mockToastSuccess).toHaveBeenCalledWith('Book details retrieved. Review them before saving.');

      const titleInput = container.querySelector('input[placeholder="e.g. Clean Code"]') as HTMLInputElement;
      const authorInput = container.querySelector('input[placeholder="e.g. Robert C. Martin"]') as HTMLInputElement;
      expect(titleInput.value).toBe('Clean Code');
      expect(authorInput.value).toBe('Robert C. Martin');

      // 2. Not found triggers toast.error
      mockFetchISBNDetails.mockResolvedValueOnce({
        success: false,
        error: 'Book not found in any database. Please enter details manually.',
      });
      await clickElement(findButtonByText(container, 'Fetch Data'));
      expect(mockToastError).toHaveBeenCalledWith(
        'Book not found in any database. Please enter details manually.'
      );

      // 3. Submit form creates book and navigates to /inventory
      mockCreateBook.mockResolvedValue({ success: true });
      await submitForm(container.querySelector('form'));

      expect(mockCreateBook).toHaveBeenCalledWith({
        bookData: expect.objectContaining({
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '9780132350884',
          tags: ['Software', 'Agile'],
          description: 'A handbook of agile software craftsmanship.',
          published_year: 2008,
          dewey_decimal: '005.1',
        }),
        copiesCount: 1,
      });
      expect(mockRouterRefresh).toHaveBeenCalled();
      expect(mockRouterPush).toHaveBeenCalledWith('/inventory');
    });
  });

  // ─── 4. Student Catalog & Book Detail Client ──────────────────────────────

  describe('StudentCatalogClient & StudentBookDetailClient', () => {
    it('renders StudentCatalogClient books, filters, search, and empty state', async () => {
      const books: Book[] = [
        {
          id: 'sb-1',
          title: 'Refactoring',
          author: 'Martin Fowler',
          isbn: '9780201485677',
          available_copies: 2,
          total_copies: 2,
          tags: ['Engineering'],
          section: 'CS',
          location: 'Floor 2',
          is_active: true,
        },
      ];
      const categories: Category[] = [{ id: 'cat-1', name: 'Computer Science' }];

      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <StudentCatalogClient
            booksPromise={Promise.resolve({ books, total: 1, hasMore: false })}
            categoriesPromise={Promise.resolve(categories)}
            reservationsPromise={Promise.resolve([
              { status: 'ACTIVE', queue_position: 2, books: { id: 'sb-1' } },
            ])}
            initialFilters={{
              q: '',
              categoryId: '',
              availableOnly: false,
              page: 1,
              sortBy: 'newest',
            }}
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(container).toHaveTextContent('Refactoring');
      expect(container).toHaveTextContent('1 book found.');
      expect(container).toHaveTextContent('#2');

      // Press Enter in search input triggers router.replace
      const searchInput = container.querySelector('input[aria-label="Search the catalog"]') as HTMLInputElement;
      await typeIntoInput(searchInput, 'Fowler');
      await pressKey(searchInput, 'Enter');
      expect(mockRouterReplace).toHaveBeenCalledWith('?q=Fowler', { scroll: false });

      // Toggle Available filter
      const availableBtn = findButtonByText(container, 'Available');
      await clickElement(availableBtn);
      expect(mockRouterReplace).toHaveBeenCalledWith('?available=true', { scroll: false });

      // Empty state with Clear all filters
      cleanupClients();
      mockSearchParams = new URLSearchParams('q=nonexistent');
      const emptyRender = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <StudentCatalogClient
            booksPromise={Promise.resolve({ books: [], total: 0, hasMore: false })}
            categoriesPromise={Promise.resolve(categories)}
            reservationsPromise={Promise.resolve([])}
            initialFilters={{
              q: 'nonexistent',
              categoryId: '',
              availableOnly: false,
              page: 1,
              sortBy: 'relevance',
            }}
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(emptyRender.container).toHaveTextContent('No matching books found');
      await clickElement(findButtonByText(emptyRender.container, 'Clear all filters'));
      expect(mockRouterReplace).toHaveBeenCalledWith('?', { scroll: false });
    });

    it('renders StudentBookDetailClient for found book, ready pickup banner, cancel reservation, and missing book', async () => {
      const book: BookDetail = {
        id: 'sb-9',
        title: 'Domain-Driven Design',
        author: 'Eric Evans',
        isbn: '9780321125217',
        available_copies: 0,
        total_copies: 2,
        section: 'Software',
        location: 'Room 201',
        cover_url: null,
        categories: { name: 'Architecture' },
        tags: ['DDD', 'Modeling', 'Patterns', 'OOP', 'Extra'],
      };
      const availability: AvailabilityStatus = {
        hasReservation: true,
        reservationId: 'res-9',
        isReady: true,
        queuePosition: 1,
        holdExpiresAt: '2026-11-20T12:00:00Z',
        nextAvailableDate: null,
      };
      mockCancelReservation.mockResolvedValue({ success: true });

      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <StudentBookDetailClient
            id="sb-9"
            bookPromise={Promise.resolve(book)}
            availabilityPromise={Promise.resolve(availability)}
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(container).toHaveTextContent('Domain-Driven Design');
      expect(container).toHaveTextContent('Ready for Pickup');
      expect(container).toHaveTextContent('Pick up by');
      expect(container).toHaveTextContent('+1'); // 5 tags -> 4 + "+1"

      // Open cancel dialog and confirm
      await clickElement(findButtonByText(container, 'Cancel Reservation'));
      const confirmBtn = findButtonByText(document.body, 'Yes, Cancel');
      await clickElement(confirmBtn);
      expect(mockCancelReservation).toHaveBeenCalledWith('res-9');
      expect(mockToastSuccess).toHaveBeenCalledWith('Reservation cancelled', {
        id: 'reservation-toast',
      });

      // Missing book fallback
      cleanupClients();
      const missingRender = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <StudentBookDetailClient
            id="missing"
            bookPromise={Promise.resolve(null)}
            availabilityPromise={Promise.resolve({
              hasReservation: false,
              isReady: false,
              queuePosition: null,
              holdExpiresAt: null,
              nextAvailableDate: null,
              reservationId: null,
            })}
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(missingRender.container).toHaveTextContent('Book not found');
      expect(missingRender.container.querySelector('a[href="/student-catalog"]')).toHaveTextContent(
        'Back to Catalog'
      );
    });
  });

  // ─── 5. Users: UsersContent, NewUserClient, UserDetailClient ──────────────

  describe('UsersContent, NewUserClient & UserDetailClient', () => {
    const sampleUser: User = {
      id: 'usr-1',
      name: 'Juan Dela Cruz',
      email: 'juan@alabang.sti.edu.ph',
      role: 'student',
      status: 'PENDING',
      department: 'BSCS',
      student_id: '2024-1001',
      avatarUrl: null,
      address: 'Alabang',
      phone: '09171234567',
      joined: '2026-01-15',
      updatedAt: '2026-11-01T00:00:00Z',
      onboarding_completed: true,
      library_card: {
        card_number: 'LC-2024-1001',
        status: 'ACTIVE',
        expires_at: '2027-06-01T00:00:00Z',
      },
    };

    it('renders UsersContent rows, hides Super Admin filter for librarian, and fetches filtered users', async () => {
      mockGetUsers.mockResolvedValue({ users: [], total: 0 });

      const libRender = await renderClient(
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

      expect(libRender.container).toHaveTextContent('Juan Dela Cruz');
      expect(libRender.container.querySelector('a[href="/users/usr-1"]')).toBeInTheDocument();

      await clickElement(findButtonByText(libRender.container, 'Filter'));
      expect(findButtonByText(document.body, 'Super Admin')).toBeUndefined();
      await clickElement(findButtonByText(document.body, 'Pending Review'));
      expect(mockGetUsers).toHaveBeenCalledWith({
        tab: 'review',
        search: '',
        page: 1,
        pageSize: 12,
      });

      cleanupClients();
      const adminRender = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <UsersContent
            usersPromise={Promise.resolve({ users: [sampleUser], count: 1 })}
            currentRole="super_admin"
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      await clickElement(findButtonByText(adminRender.container, 'Filter'));
      expect(findButtonByText(document.body, 'Super Admin')).toBeDefined();
    });

    it('invites a user in NewUserClient and surfaces errors when inviteUser fails', async () => {
      mockInviteUser.mockResolvedValueOnce({ success: true });
      const { container } = await renderClient(<NewUserClient currentRole="super_admin" />);

      const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
      const deptInput = container.querySelector('input[name="department"]') as HTMLInputElement;
      await typeIntoInput(emailInput, 'NEW.User@Alabang.sti.edu.ph');
      await typeIntoInput(deptInput, 'Information Technology');
      await submitForm(container.querySelector('form'));

      expect(mockInviteUser).toHaveBeenCalledWith({
        email: 'new.user@alabang.sti.edu.ph',
        role: 'student',
        department: 'Information Technology',
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Access granted to new.user@alabang.sti.edu.ph');
      expect(mockRouterPush).toHaveBeenCalledWith('/users');

      mockInviteUser.mockResolvedValueOnce({ success: false, error: 'User already active' });
      await submitForm(container.querySelector('form'));
      expect(mockToastError).toHaveBeenCalledWith('User already active');
    });

    it('updates profile, verifies pending student, manages SA permissions, and enforces librarian read-only in UserDetailClient', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            user: {
              ...sampleUser,
              name: 'Juan Updated',
              status: 'ACTIVE',
            },
          }),
          { status: 200 }
        )
      );

      // Pending student viewed by super_admin -> Verify & Approve + Other Information + Save Changes
      const { container } = await renderClient(
        <UserDetailClient initialUser={sampleUser} currentRole="super_admin" />
      );

      // Update name and save changes
      const nameInput = container.querySelector('input[placeholder="Full name"]') as HTMLInputElement;
      await typeIntoInput(nameInput, 'Juan Updated');
      await clickElement(findButtonByText(container, 'Save Changes'));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"name":"Juan Updated"'),
        })
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Account updated successfully');

      // Other Information modal displays library card & onboarding metadata
      await clickElement(findButtonByText(container, 'Other Information'));
      expect(document.body).toHaveTextContent('LC-2024-1001');
      expect(document.body).toHaveTextContent('Completed');
      await clickElement(findButtonByText(document.body, 'Close'));

      // Archive modal sets status to ARCHIVED
      await clickElement(findButtonByText(container, 'Archive'));
      const dialogArchiveBtn = Array.from(document.body.querySelectorAll('button')).filter(
        (b) => b.textContent?.trim() === 'Archive'
      ).pop();
      await clickElement(dialogArchiveBtn);
      expect(container).toHaveTextContent('Status ARCHIVED');

      // Student assistant permissions modal
      cleanupClients();
      const saUser: User = {
        ...sampleUser,
        id: 'sa-1',
        role: 'student_assistant',
        status: 'ACTIVE',
        permissions: { manage_circulation: false },
      };
      const saRender = await renderClient(
        <UserDetailClient initialUser={saUser} currentRole="super_admin" />
      );
      await clickElement(findButtonByText(saRender.container, 'Manage Assistant Permissions'));
      expect(document.body).toHaveTextContent('Student Assistant Access Control');
      await clickElement(findButtonByText(document.body, 'Confirm & Close'));

      // Librarian viewing another librarian is read-only
      cleanupClients();
      const libTarget: User = { ...sampleUser, id: 'lib-2', role: 'librarian', status: 'ACTIVE' };
      const roRender = await renderClient(
        <UserDetailClient initialUser={libTarget} currentRole="librarian" />
      );
      expect(roRender.container.querySelector('input[placeholder="Full name"]')).toBeDisabled();
      expect(findButtonByText(roRender.container, 'Archive')).toBeUndefined();
    });
  });

  // ─── 6. Authenticated Layout Helpers ──────────────────────────────────────

  describe('StreamedNav, StreamedUserNav, SWRProvider, NavAnimatePresence & DashboardLoading', () => {
    it('StreamedNav returns null when unauthenticated and renders ProtectedNav when authenticated', async () => {
      mockGetMe.mockResolvedValueOnce(null);
      expect(await StreamedNav()).toBeNull();

      const user = { id: 'u-1', email: 'admin@alabang.sti.edu.ph', user_metadata: {} };
      const profile = {
        id: 'u-1',
        full_name: 'Admin User',
        role: 'super_admin' as const,
        status: 'ACTIVE',
        student_id: null,
        department: 'Library',
        avatar_url: null,
        address: null,
        phone: null,
      };
      mockGetMe.mockResolvedValueOnce({ user, profile, role: 'super_admin' });
      mockGetPreferences.mockResolvedValueOnce({ compact: true });

      const navEl = await StreamedNav();
      expect(navEl).not.toBeNull();

      const { container } = await renderClient(
        <PreferencesProvider
          initialPreferences={{ compact: true }}
          initialRole="super_admin"
          initialProfile={profile}
        >
          <SidebarProvider defaultOpen={true}>{navEl}</SidebarProvider>
        </PreferencesProvider>
      );
      expect(container).toHaveTextContent('Dashboard');
      expect(container).toHaveTextContent('User Directory');
      expect(container).toHaveTextContent('Audit Logs');
    });

    it('StreamedUserNav returns null when unauthenticated and renders UserNav when authenticated', async () => {
      mockGetMe.mockResolvedValueOnce(null);
      expect(await StreamedUserNav()).toBeNull();

      const user = { id: 'u-2', email: 'student@alabang.sti.edu.ph', user_metadata: {} };
      const profile = {
        id: 'u-2',
        full_name: 'Maria Clara',
        role: 'student' as const,
        status: 'ACTIVE',
        student_id: '2024-0002',
        department: 'BSIT',
        avatar_url: null,
        address: null,
        phone: null,
      };
      mockGetMe.mockResolvedValueOnce({ user, profile, role: 'student' });

      const userNavEl = await StreamedUserNav();
      const { container } = await renderClient(
        <PreferencesProvider
          initialPreferences={{ compact: true }}
          initialRole="student"
          initialProfile={profile}
        >
          {userNavEl}
        </PreferencesProvider>
      );
      const trigger = container.querySelector('button[aria-label*="Maria Clara"]');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('MC');
    });

    it('SWRProvider configures expected SWR defaults and NavAnimatePresence renders children', async () => {
      function SwrInspector() {
        const config = useSWRConfig();
        return (
          <div data-testid="swr-values">
            {String(config.revalidateOnFocus)}|{String(config.revalidateOnReconnect)}|
            {String(config.dedupingInterval)}
          </div>
        );
      }

      const { container } = await renderClient(
        <SWRProvider>
          <NavAnimatePresence>
            <SwrInspector />
          </NavAnimatePresence>
        </SWRProvider>
      );
      expect(container.querySelector('[data-testid="swr-values"]')).toHaveTextContent(
        'false|true|5000'
      );
    });

    it('DashboardLoading renders stat, feed, and sidebar skeleton placeholders', async () => {
      const { container } = await renderClient(<DashboardLoading />);
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(8);
    });
  });

  // ─── 7. All Route loading.tsx Skeletons ───────────────────────────────────

  describe('Route loading.tsx Skeletons', () => {
    const loadingComponents: Array<{ name: string; Component: React.ComponentType }> = [
      { name: '(authenticated)', Component: AuthenticatedLoading },
      { name: 'dashboard', Component: DashboardRouteLoading },
      { name: 'inventory', Component: InventoryLoading },
      { name: 'inventory/add', Component: InventoryAddLoading },
      { name: 'circulation', Component: CirculationLoading },
      { name: 'history', Component: HistoryLoading },
      { name: 'attendance', Component: AttendanceLoading },
      { name: 'users', Component: UsersLoading },
      { name: 'users/new', Component: UsersNewLoading },
      { name: 'users/[id]', Component: UsersDetailLoading },
      { name: 'audit', Component: AuditLoading },
      { name: 'student-catalog', Component: StudentCatalogLoading },
      { name: 'student-catalog/[id]', Component: StudentCatalogDetailLoading },
      { name: 'policies', Component: PoliciesLoading },
      { name: 'analytics', Component: AnalyticsLoading },
      { name: 'profile', Component: ProfileLoading },
      { name: 'security', Component: SecurityLoading },
    ];

    it.each(loadingComponents)('renders $name/loading.tsx cleanly', async ({ name, Component }) => {
      const { container } = await renderClient(<Component />);
      expect(container.firstElementChild).not.toBeNull();
      if (name === 'student-catalog/[id]') {
        expect(container).toHaveTextContent('Resource Explorer');
      } else if (name === 'analytics') {
        expect(container.querySelector('svg.animate-spin')).toBeInTheDocument();
      } else {
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      }
    });
  });
});
