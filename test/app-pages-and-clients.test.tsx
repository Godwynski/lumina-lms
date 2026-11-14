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
const mockGetUserRole = vi.fn(async () => 'super_admin');
vi.mock('@/lib/auth-helpers', () => ({
  getMe: () => mockGetMe(),
  getPreferences: () => mockGetPreferences(),
  getUserRole: () => mockGetUserRole(),
}));

const mockGetPublicBookById = vi.fn();
const mockGetPublicBooksCached = vi.fn();
const mockGetCategoriesCached = vi.fn();
vi.mock('@/lib/actions/public-catalog', () => ({
  getPublicBookById: (...args: unknown[]) => mockGetPublicBookById(...args),
  getPublicBooksCached: (...args: unknown[]) => mockGetPublicBooksCached(...args),
  getCategoriesCached: (...args: unknown[]) => mockGetCategoriesCached(...args),
}));

const mockGetAnalyticsSummary = vi.fn();
const mockGetAnalyticsDetail = vi.fn();
vi.mock('@/lib/actions/analytics', () => ({
  getAnalyticsSummary: (...args: unknown[]) => mockGetAnalyticsSummary(...args),
  getAnalyticsDetail: (...args: unknown[]) => mockGetAnalyticsDetail(...args),
}));

const mockGetAttendanceHistory = vi.fn();
const mockToggleAttendanceByCard = vi.fn();
vi.mock('@/lib/actions/attendance', () => ({
  getAttendanceHistory: (...args: unknown[]) => mockGetAttendanceHistory(...args),
  toggleAttendanceByCard: (...args: unknown[]) => mockToggleAttendanceByCard(...args),
}));

const mockPlayScanCue = vi.fn();
vi.mock('@/hooks/use-scan-feedback', () => ({
  useScanFeedback: () => ({ playScanCue: mockPlayScanCue }),
}));

const mockScannerStart = vi.fn();
const mockScannerStop = vi.fn();
const mockScannerSwitch = vi.fn();
const mockScannerRef: {
  onScan: (value: string) => Promise<void>;
  cameraOpen: boolean;
  isInitializing: boolean;
  cameraIssue: string | null;
  hasMultipleCameras: boolean;
} = {
  onScan: async () => {},
  cameraOpen: false,
  isInitializing: false,
  cameraIssue: null,
  hasMultipleCameras: false,
};
vi.mock('@/hooks/use-scanner', () => ({
  useScanner: (options: { onScan: (value: string) => Promise<void>; scannerId?: string }) => {
    mockScannerRef.onScan = options.onScan;
    return {
      cameraOpen: mockScannerRef.cameraOpen,
      startScanner: mockScannerStart,
      stopCamera: mockScannerStop,
      isInitializing: mockScannerRef.isInitializing,
      cameraIssue: mockScannerRef.cameraIssue,
      switchCamera: mockScannerSwitch,
      hasMultipleCameras: mockScannerRef.hasMultipleCameras,
      scannerId: options.scannerId || 'attendance-kiosk-scanner',
    };
  },
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
const mockGetMyReservations = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/actions/reservations', () => ({
  reserveTitle: (...args: unknown[]) => mockReserveTitle(...args),
  cancelReservation: (...args: unknown[]) => mockCancelReservation(...args),
  getBookAvailabilityStatus: (...args: unknown[]) => mockGetBookAvailabilityStatus(...args),
  getMyReservations: (...args: unknown[]) => mockGetMyReservations(...args),
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
  LineChart: ({
    data,
    onClick,
    children,
  }: {
    data?: unknown[];
    onClick?: (state: { activeTooltipIndex?: number | null }) => void;
    children?: React.ReactNode;
  }) => (
    <div
      data-testid="recharts-line-chart"
      data-points={data?.length ?? 0}
      onClick={() => onClick?.({ activeTooltipIndex: 0 })}
    >
      {children}
    </div>
  ),
  Line: ({ stroke }: { stroke?: string }) => (
    <div data-testid="recharts-line" data-stroke={stroke} />
  ),
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-pie-chart">{children}</div>
  ),
  Pie: ({
    data,
    onClick,
    children,
  }: {
    data?: Array<{ name: string; value: number }>;
    onClick?: (entry: unknown, index: number) => void;
    children?: React.ReactNode;
  }) => (
    <div
      data-testid="recharts-pie"
      data-items={data?.length ?? 0}
      data-first-name={data?.[0]?.name ?? ''}
      onClick={() => onClick?.(data?.[0], 0)}
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
  Bar: ({
    fill,
    onClick,
  }: {
    fill?: string;
    onClick?: (entry: { payload?: { hour?: string } }) => void;
  }) => (
    <div
      data-testid="recharts-bar"
      data-fill={fill}
      onClick={() => onClick?.({ payload: { hour: '10:00' } })}
    />
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: ({ content }: { content?: React.ReactElement }) =>
    content && React.isValidElement(content) ? (
      <div data-testid="recharts-tooltip">
        {React.cloneElement(content as React.ReactElement<Record<string, unknown>>, {
          active: true,
          payload: [{ value: 5, stroke: '#111' }],
          label: 'Mon',
        })}
      </div>
    ) : null,
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

if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// ─── Imports Under Test ─────────────────────────────────────────────────────

import { SWRConfig, useSWRConfig } from 'swr';
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
import { AnalyticsDetailModal } from '@/app/(authenticated)/analytics/AnalyticsDetailModal';
import AttendancePage, { AttendanceSkeleton } from '@/app/(authenticated)/attendance/page';
import { AttendanceClient } from '@/app/(authenticated)/attendance/AttendanceClient';
import AuditPage, { AuditSkeleton } from '@/app/(authenticated)/audit/page';
import StudentCatalogPage, { CatalogSkeletonView } from '@/app/(authenticated)/student-catalog/page';
import StudentBookDetailPage, { BookDetailSkeleton } from '@/app/(authenticated)/student-catalog/[id]/page';
import UsersPage, { UsersSkeleton } from '@/app/(authenticated)/users/page';
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
import type { AttendanceRecord } from '@/lib/actions/attendance';
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
    mockGetUserRole.mockResolvedValue('super_admin');
    mockGetMyReservations.mockResolvedValue([]);
    mockGetAttendanceHistory.mockResolvedValue([]);
    mockScannerRef.cameraOpen = false;
    mockScannerRef.isInitializing = false;
    mockScannerRef.cameraIssue = null;
    mockScannerRef.hasMultipleCameras = false;

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  // ─── 8. Authenticated SSR Pages ───────────────────────────────────────────

  describe('Authenticated SSR Pages (attendance, audit, student-catalog, users)', () => {
    it('AttendancePage redirects unauthenticated users, isolates student personal logs, and enables staff/SA system logs', async () => {
      const skel = await renderClient(<AttendanceSkeleton />);
      expect(skel.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      cleanupClients();

      // 1. Unauthenticated -> redirect('/')
      mockGetMe.mockResolvedValueOnce(null);
      await expect(
        AttendancePage({ searchParams: Promise.resolve({}) })
      ).rejects.toThrow('NEXT_REDIRECT:/');

      // 2. Student -> personal logs only
      mockGetMe.mockResolvedValueOnce({
        user: { id: 'stu-1' },
        role: 'student',
        isDeactivatedSA: false,
        hasPermission: () => false,
      });
      mockGetAttendanceHistory.mockResolvedValueOnce([]);
      const studentEl = await AttendancePage({ searchParams: Promise.resolve({ view: 'logs' }) });
      const studentRender = await renderClient(studentEl);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetAttendanceHistory).toHaveBeenCalledTimes(1);
      expect(mockGetAttendanceHistory).toHaveBeenCalledWith('stu-1');
      expect(studentRender.container).toHaveTextContent('All-Time History');
      cleanupClients();

      // 3. Librarian -> system logs (today + all + personal)
      vi.clearAllMocks();
      mockGetMe.mockResolvedValueOnce({
        user: { id: 'lib-1' },
        role: 'librarian',
        isDeactivatedSA: false,
        hasPermission: (p: string) => p === 'manage_attendance',
      });
      mockGetAttendanceHistory.mockResolvedValue([]);
      const staffEl = await AttendancePage({ searchParams: Promise.resolve({}) });
      const staffRender = await renderClient(staffEl);
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetAttendanceHistory).toHaveBeenCalledWith(undefined, { range: 'today' });
      expect(mockGetAttendanceHistory).toHaveBeenCalledWith(undefined, { range: 'all', limit: 300 });
      expect(mockGetAttendanceHistory).toHaveBeenCalledWith('lib-1');
      expect(staffRender.container).toHaveTextContent('Today');
      expect(staffRender.container).toHaveTextContent('All History');
      cleanupClients();

      // 4. Student assistant with manage_attendance & view=logs vs deactivated SA
      vi.clearAllMocks();
      mockGetMe.mockResolvedValueOnce({
        user: { id: 'sa-1' },
        role: 'student_assistant',
        isDeactivatedSA: false,
        hasPermission: (p: string) => p === 'manage_attendance',
      });
      mockGetAttendanceHistory.mockResolvedValue([]);
      const saEl = await AttendancePage({ searchParams: Promise.resolve({ view: 'logs' }) });
      const saRender = await renderClient(saEl);
      await act(async () => {
        await Promise.resolve();
      });
      expect(saRender.container).toHaveTextContent('All History');
      cleanupClients();

      vi.clearAllMocks();
      mockGetMe.mockResolvedValueOnce({
        user: { id: 'sa-2' },
        role: 'student_assistant',
        isDeactivatedSA: true,
        hasPermission: () => true,
      });
      mockGetAttendanceHistory.mockResolvedValue([]);
      const deactivatedEl = await AttendancePage({ searchParams: Promise.resolve({ view: 'logs' }) });
      const deactivatedRender = await renderClient(deactivatedEl);
      await act(async () => {
        await Promise.resolve();
      });
      expect(deactivatedRender.container).toHaveTextContent('All-Time History');
    });

    it('AuditPage redirects non-super_admin and renders AuditLogClient for super_admin', async () => {
      const skel = await renderClient(<AuditSkeleton />);
      expect(skel.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      cleanupClients();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Non-super_admin redirects to /dashboard?error=unauthorized
      mockGetUserRole.mockResolvedValueOnce('librarian');
      const gateEl = AuditPage();
      const gateSuspense = (gateEl.props as { children: React.ReactElement }).children;
      const gateChild = (gateSuspense.props as { children: React.ReactElement }).children;
      const GateFn = gateChild.type as () => Promise<React.ReactElement>;
      await expect(GateFn()).rejects.toThrow('NEXT_REDIRECT:/dashboard?error=unauthorized');

      // super_admin renders AuditLogClient
      mockGetUserRole.mockResolvedValueOnce('super_admin');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ logs: [], total: 0 }),
        })
      );
      const adminGateResult = await GateFn();
      const { container } = await renderClient(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          {adminGateResult}
        </SWRConfig>
      );
      await vi.waitFor(() => {
        expect(container).toHaveTextContent('0 matching records');
      });
      consoleErrorSpy.mockRestore();
    });

    it('StudentCatalogPage resolves searchParams, defaults sortBy, and passes props to StudentCatalogClient', async () => {
      const skel = await renderClient(<CatalogSkeletonView />);
      expect(skel.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      cleanupClients();

      mockGetPublicBooksCached.mockResolvedValue({ books: [], total: 0, hasMore: false });
      mockGetCategoriesCached.mockResolvedValue([{ id: 'cat-1', name: 'Science' }]);
      mockGetMyReservations.mockResolvedValue([]);

      // Default params -> sortBy 'newest'
      const pageEl1 = StudentCatalogPage({ searchParams: Promise.resolve({}) });
      const suspense1 = (pageEl1.props as { children: React.ReactElement }).children;
      const loaderEl1 = (suspense1.props as { children: React.ReactElement }).children;
      const Loader1 = loaderEl1.type as (p: { searchParams: Promise<Record<string, string>> }) => Promise<React.ReactElement>;
      const clientEl1 = await Loader1({ searchParams: Promise.resolve({}) });
      expect(mockGetPublicBooksCached).toHaveBeenCalledWith('', '', '', false, 1, 16, 'newest');
      const r1 = await renderClient(
        <Suspense fallback={<div>Loading</div>}>{clientEl1}</Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(r1.container).toHaveTextContent('No matching books found');
      cleanupClients();

      // Search query -> sortBy 'relevance', plus category, available, page
      vi.clearAllMocks();
      mockGetPublicBooksCached.mockResolvedValue({ books: [], total: 0, hasMore: false });
      mockGetCategoriesCached.mockResolvedValue([]);
      mockGetMyReservations.mockResolvedValue([]);
      await Loader1({
        searchParams: Promise.resolve({
          q: 'clean',
          category: 'cat-1',
          available: 'true',
          page: '2',
        }),
      });
      expect(mockGetPublicBooksCached).toHaveBeenCalledWith(
        'clean',
        'cat-1',
        '',
        true,
        2,
        16,
        'relevance'
      );

      // Explicit sort overrides default
      await Loader1({
        searchParams: Promise.resolve({ q: 'clean', sort: 'title' }),
      });
      expect(mockGetPublicBooksCached).toHaveBeenCalledWith(
        'clean',
        '',
        '',
        false,
        1,
        16,
        'title'
      );
    });

    it('StudentBookDetailPage renders Resource Explorer shell and forwards book/availability promises', async () => {
      const skel = await renderClient(<BookDetailSkeleton />);
      expect(skel.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      cleanupClients();

      const book: BookDetail = {
        id: 'sb-42',
        title: 'The Pragmatic Programmer',
        author: 'Andy Hunt',
        isbn: '9780135957059',
        available_copies: 2,
        total_copies: 3,
        section: 'CS',
        location: 'Floor 1',
        cover_url: null,
        categories: { name: 'Software' },
        tags: [],
      };
      mockGetPublicBookById.mockResolvedValueOnce(book);
      mockGetBookAvailabilityStatus.mockResolvedValueOnce({
        hasReservation: false,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        nextAvailableDate: null,
        reservationId: null,
      });

      const pageEl = StudentBookDetailPage({ params: Promise.resolve({ id: 'sb-42' }) });
      const suspenseEl = (pageEl.props as { children: React.ReactElement }).children;
      const loaderEl = (suspenseEl.props as { children: React.ReactElement }).children;
      const LoaderFn = loaderEl.type as (p: { params: Promise<{ id: string }> }) => Promise<React.ReactElement>;
      const detailClientEl = await LoaderFn({ params: Promise.resolve({ id: 'sb-42' }) });

      expect(mockGetPublicBookById).toHaveBeenCalledWith('sb-42');
      expect(mockGetBookAvailabilityStatus).toHaveBeenCalledWith('sb-42');

      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>{detailClientEl}</Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(container).toHaveTextContent('The Pragmatic Programmer');
      expect(container).toHaveTextContent('Andy Hunt');
    });

    it('UsersPage redirects unauthenticated/non-staff users and loads directory for super_admin', async () => {
      const skel = await renderClient(<UsersSkeleton />);
      expect(skel.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
      cleanupClients();

      // 1. Unauthenticated -> redirect('/')
      mockGetMe.mockResolvedValueOnce(null);
      const unauthEl = UsersPage();
      const unauthSuspense = (unauthEl.props as { children: React.ReactElement }).children;
      const unauthWrapper = (unauthSuspense.props as { children: React.ReactElement }).children;
      const unauthPromise = (unauthWrapper.props as { usersPromise: Promise<unknown> }).usersPromise;
      await expect(unauthPromise).rejects.toThrow('NEXT_REDIRECT:/');

      // 2. Student -> redirect('/dashboard')
      mockGetMe.mockResolvedValueOnce({ role: 'student' });
      const studentEl = UsersPage();
      const studentSuspense = (studentEl.props as { children: React.ReactElement }).children;
      const studentWrapper = (studentSuspense.props as { children: React.ReactElement }).children;
      const studentPromise = (studentWrapper.props as { usersPromise: Promise<unknown> }).usersPromise;
      await expect(studentPromise).rejects.toThrow('NEXT_REDIRECT:/dashboard');

      // 3. Super admin -> calls getUsers and renders UsersContent
      mockGetMe.mockResolvedValueOnce({ role: 'super_admin' });
      mockGetUsers.mockResolvedValueOnce({
        users: [
          {
            id: 'u-10',
            name: 'Ana Reyes',
            email: 'ana@alabang.sti.edu.ph',
            role: 'student',
            status: 'ACTIVE',
            department: 'BSIT',
            student_id: '2025-0010',
            avatarUrl: null,
            address: null,
            phone: null,
            joined: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
        total: 1,
      });

      const adminEl = UsersPage();
      const adminRender = await renderClient(adminEl);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockGetUsers).toHaveBeenCalledWith({ tab: 'all', page: 1, pageSize: 12 });
      expect(adminRender.container).toHaveTextContent('Ana Reyes');
    });
  });

  // ─── 9. Analytics Charts Clicks, Custom Date Range & Detail Modal ─────────

  describe('AnalyticsCharts, AnalyticsClient Custom Dates & AnalyticsDetailModal', () => {
    it('invokes chart onSelect callbacks when clicking LineChart, Pie, and Bar elements', async () => {
      const onTrendSelect = vi.fn();
      const onCategorySelect = vi.fn();
      const onBarSelect = vi.fn();

      const { container } = await renderClient(
        <div>
          <TrendChart
            title="Circulation"
            color="#111"
            onSelect={onTrendSelect}
            data={[{ label: 'Mon', count: 5, from: '2026-11-01', to: '2026-11-01' }]}
          />
          <CategoryPieChart
            title="Genres"
            onSelect={onCategorySelect}
            data={[{ name: 'History', value: 3 }]}
          />
          <PeakHoursBarChart
            title="Hours"
            color="#333"
            onSelect={onBarSelect}
            data={[{ hour: '10:00', count: 8 }]}
          />
        </div>
      );

      await clickElement(container.querySelector('[data-testid="recharts-line-chart"]'));
      expect(onTrendSelect).toHaveBeenCalledWith({
        label: 'Mon',
        count: 5,
        from: '2026-11-01',
        to: '2026-11-01',
      });

      await clickElement(container.querySelector('[data-testid="recharts-pie"]'));
      expect(onCategorySelect).toHaveBeenCalledWith('History');

      await clickElement(container.querySelector('[data-testid="recharts-bar"]'));
      expect(onBarSelect).toHaveBeenCalledWith('10:00');

      expect(container).toHaveTextContent('units');
      expect(container).toHaveTextContent('visits');
    });

    it('validates custom date form, resets custom range, opens AnalyticsDetailModal from charts, and refreshes on realtime', async () => {
      const summary: AnalyticsSummary = {
        borrowingTrends: [{ label: 'Nov 1', count: 5, from: '2026-11-01', to: '2026-11-01' }],
        attendanceTrends: [{ label: 'Nov 1', count: 10 }],
        categoryDistribution: [{ name: 'Fiction', value: 5 }],
        peakHours: [{ hour: '10:00', count: 8 }],
        popularBooks: [],
      };
      mockGetAnalyticsSummary.mockResolvedValue(summary);
      mockGetAnalyticsDetail.mockResolvedValue({ rows: [], total: 0 });

      const statsPromise = Promise.resolve({
        activeBorrows: 4,
        pendingApprovals: 1,
        myActiveBorrows: 0,
        recentBooks: [],
        attendanceToday: 12,
        totalBooks: 100,
        totalUsers: 50,
      });

      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <AnalyticsClient statsPromise={statsPromise} role="super_admin" />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });

      // Open custom date form and test invalid date order
      const details = container.querySelector('details') as HTMLDetailsElement;
      details.open = true;
      const fromInput = details.querySelector('input[name="from"]') as HTMLInputElement;
      const toInput = details.querySelector('input[name="to"]') as HTMLInputElement;

      await typeIntoInput(fromInput, '2026-11-10');
      await typeIntoInput(toInput, '2026-11-05');
      await submitForm(details.querySelector('form'));
      expect(container.querySelector('[role="alert"]')).toHaveTextContent(
        'Choose valid dates in order, within one year.'
      );

      // Submit valid custom date range
      await typeIntoInput(fromInput, '2026-11-01');
      await typeIntoInput(toInput, '2026-11-10');
      await submitForm(details.querySelector('form'));
      expect(container).toHaveTextContent('2026-11-01 – 2026-11-10');
      expect(mockGetAnalyticsSummary).toHaveBeenCalledWith('30d', {
        from: '2026-11-01',
        to: '2026-11-10',
      });

      // Reset custom range
      await clickElement(findButtonByText(container, 'Reset'));
      expect(container).not.toHaveTextContent('2026-11-01 – 2026-11-10');

      // Clicking peak hours bar opens AnalyticsDetailModal
      await clickElement(container.querySelector('[data-testid="recharts-bar"]'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.body).toHaveTextContent('Visits at 10:00');
      expect(mockGetAnalyticsDetail).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'hour', key: '10:00' }),
        1
      );

      // Trigger realtime callback with fake timers
      vi.useFakeTimers();
      const realtimeHandler = mockChannelOn.mock.calls.find(
        ([event]) => event === 'postgres_changes'
      )?.[2] as (() => void) | undefined;
      expect(realtimeHandler).toBeDefined();
      const beforeCount = mockGetAnalyticsSummary.mock.calls.length;
      await act(async () => {
        realtimeHandler?.();
        vi.advanceTimersByTime(550);
      });
      vi.useRealTimers();
      expect(mockGetAnalyticsSummary.mock.calls.length).toBeGreaterThan(beforeCount);
    });

    it('AnalyticsDetailModal handles loading, error retry, empty state, book/borrower drilldown, and pagination', async () => {
      const onClose = vi.fn();
      const selection = {
        kind: 'genre' as const,
        key: 'Fiction',
        title: 'Fiction borrowings',
        from: '2026-11-01',
        to: '2026-11-14',
      };

      // 1. Rejection -> error alert + Retry
      mockGetAnalyticsDetail.mockRejectedValueOnce(new Error('Network down'));
      await renderClient(<AnalyticsDetailModal selection={selection} onClose={onClose} />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.body.querySelector('[role="alert"]')).toHaveTextContent(
        'Records could not be loaded.'
      );

      // 2. Retry succeeds with 25 records (page 1 has book + borrower and visit-only row)
      mockGetAnalyticsDetail.mockResolvedValueOnce({
        total: 25,
        rows: [
          {
            id: 'r-1',
            occurred_at: '2026-11-10T09:00:00Z',
            borrower_id: 'stu-1',
            borrower_name: 'Maria Clara',
            email: 'maria@alabang.sti.edu.ph',
            student_id: '2024-0001',
            book_id: 'book-1',
            book_title: 'Noli Me Tangere',
            status: 'CHECKED_OUT',
          },
          {
            id: 'r-2',
            occurred_at: '2026-11-10T10:00:00Z',
            borrower_id: null,
            borrower_name: null,
            email: null,
            student_id: null,
            book_id: null,
            book_title: null,
            status: 'VISIT_COMPLETED',
          },
        ],
      });
      mockGetBookPublicDetails.mockResolvedValueOnce({
        book: {
          id: 'book-1',
          title: 'Noli Me Tangere',
          author: 'Jose Rizal',
          isbn: '9780143039693',
          available_copies: 1,
          total_copies: 2,
          categories: { name: 'Fiction' },
          tags: [],
        },
        availability: {
          hasReservation: false,
          isReady: false,
          queuePosition: null,
          holdExpiresAt: null,
          nextAvailableDate: null,
          reservationId: null,
        },
      });

      await clickElement(findButtonByText(document.body, 'Retry'));
      await act(async () => {
        await Promise.resolve();
      });

      expect(document.body).toHaveTextContent('25 records');
      expect(document.body).toHaveTextContent('Noli Me Tangere');
      expect(document.body).toHaveTextContent('Library visit');
      expect(document.body).toHaveTextContent('Unavailable borrower');
      expect(document.body).toHaveTextContent('Page 1 of 2');

      // Open borrower modal
      await clickElement(findButtonByText(document.body, 'Maria Clara'));
      expect(document.body).toHaveTextContent('maria@alabang.sti.edu.ph');

      // Open book modal (read_only -> getBookPublicDetails)
      await clickElement(findButtonByText(document.body, 'Noli Me Tangere'));
      expect(mockGetBookPublicDetails).toHaveBeenCalledWith('book-1');

      // Paginate to Next page (returns empty rows) and then Previous page
      mockGetAnalyticsDetail.mockResolvedValueOnce({ total: 25, rows: [] });
      await clickElement(document.body.querySelector('button[aria-label="Next page"]'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetAnalyticsDetail).toHaveBeenLastCalledWith(selection, 2);
      expect(document.body).toHaveTextContent('No records for this selection.');
      expect(document.body).toHaveTextContent('Page 2 of 2');

      mockGetAnalyticsDetail.mockResolvedValueOnce({ total: 25, rows: [] });
      await clickElement(document.body.querySelector('button[aria-label="Previous page"]'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockGetAnalyticsDetail).toHaveBeenLastCalledWith(selection, 1);
    });
  });

  // ─── 10. AttendanceClient Staff & Personal Views ──────────────────────────

  describe('AttendanceClient', () => {
    const makeRecord = (
      id: string,
      name: string,
      studentId: string,
      checkedOut = false
    ): AttendanceRecord => ({
      id,
      user_id: `u-${id}`,
      check_in_at: '2026-11-14T08:00:00.000Z',
      check_out_at: checkedOut ? '2026-11-14T10:00:00.000Z' : null,
      profiles: {
        full_name: name,
        student_id: studentId,
      },
    });

    it('renders staff Today/All History tabs, search, manual check-in/out, load older, and camera modal flows', async () => {
      const todayRecords = [
        makeRecord('1', 'Juan Dela Cruz', '2024-0001', false),
        makeRecord('2', 'Maria Santos', '2024-0002', true),
      ];
      // 300 records so allWindowFull === true -> shows "Load older records"
      const allRecords = Array.from({ length: 300 }, (_, i) =>
        makeRecord(`a-${i}`, `Patron ${i}`, `2024-${1000 + i}`, i % 2 === 0)
      );

      mockGetAttendanceHistory.mockImplementation(
        async (_uid?: string, opts?: { range?: string }) =>
          opts?.range === 'all' ? allRecords : todayRecords
      );

      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <AttendanceClient
            systemTodayPromise={Promise.resolve(todayRecords)}
            systemAllPromise={Promise.resolve(allRecords)}
            personalHistoryPromise={Promise.resolve([])}
            isStaff={true}
            userId="staff-1"
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(container).toHaveTextContent('Juan Dela Cruz');
      expect(container).toHaveTextContent('Still in library');
      expect(container).toHaveTextContent('1 active');
      expect(container).toHaveTextContent('1 completed');

      // Filter Today tab by search
      const searchInput = container.querySelector(
        'input[aria-label="Search attendance by patron name or ID"]'
      ) as HTMLInputElement;
      await typeIntoInput(searchInput, 'Maria');
      expect(container).toHaveTextContent('Maria Santos');
      expect(container).not.toHaveTextContent('Juan Dela Cruz');
      await typeIntoInput(searchInput, '');

      // Manual card entry: success IN, error result, and rejection
      mockToggleAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: {
          status: 'IN',
          userName: 'Pedro Reyes',
          recordedAt: '2026-11-14T09:00:00.000Z',
          message: 'Checked in Pedro Reyes',
          description: 'Timed in successfully.',
        },
      });
      const cardInput = container.querySelector('#attendance-card-id') as HTMLInputElement;
      await typeIntoInput(cardInput, 'LC-9001');
      await submitForm(container.querySelector('form[aria-label="Log attendance"]') as HTMLFormElement);
      expect(mockToggleAttendanceByCard).toHaveBeenCalledWith({
        cardNumber: 'LC-9001',
        isManual: true,
        confirmed: false,
      });
      expect(mockPlayScanCue).toHaveBeenCalledWith('success');
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Transaction recorded',
        expect.objectContaining({ description: 'Checked in Pedro Reyes' })
      );
      expect(cardInput.value).toBe('');

      mockToggleAttendanceByCard.mockResolvedValueOnce({
        success: false,
        error: 'Unknown card ID',
      });
      await typeIntoInput(cardInput, 'BAD-CARD');
      await submitForm(container.querySelector('form[aria-label="Log attendance"]') as HTMLFormElement);
      expect(mockPlayScanCue).toHaveBeenCalledWith('error');
      expect(mockToastError).toHaveBeenCalledWith('Unknown card ID', {
        id: 'attendance-toast-error',
      });

      mockToggleAttendanceByCard.mockRejectedValueOnce(new Error('Network error'));
      await typeIntoInput(cardInput, 'ERR-CARD');
      await submitForm(container.querySelector('form[aria-label="Log attendance"]') as HTMLFormElement);
      expect(mockToastError).toHaveBeenCalledWith('Failed to process attendance transaction.', {
        id: 'attendance-toast-err',
      });

      // Switch to All History tab -> Load older records + server-side debounced search
      await clickElement(findButtonByText(container, 'All History'));
      expect(container).toHaveTextContent('Showing the latest 300 records.');

      mockGetAttendanceHistory.mockResolvedValueOnce([...allRecords, makeRecord('older-1', 'Older User', '2020-0001', true)]);
      await clickElement(findButtonByText(container, 'Load older records'));
      expect(mockGetAttendanceHistory).toHaveBeenCalledWith(undefined, { range: 'all', limit: 600 });

      vi.useFakeTimers();
      mockGetAttendanceHistory.mockResolvedValueOnce([makeRecord('s-1', 'Searched User', '2024-7777', true)]);
      await typeIntoInput(searchInput, 'Searched');
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      vi.useRealTimers();
      expect(mockGetAttendanceHistory).toHaveBeenCalledWith(undefined, {
        range: 'all',
        limit: 600,
        search: 'Searched',
      });
      expect(container).toHaveTextContent('Searched User');

      // Open camera scanner modal -> Discard & Register attendance + cameraIssue/cameraOpen states
      mockScannerRef.cameraIssue = 'Camera permission denied';
      await clickElement(container.querySelector('button[aria-haspopup="dialog"]'));
      expect(document.body).toHaveTextContent('Gate Attendance Scanner');
      expect(document.body).toHaveTextContent('Camera permission denied');
      await clickElement(findButtonByText(document.body, 'Retry camera'));
      expect(mockScannerStart).toHaveBeenCalled();

      // Scan a card -> Discard it -> Scan again -> Register attendance
      await act(async () => {
        await mockScannerRef.onScan('LC-SCAN-1');
      });
      expect(document.body).toHaveTextContent('LC-SCAN-1');
      await clickElement(findButtonByText(document.body, 'Discard'));
      expect(document.body).not.toHaveTextContent('LC-SCAN-1');

      await act(async () => {
        await mockScannerRef.onScan('LC-SCAN-2');
      });
      mockToggleAttendanceByCard.mockResolvedValueOnce({
        success: true,
        data: {
          status: 'OUT',
          userName: 'Elena Cruz',
          recordedAt: '2026-11-14T11:30:00.000Z',
          message: 'Checked out Elena Cruz',
          description: 'Timed out successfully.',
        },
      });
      await clickElement(findButtonByText(document.body, 'Register attendance'));
      expect(mockToggleAttendanceByCard).toHaveBeenCalledWith({
        cardNumber: 'LC-SCAN-2',
        isManual: false,
        confirmed: true,
      });
      expect(document.body).toHaveTextContent('Elena Cruz');

      // Trigger realtime update
      const realtimeCb = mockChannelOn.mock.calls.find(
        ([event]) => event === 'postgres_changes'
      )?.[2] as (() => Promise<void>) | undefined;
      await act(async () => {
        await realtimeCb?.();
      });
      expect(mockGetAttendanceHistory).toHaveBeenCalled();
    });

    it('renders camera controls when cameraOpen is true and renders student personal AttendanceClient view', async () => {
      mockScannerRef.cameraOpen = true;
      mockScannerRef.hasMultipleCameras = true;

      const staffRender = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <AttendanceClient
            systemTodayPromise={Promise.resolve([])}
            systemAllPromise={Promise.resolve([])}
            personalHistoryPromise={Promise.resolve([])}
            isStaff={true}
            userId="staff-2"
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });

      await clickElement(staffRender.container.querySelector('button[aria-haspopup="dialog"]'));
      await clickElement(document.body.querySelector('button[aria-label="Switch camera"]'));
      expect(mockScannerSwitch).toHaveBeenCalledTimes(1);
      await clickElement(findButtonByText(document.body, 'Stop camera'));
      expect(mockScannerStop).toHaveBeenCalled();
      cleanupClients();

      // Personal student view with pagination & records
      const personalRecords = Array.from({ length: 12 }, (_, i) =>
        makeRecord(`p-${i}`, 'Student Self', '2024-0001', i > 0)
      );
      const personalRender = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <AttendanceClient
            personalHistoryPromise={Promise.resolve(personalRecords)}
            isStaff={false}
            userId="stu-99"
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(personalRender.container).toHaveTextContent('All-Time History');
      expect(personalRender.container).toHaveTextContent('Still in library');
      expect(personalRender.container).toHaveTextContent('Showing 1-10 of 12');

      // Trigger personal realtime refresh (latest subscription belongs to personalRender)
      const realtimeCb = mockChannelOn.mock.calls
        .filter(([event]) => event === 'postgres_changes')
        .at(-1)?.[2] as (() => Promise<void>) | undefined;
      mockGetAttendanceHistory.mockResolvedValueOnce(personalRecords.slice(0, 1));
      await act(async () => {
        await realtimeCb?.();
      });
      expect(mockGetAttendanceHistory).toHaveBeenCalledWith('stu-99');
    });
  });

  // ─── 11. StudentCatalogClient & StudentBookDetailClient Uncovered Paths ───

  describe('StudentCatalogClient & StudentBookDetailClient Edge Paths', () => {
    it('supports debounced typing, clear search button, category dropdown toggle/clear, Reset button, and realtime refresh', async () => {
      const books: Book[] = [
        {
          id: 'sb-2',
          title: 'Pragmatic Thinking',
          author: 'Andy Hunt',
          isbn: '9781934356050',
          available_copies: 1,
          total_copies: 1,
          tags: [],
          section: 'CS',
          location: 'Floor 1',
          is_active: true,
        },
      ];
      const categories: Category[] = [
        { id: 'cat-1', name: 'Computer Science' },
        { id: 'cat-2', name: 'Literature' },
      ];

      mockSearchParams = new URLSearchParams('category=cat-1');
      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <StudentCatalogClient
            booksPromise={Promise.resolve({ books, total: 20, hasMore: true })}
            categoriesPromise={Promise.resolve(categories)}
            reservationsPromise={Promise.resolve([])}
            initialFilters={{
              q: '',
              categoryId: 'cat-1',
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

      // Category label displays single selected category name
      expect(container).toHaveTextContent('Computer Science');

      // Debounced search typing -> calls router.replace
      vi.useFakeTimers();
      const searchInput = container.querySelector('input[aria-label="Search the catalog"]') as HTMLInputElement;
      await typeIntoInput(searchInput, 'Pragmatic');
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      vi.useRealTimers();
      expect(mockRouterReplace).toHaveBeenCalledWith('?category=cat-1&q=Pragmatic', { scroll: false });

      // Clear search (X button)
      await clickElement(container.querySelector('button[aria-label="Clear search"]'));
      expect(searchInput.value).toBe('');

      // Reset button clears active filters
      await clickElement(findButtonByText(container, 'Reset'));
      expect(mockRouterReplace).toHaveBeenCalledWith('?', { scroll: false });

      // Realtime subscription triggers router.refresh after debounce
      vi.useFakeTimers();
      const realtimeCb = mockChannelOn.mock.calls.find(
        ([event]) => event === 'postgres_changes'
      )?.[2] as (() => void) | undefined;
      await act(async () => {
        realtimeCb?.();
        vi.advanceTimersByTime(550);
      });
      vi.useRealTimers();
      expect(mockRouterRefresh).toHaveBeenCalled();
    });

    it('StudentBookDetailClient renders queue badge, nextAvailableDate hint, image fallback, and cancel error toast', async () => {
      const book: BookDetail = {
        id: 'sb-12',
        title: 'Operating Systems',
        author: 'Silberschatz',
        isbn: '9781118063330',
        available_copies: 0,
        total_copies: 1,
        section: 'Tech',
        location: 'Floor 3',
        cover_url: 'https://example.com/broken.jpg',
        categories: { name: 'Systems' },
        tags: ['OS'],
      };
      const availability: AvailabilityStatus = {
        hasReservation: false,
        reservationId: null,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        nextAvailableDate: '2026-11-25T12:00:00Z',
      };

      const { container } = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <StudentBookDetailClient
            id="sb-12"
            bookPromise={Promise.resolve(book)}
            availabilityPromise={Promise.resolve(availability)}
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(container).toHaveTextContent('A copy is expected to be returned by');

      // Cover image onError falls back to default cover
      const img = container.querySelector('img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('https://example.com/broken.jpg');
      await act(async () => {
        img.dispatchEvent(new Event('error'));
      });
      expect(img.getAttribute('src')).toBe('/images/default-book-cover.png');

      // Queue reservation state + cancel error toast
      cleanupClients();
      mockCancelReservation.mockRejectedValueOnce(new Error('Cancel failed'));
      const queuedRender = await renderClient(
        <Suspense fallback={<div>Loading</div>}>
          <StudentBookDetailClient
            id="sb-13"
            bookPromise={Promise.resolve(book)}
            availabilityPromise={Promise.resolve({
              hasReservation: true,
              reservationId: 'res-13',
              isReady: false,
              queuePosition: 3,
              holdExpiresAt: null,
              nextAvailableDate: null,
            })}
          />
        </Suspense>
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(queuedRender.container).toHaveTextContent('Queue #3');

      await clickElement(findButtonByText(queuedRender.container, 'Cancel Reservation'));
      await clickElement(findButtonByText(document.body, 'Yes, Cancel'));
      expect(mockToastError).toHaveBeenCalledWith('Cancel failed', { id: 'reservation-toast' });
    });
  });
});
