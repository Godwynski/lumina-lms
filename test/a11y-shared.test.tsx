import * as React from 'react';
import { Suspense, act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderClient, cleanupClients } from './helpers/render';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

let mockPathname = '/dashboard';
let mockSearchParamsString = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

type RealtimeHandler = (payload: { new: Record<string, unknown> }) => void;
const registeredChannels: Array<{
  name: string;
  handlers: Array<{ event: string; table?: string; callback: RealtimeHandler }>;
}> = [];

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      const entry = {
        name,
        handlers: [] as Array<{ event: string; table?: string; callback: RealtimeHandler }>,
      };
      registeredChannels.push(entry);
      const builder = {
        on: (
          _type: string,
          filter: { event?: string; table?: string },
          callback: RealtimeHandler
        ) => {
          entry.handlers.push({
            event: filter.event ?? '*',
            table: filter.table,
            callback,
          });
          return builder;
        },
        subscribe: () => builder,
      };
      return builder;
    },
    removeChannel: vi.fn().mockResolvedValue('ok'),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

import { LuminaTable, type LuminaColumn } from '@/components/common/LuminaTable';
import { BreadcrumbNav } from '@/components/layout/BreadcrumbNav';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import MyCardContainer from '@/components/library/MyCardContainer';
import { StudentBookDetailClient } from '@/app/(authenticated)/student-catalog/[id]/StudentBookDetailClient';
import { LiveActivityTicker } from '@/components/dashboard/LiveActivityTicker';
import { CategoryDialog } from '@/components/admin/categories/CategoryDialog';
import { PersonalInfoForm } from '@/components/settings/profile/PersonalInfoForm';
import { SecuritySection } from '@/components/settings/sections/SecuritySection';
import { CategoryPieChart } from '@/app/(authenticated)/analytics/AnalyticsCharts';
import type { BookDetail, AvailabilityStatus } from '@/components/catalog/types';

describe('A11y fixes (shared, layout, dashboard, settings)', () => {
  beforeEach(() => {
    registeredChannels.length = 0;
    mockPathname = '/dashboard';
    mockSearchParamsString = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          qr_url: '',
          profile_url: '',
          qr_exists: false,
          profile_exists: false,
          ready: false,
        }),
      })
    );
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('LuminaTable sets scope="col" on all column header <th> elements', async () => {
    interface Row {
      id: string;
      title: string;
      status: string;
    }
    const columns: LuminaColumn<Row>[] = [
      { header: 'Title', accessor: 'title' },
      { header: 'Status', accessor: 'status' },
    ];
    const { container } = await renderClient(
      <LuminaTable
        data={[{ id: '1', title: 'Clean Code', status: 'Available' }]}
        columns={columns}
      />
    );

    const headers = Array.from(container.querySelectorAll('thead th'));
    expect(headers).toHaveLength(2);
    for (const th of headers) {
      expect(th).toHaveAttribute('scope', 'col');
    }
  });

  it('Heading hierarchy: BreadcrumbNav keeps h1 while AdminTableShell, MyCardContainer, and StudentBookDetailClient use h2 without skipped levels', async () => {
    mockPathname = '/users';
    const shellHandle = await renderClient(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="super_admin">
        <BreadcrumbNav />
        <AdminTableShell title="User Directory" description="Manage library accounts">
          <div>Rows</div>
        </AdminTableShell>
      </PreferencesProvider>
    );

    expect(shellHandle.container.querySelectorAll('h1')).toHaveLength(1);
    expect(shellHandle.container.querySelector('h1')).toHaveTextContent('User Directory');
    const shellHeading = shellHandle.container.querySelector('h2');
    expect(shellHeading).toHaveTextContent('User Directory');
    expect(shellHeading?.className).toContain('text-2xl');

    cleanupClients();

    const baseCardData = {
      fullName: 'Maria Clara',
      studentId: '2026-0001',
      cardNumber: 'LIB-0001',
      department: 'BSCS',
      status: 'active' as const,
      expiryDate: '2027-06-30',
      avatarUrl: null,
      qrUrl: 'https://example.com/qr.png',
    };

    mockPathname = '/dashboard';
    const cardHandle = await renderClient(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="patron">
        <BreadcrumbNav />
        <MyCardContainer initialData={baseCardData} variant="dashboard" />
      </PreferencesProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(cardHandle.container.querySelectorAll('h1')).toHaveLength(1);
    expect(cardHandle.container.querySelector('h1')).toHaveTextContent('Dashboard');
    expect(
      Array.from(cardHandle.container.querySelectorAll('h2')).some((el) =>
        el.textContent?.includes('Maria Clara')
      )
    ).toBe(true);

    await cardHandle.rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="patron">
        <BreadcrumbNav />
        <MyCardContainer initialData={baseCardData} variant="page" />
      </PreferencesProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(cardHandle.container.querySelectorAll('h1')).toHaveLength(1);
    const pageH2Texts = Array.from(cardHandle.container.querySelectorAll('h2')).map((el) =>
      el.textContent?.trim()
    );
    expect(pageH2Texts).toContain('My Digital Card');
    expect(pageH2Texts).toContain('Quick Guide');

    cleanupClients();

    mockPathname = '/student-catalog/123e4567-e89b-12d3-a456-426614174000';
    const book: BookDetail = {
      id: 'book-1',
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '9780134757599',
      available_copies: 2,
      total_copies: 3,
      section: 'CS',
      location: '2F',
      cover_url: null,
      categories: { name: 'Software' },
      tags: [],
    };
    const availability: AvailabilityStatus = {
      hasReservation: false,
      reservationId: null,
      isReady: false,
      queuePosition: null,
      holdExpiresAt: null,
      nextAvailableDate: null,
    };

    const bookHandle = await renderClient(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="patron">
        <BreadcrumbNav />
        <AdminTableShell title="Resource Explorer" description="Details">
          <Suspense fallback={<div>Loading</div>}>
            <StudentBookDetailClient
              id="book-1"
              bookPromise={Promise.resolve(book)}
              availabilityPromise={Promise.resolve(availability)}
            />
          </Suspense>
        </AdminTableShell>
      </PreferencesProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(bookHandle.container.querySelectorAll('h1')).toHaveLength(1);
    expect(bookHandle.container.querySelector('h1')).toHaveTextContent('Book Details');
    const detailH2Texts = Array.from(bookHandle.container.querySelectorAll('h2')).map((el) =>
      el.textContent?.trim()
    );
    expect(detailH2Texts).toContain('Resource Explorer');
    expect(detailH2Texts).toContain('Refactoring');
  });

  it('LiveActivityTicker mounts a polite status live region before events arrive and gives its 24x24 close button an accessible name', async () => {
    vi.useFakeTimers();
    const { container } = await renderClient(<LiveActivityTicker />);

    const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.textContent).toBe('');

    const channel = registeredChannels.find((c) => c.name === 'live-tickers');
    const bookInsert = channel?.handlers.find((h) => h.table === 'books')?.callback;
    await act(async () => {
      bookInsert?.({ new: { id: 'ev-1', title: 'Pragmatic Programmer' } });
    });

    expect(liveRegion).toHaveTextContent('Pragmatic Programmer');
    const closeBtn = liveRegion?.querySelector(
      'button[aria-label="Close notification for Pragmatic Programmer"]'
    );
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.className).toContain('size-6');
  });

  it('Target size & accessible names: tooltip info buttons and CategoryPieChart legend buttons have >=24px hit areas', async () => {
    await renderClient(
      <CategoryDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        editingId={null}
        formData={{ name: 'Physics', slug: 'physics', description: 'Science' }}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        loading={false}
        error={null}
      />
    );

    for (const label of ['Category Name info', 'Slug info', 'Description info']) {
      const btn = document.body.querySelector(`button[aria-label="${label}"]`);
      expect(btn).not.toBeNull();
      expect(btn?.className).toContain('size-6');
    }

    cleanupClients();

    const profileHandle = await renderClient(
      <PersonalInfoForm
        role="patron"
        initialProfile={{
          full_name: 'Ana Reyes',
          student_id: '2026-0099',
          email: 'ana@lumina.edu',
          status: 'ACTIVE',
        }}
        addressValue="Manila"
        phoneValue="09171234567"
        departmentValue="BSIT"
      />
    );

    for (const label of [
      'Patron ID info',
      'Official Email info',
      'Account Status info',
      'Academic Program info',
    ]) {
      const btn = profileHandle.container.querySelector(`button[aria-label="${label}"]`);
      expect(btn).not.toBeNull();
      expect(btn?.className).toContain('size-6');
    }

    cleanupClients();

    const securityHandle = await renderClient(<SecuritySection role="patron" />);
    const secBtn = securityHandle.container.querySelector('button');
    expect(secBtn).not.toBeNull();
    expect(secBtn).toHaveAttribute('aria-label', 'Identity & Access info');
    expect(secBtn?.className).toContain('size-6');

    cleanupClients();

    const chartHandle = await renderClient(
      <CategoryPieChart
        title="Popular Categories"
        data={[
          { name: 'Fiction', value: 12 },
          { name: 'History', value: 5 },
        ]}
      />
    );
    const legendButtons = Array.from(chartHandle.container.querySelectorAll('button'));
    expect(legendButtons).toHaveLength(2);
    for (const btn of legendButtons) {
      expect(btn.className).toContain('min-h-6');
      expect(btn.className).toContain('min-w-6');
      expect(btn.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});
