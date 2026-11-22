import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { SWRConfig } from 'swr';
import { renderClient, cleanupClients, clickElement } from './helpers/render';
import { createMockSupabaseClient } from './mocks/supabase';

// Polyfills for jsdom + Radix UI
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => true,
    })),
  });
}

// External boundary mocks
const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/inventory',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/font/google', () => ({
  Manrope: () => ({
    className: 'font-manrope-class',
    variable: '--font-app-sans-var',
  }),
}));

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => null,
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
const mockToastWarning = vi.fn();
vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

const mockGetBooksForExport = vi.fn();
const mockBatchImportBooks = vi.fn();
vi.mock('@/lib/actions/catalog', () => ({
  getBooksForExport: (...args: unknown[]) => mockGetBooksForExport(...args),
  batchImportBooks: (...args: unknown[]) => mockBatchImportBooks(...args),
}));

// Real component imports
import { NotificationsProvider } from '@/components/notifications/NotificationsProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { MainHeader } from '@/components/layout/MainHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { BatchTaskProvider } from '@/components/providers/BatchTaskProvider';
import { ModernInventoryClient } from '@/components/inventory/ModernInventoryClient';
import { AuditLogClient } from '@/components/admin/AuditLogClient';
import { AnimationProvider } from '@/components/providers/animation-provider';
import RootLayout from '@/app/layout';

describe('P2 client performance and duplicate work', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jobs: [], logs: [], total: 0 }),
      })
    );
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
  });

  it('Item 1: NotificationsProvider shares one channel, one initial fetch, and one listener set across mobile and desktop NotificationBells', async () => {
    const helper = createMockSupabaseClient();
    const initialRow = {
      id: 'n-1',
      user_id: 'user-1',
      title: 'Hold Ready',
      content: 'Your reserved book is ready.',
      type: 'RESERVATION',
      priority: 'medium',
      is_read: false,
      metadata: {},
      created_at: '2026-11-15T10:00:00Z',
    };
    helper.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    helper.setTableResponse('notifications', [initialRow], null, 1);

    let statusCb: (status: string) => void = () => {};
    const channelMock = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((cb: (status: string) => void) => {
        statusCb = cb;
        return channelMock;
      }),
    };
    const channelSpy = vi.fn(() => channelMock);
    const removeChannelSpy = vi.fn();

    mockCreateClient.mockReturnValue({
      ...helper.client,
      channel: channelSpy,
      removeChannel: removeChannelSpy,
    });

    const addWindowSpy = vi.spyOn(window, 'addEventListener');

    const { container, unmount } = await renderClient(
      <NotificationsProvider>
        <SidebarProvider open={true}>
          <div data-testid="mobile-bell">
            <NotificationBell />
          </div>
          <MainHeader />
        </SidebarProvider>
      </NotificationsProvider>
    );

    await vi.waitFor(() => {
      const bells = container.querySelectorAll('button[aria-label="Notifications, 1 unread"]');
      expect(bells).toHaveLength(2);
    });

    // Exactly one Supabase client/channel and one initial fetch (list + head count = 2 from() calls)
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(channelSpy).toHaveBeenCalledTimes(1);
    expect(helper.client.from).toHaveBeenCalledTimes(2);

    // Only one pair of window focus/online listeners registered by NotificationsProvider
    const focusCalls = addWindowSpy.mock.calls.filter(([evt]) => evt === 'focus').length;
    const onlineCalls = addWindowSpy.mock.calls.filter(([evt]) => evt === 'online').length;
    expect(focusCalls).toBe(1);
    expect(onlineCalls).toBe(1);
    addWindowSpy.mockRestore();

    // First SUBSCRIBED resyncs once for both bells (one shared fetch, not one per bell)
    await act(async () => {
      statusCb('SUBSCRIBED');
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(helper.client.from).toHaveBeenCalledTimes(4));

    // Disconnect then reconnect DOES refetch
    helper.setTableResponse(
      'notifications',
      [initialRow, { ...initialRow, id: 'n-2', title: 'Second Notice' }],
      null,
      2
    );
    await act(async () => {
      statusCb('CLOSED');
      statusCb('SUBSCRIBED');
    });

    await vi.waitFor(() => {
      expect(helper.client.from).toHaveBeenCalledTimes(6);
      const bells = container.querySelectorAll('button[aria-label="Notifications, 2 unread"]');
      expect(bells).toHaveLength(2);
    });

    unmount();
    expect(removeChannelSpy).toHaveBeenCalledTimes(1);
  });

  it('Item 2: ModernInventoryClient dynamically imports xlsx for .xlsx import and CSV/Excel export', async () => {
    const helper = createMockSupabaseClient();
    mockCreateClient.mockReturnValue({
      ...helper.client,
      channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
      removeChannel: vi.fn(),
    });

    mockGetBooksForExport.mockResolvedValue([
      {
        id: 'b-1',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780132350884',
        dewey_decimal: '005.1',
        description: 'Craftsmanship',
        published_year: 2008,
        cover_url: null,
        tags: ['software'],
        location: 'Shelf A',
        section: 'CS',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        categories: { name: 'Engineering' },
      },
    ]);

    const { container } = await renderClient(
      <BatchTaskProvider>
        <ModernInventoryClient
          books={[]}
          totalItems={0}
          categories={[]}
          canManage={true}
        />
      </BatchTaskProvider>
    );

    const batchBtn = container.querySelector('button[aria-label="Batch operations"]');
    await clickElement(batchBtn);

    // 1. Real .xlsx import parsing
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { Title: 'Domain-Driven Design', Author: 'Eric Evans', ISBN: '9780321125217', Copies: 2 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Books');
    const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const xlsxFile = new File([xlsxBytes], 'catalog.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const fileInput = document.body.querySelector(
      'input[aria-label="Choose JSON, CSV or Excel file"]'
    ) as HTMLInputElement;
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [xlsxFile], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Successfully parsed 1 valid book records.');
      expect(document.body).toHaveTextContent('Domain-Driven Design');
    });

    // 2. CSV export via dynamic import("xlsx")
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const exportTab = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Export Data')
    );
    await clickElement(exportTab);

    const csvBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Text CSV')
    );
    await clickElement(csvBtn);

    await vi.waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Catalog exported to CSV successfully!');
    });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(anchorClickSpy).toHaveBeenCalled();

    createObjectURLSpy.mockRestore();
    anchorClickSpy.mockRestore();
  });

  it('Item 2: AuditLogClient lazy-loads the export modal on click', async () => {
    // AuditLogClient does not mount AuditLogExportModal until Export is clicked
    const { container } = await renderClient(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AuditLogClient />
      </SWRConfig>
    );

    expect(document.body).not.toHaveTextContent('Export Audit Logs');
    const openBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Export'
    );
    await clickElement(openBtn);

    await vi.waitFor(() => {
      expect(document.body).toHaveTextContent('Export Audit Logs');
    });
  });

  it('Item 3: RootLayout applies Manrope CSS variable on <html> and keeps AnimationProvider mounted for root error boundary', () => {
    const tree = RootLayout({ children: <div data-testid="child">Content</div> });
    expect(tree.type).toBe('html');
    expect(tree.props.className).toContain('--font-app-sans-var');

    const bodyEl = React.Children.toArray(tree.props.children).find(
      (child): child is React.ReactElement<{ className?: string; children?: React.ReactNode }> =>
        React.isValidElement(child) && child.type === 'body'
    );
    expect(bodyEl).toBeDefined();
    expect(bodyEl?.props.className).toContain('font-manrope-class');

    const providerEl = React.Children.toArray(bodyEl?.props.children).find(
      (child): child is React.ReactElement =>
        React.isValidElement(child) && child.type === AnimationProvider
    );
    expect(providerEl).toBeDefined();
  });
});
