import * as React from 'react';
import { act } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
} from './helpers/render';
import { createMockQueryBuilder } from './mocks/supabase';

// --- External boundary mocks (only @/lib/supabase/*, next/navigation, next/cache, fetch) ---
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const mockServerSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'staff-1', email: 'lib@lumina.edu' } },
      error: null,
    }),
  },
  from: vi.fn((table: string) => {
    if (table === 'profiles') {
      return createMockQueryBuilder({
        id: 'staff-1',
        role: 'librarian',
        status: 'ACTIVE',
        full_name: 'Librarian User',
      });
    }
    if (table === 'books') {
      const qb = createMockQueryBuilder([]);
      qb.insert = vi.fn().mockImplementation((rows: Array<Record<string, unknown>>) => {
        const inserted = rows.map((row, i) => ({
          id: `new-book-${i + 1}`,
          title: row.title,
          author: row.author,
          isbn: row.isbn ?? null,
          cover_url: row.cover_url ?? null,
        }));
        return createMockQueryBuilder(inserted);
      });
      return qb;
    }
    if (table === 'book_copies') {
      return createMockQueryBuilder([]);
    }
    if (table === 'categories') {
      return createMockQueryBuilder([{ id: 'cat-1', name: 'Computer Science' }]);
    }
    if (table === 'audit_logs') {
      return createMockQueryBuilder([]);
    }
    return createMockQueryBuilder([]);
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockClientSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  },
  from: vi.fn(() => createMockQueryBuilder([])),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockServerSupabase)),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockClientSupabase),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockServerSupabase),
}));

import { AuditLogExportImportModal } from '@/components/admin/AuditLogExportImportModal';
import { AuditLogClient } from '@/components/admin/AuditLogClient';
import { AdminManagementContent } from '@/components/catalog/AdminManagementContent';
import { IdentityListManager } from '@/components/admin/policies/IdentityListManager';
import { SupportFAQManager } from '@/components/admin/policies/SupportFAQManager';
import { SystemAnnouncement } from '@/components/admin/system-announcement';
import { PolicyCommitModal } from '@/components/admin/PolicyCommitModal';
import {
  AnnualResetTool,
  RunMaintenanceTool,
  TestEmailTool,
} from '@/components/settings/SettingsShared';
import { ModernInventoryClient } from '@/components/inventory/ModernInventoryClient';
import { AnimationProvider } from '@/components/providers/animation-provider';
import { BatchTaskProvider } from '@/components/providers/BatchTaskProvider';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Book, BookCopyWithReservation, Category, ProfileData } from '@/lib/types';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
  ) as HTMLButtonElement | undefined;
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'Clean Architecture',
    author: 'Robert C. Martin',
    isbn: '9780134494166',
    cover_url: undefined,
    section: 'CS Reference',
    location: 'Shelf A-2',
    category_id: 'cat-1',
    description: 'Software architecture.',
    published_year: 2017,
    total_copies: 2,
    available_copies: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    dewey_decimal: '005.1',
    tags: ['architecture'],
    ...overrides,
  };
}

function makeCopy(overrides: Partial<BookCopyWithReservation> = {}): BookCopyWithReservation {
  return {
    id: 'copy-1',
    book_id: 'book-1',
    qr_string: 'QR-001',
    accession_number: 'ACC-001',
    status: 'AVAILABLE',
    reservation: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('Accessibility A1 fixes (admin, policies, catalog, inventory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobs: [], logs: [], total: 0 }), { status: 200 }))
    );
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
  });

  it('Item 1, 4, 6: AuditLogExportImportModal adds accessible remove-file name, contrast classes, and th scope="col"', async () => {
    await renderClient(
      <AuditLogExportImportModal
        isOpen={true}
        onClose={vi.fn()}
        currentFilters={{}}
      />
    );

    await clickElement(findButtonByText(document.body, 'Restoration & Import'));
    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;

    const jsonPayload = [
      {
        action: 'create',
        entity_type: 'book',
        reason: 'Initial catalog entry',
        created_at: '2026-11-14T00:00:00.000Z',
      },
      {
        // missing required fields -> skipped row
        entity_type: 'book',
      },
    ];
    const jsonFile = new File([JSON.stringify(jsonPayload)], 'backup.json', {
      type: 'application/json',
    });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [jsonFile], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    });

    const removeBtn = document.body.querySelector('button[aria-label="Remove backup.json"]');
    expect(removeBtn).toBeInTheDocument();

    expect(document.body.querySelector('.text-emerald-800')).toHaveTextContent('1');
    expect(document.body.querySelector('.text-amber-800')).toHaveTextContent('1');
    expect(document.body.querySelector('.text-emerald-600')).toBeNull();
    expect(document.body.querySelector('.text-amber-600')).toBeNull();

    const headers = Array.from(document.body.querySelectorAll('table thead th'));
    expect(headers).toHaveLength(4);
    for (const th of headers) {
      expect(th).toHaveAttribute('scope', 'col');
    }
  });

  it('Item 4 & 6: AuditLogClient adds scope="col" on headers and status-* classes on action badges', async () => {
    const logs = [
      {
        id: 'l-1',
        admin_id: 'a-1',
        entity_type: 'book',
        entity_id: 'b-1',
        action: 'create',
        reason: 'Created item',
        details: null,
        old_value: null,
        new_value: null,
        created_at: '2026-11-14T00:00:00.000Z',
        profiles: { full_name: 'Admin One', email: 'a1@lumina.edu', role: 'admin' },
      },
      {
        id: 'l-2',
        admin_id: 'a-1',
        entity_type: 'book',
        entity_id: 'b-2',
        action: 'archive',
        reason: 'Archived item',
        details: null,
        old_value: null,
        new_value: null,
        created_at: '2026-11-14T01:00:00.000Z',
        profiles: { full_name: 'Admin One', email: 'a1@lumina.edu', role: 'admin' },
      },
      {
        id: 'l-3',
        admin_id: 'a-1',
        entity_type: 'book',
        entity_id: 'b-3',
        action: 'delete',
        reason: 'Deleted item',
        details: null,
        old_value: null,
        new_value: null,
        created_at: '2026-11-14T02:00:00.000Z',
        profiles: { full_name: 'Admin One', email: 'a1@lumina.edu', role: 'admin' },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ logs, total: 3 }), { status: 200 })
      )
    );

    const { container } = await renderClient(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AuditLogClient />
      </SWRConfig>
    );

    await vi.waitFor(() => {
      expect(container.querySelectorAll('table thead th')).toHaveLength(6);
    });

    const headers = Array.from(container.querySelectorAll('table thead th'));
    for (const th of headers) {
      expect(th).toHaveAttribute('scope', 'col');
    }

    expect(container.querySelector('.status-success')).toHaveTextContent('create');
    expect(container.querySelector('.status-warning')).toHaveTextContent('archive');
    expect(container.querySelector('.status-danger')).toHaveTextContent('delete');
    expect(container.querySelector('.text-green-600')).toBeNull();
    expect(container.querySelector('.text-amber-600')).toBeNull();
    expect(container.querySelector('.text-red-600')).toBeNull();
  });

  it('Item 1 & 4: AdminManagementContent exposes accessible names on edit button, add-copies input, and status selects, plus high-contrast available count', async () => {
    const book = makeBook({ title: 'Clean Architecture', available_copies: 1 });
    const copies = [makeCopy({ id: 'c-1', accession_number: 'ACC-001', qr_string: 'QR-001', status: 'AVAILABLE' })];

    const { container } = await renderClient(
      <AdminManagementContent
        initialBook={book}
        initialCopies={copies}
        initialQueue={[]}
        onClose={vi.fn()}
      />
    );

    expect(container.querySelector('button[aria-label="Edit Clean Architecture"]')).toBeInTheDocument();

    const comboboxes = Array.from(container.querySelectorAll('[role="combobox"]'));
    expect(comboboxes[0]).toHaveAttribute('aria-label', 'Filter copies by status');
    expect(comboboxes[1]).toHaveAttribute('aria-label', 'Status for copy ACC-001');

    const availableTexts = container.querySelectorAll('.text-emerald-800');
    expect(availableTexts.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.text-emerald-500\\/60')).toBeNull();

    await clickElement(findButtonByText(container, 'Add Copies'));
    const copyCountInput = container.querySelector('input[type="number"]');
    expect(copyCountInput).toHaveAttribute('aria-label', 'Number of copies to add');
  });

  it('Item 1 & 2: IdentityListManager labels bulk-edit controls and pairs dialog Program Name label', async () => {
    const { container } = await renderClient(
      <IdentityListManager
        value={JSON.stringify(['BSCS', 'BSIT'])}
        initialValue={JSON.stringify(['BSCS', 'BSIT'])}
        onChange={vi.fn()}
        disabled={false}
      />
    );

    await clickElement(findButtonByText(container, 'Bulk Management'));
    const inputs = Array.from(container.querySelectorAll('input'));
    expect(inputs[0]).toHaveAttribute('aria-label', 'Program 1 name');
    expect(inputs[1]).toHaveAttribute('aria-label', 'Program 2 name');
    expect(container.querySelector('button[aria-label="Remove BSCS"]')).toBeInTheDocument();
    expect(container.querySelector('button[aria-label="Remove BSIT"]')).toBeInTheDocument();

    await clickElement(findButtonByText(container, 'Add Row'));
    expect(container.querySelector('button[aria-label="Remove program 3"]')).toBeInTheDocument();

    // Exit bulk edit and open Add modal
    await clickElement(findButtonByText(container, 'Discard'));
    await clickElement(findButtonByText(container, 'Add Program'));

    const dialogInput = document.body.querySelector('input[placeholder="e.g. BS Information Technology"]') as HTMLInputElement;
    expect(dialogInput).toBeInTheDocument();
    expect(dialogInput.id).toBeTruthy();
    expect(dialogInput.labels?.[0]).toHaveTextContent('Program Name');
  });

  it('Item 2 & 3: SupportFAQManager reveals actions on focus-within and associates Question/Answer labels', async () => {
    const faqs = JSON.stringify([{ question: 'How to borrow?', answer: 'Use your ID.' }]);
    const { container } = await renderClient(
      <SupportFAQManager
        value={faqs}
        initialValue={faqs}
        onChange={vi.fn()}
        disabled={false}
      />
    );

    const editBtn = container.querySelector('button[aria-label="Edit FAQ"]')!;
    const actionWrapper = editBtn.parentElement!;
    expect(actionWrapper.className).toContain('opacity-0');
    expect(actionWrapper.className).toContain('group-hover/faq:opacity-100');
    expect(actionWrapper.className).toContain('group-focus-within/faq:opacity-100');
    expect(actionWrapper.className).toContain('group-focus-within/faq:translate-x-0');

    await clickElement(editBtn);
    const qInput = document.body.querySelector('input[placeholder="How do I borrow a book?"]') as HTMLInputElement;
    const aTextarea = document.body.querySelector('textarea[placeholder="Enter the detailed answer here..."]') as HTMLTextAreaElement;

    expect(qInput.id).toBeTruthy();
    expect(qInput.labels?.[0]).toHaveTextContent('Question');
    expect(aTextarea.id).toBeTruthy();
    expect(aTextarea.labels?.[0]).toHaveTextContent('Answer');
  });

  it('Item 2 & 5: SystemAnnouncement associates Target/Subject/Message labels and enlarges tooltip info buttons to 24px', async () => {
    const { container } = await renderClient(<SystemAnnouncement />);

    const selectTrigger = container.querySelector('[role="combobox"]') as HTMLElement;
    const labelledById = selectTrigger.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();
    expect(container.querySelector(`#${CSS.escape(labelledById!)}`)).toHaveTextContent('Target Audience');

    const subjectInput = container.querySelector('input') as HTMLInputElement;
    expect(subjectInput.id).toBeTruthy();
    expect(subjectInput.labels?.[0]).toHaveTextContent('Subject');

    const messageTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(messageTextarea.id).toBeTruthy();
    expect(messageTextarea.labels?.[0]).toHaveTextContent('Announcement Message');

    for (const label of ['Target audience info', 'Subject info', 'Message info']) {
      const btn = container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('grid', 'size-6', 'place-items-center');
      expect(btn).not.toHaveClass('p-0.5');
      expect(btn.querySelector('svg')).toHaveClass('h-3', 'w-3');
    }
  });

  it('Item 2: PolicyCommitModal associates Audit Protocol Reason label with textarea', async () => {
    await renderClient(
      <PolicyCommitModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        changedKeys={['loan_period_days']}
        initialValues={{ loan_period_days: '14' }}
        formData={{ loan_period_days: '21' }}
        loading={false}
      />
    );

    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.id).toBeTruthy();
    expect(textarea.labels?.[0]).toHaveTextContent('Audit Protocol Reason');
  });

  it('Item 2 & 5: SettingsShared enlarges info buttons to 24px and labels email input + type select', async () => {
    const { container } = await renderClient(
      <TooltipProvider>
        <div>
          <AnnualResetTool />
          <RunMaintenanceTool />
          <TestEmailTool />
        </div>
      </TooltipProvider>
    );

    for (const label of ['Batch reset info', 'Email dispatch info', 'Email test info']) {
      const btn = container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('grid', 'size-6', 'place-items-center');
      expect(btn).not.toHaveClass('p-0.5');
      expect(btn.querySelector('svg')).toHaveClass('h-3', 'w-3');
    }

    const emailInput = container.querySelector('input[type="email"]');
    expect(emailInput).toHaveAttribute('aria-label', 'Recipient email address');

    const emailTypeTrigger = container.querySelector('[role="combobox"]');
    expect(emailTypeTrigger).toHaveAttribute('aria-label', 'Email Type');
  });

  it('Item 4: ModernInventoryClient uses accessible placeholder and high-contrast import result colors', async () => {
    const profile: ProfileData = {
      id: 'staff-1',
      full_name: 'Librarian User',
      email: 'lib@lumina.edu',
      role: 'librarian',
      status: 'ACTIVE',
      student_id: null,
      department: 'Library',
      avatar_url: null,
      address: null,
      phone: null,
      updated_at: '2026-01-01T00:00:00Z',
      permissions: { manage_circulation: true, manage_attendance: true, view_admin_dashboard: true },
    };
    const categories: Category[] = [{ id: 'cat-1', name: 'Computer Science' }];

    const { container } = await renderClient(
      <AnimationProvider>
        <PreferencesProvider
          initialPreferences={{ theme: 'light' }}
          initialRole="librarian"
          initialProfile={profile}
        >
          <BatchTaskProvider>
            <ModernInventoryClient
              books={[makeBook()]}
              totalItems={1}
              categories={categories}
              canManage={true}
            />
          </BatchTaskProvider>
        </PreferencesProvider>
      </AnimationProvider>
    );

    const searchInput = container.querySelector('input[aria-label="Search inventory"]') as HTMLInputElement;
    expect(searchInput).toHaveClass('placeholder:text-muted-foreground');
    expect(searchInput.className).not.toContain('placeholder:text-muted-foreground/30');

    // Open Batch Operations -> Upload JSON -> Commit import -> inspect importResults contrast
    await clickElement(container.querySelector('button[aria-label="Batch operations"]'));
    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    const importPayload = [{ title: 'Domain-Driven Design', author: 'Eric Evans', stock: 2 }];
    const importFile = new File([JSON.stringify(importPayload)], 'books.json', {
      type: 'application/json',
    });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [importFile], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    });

    mockServerSupabase.rpc.mockResolvedValueOnce({
      data: {
        books: [{ id: 'new-book-1', title: 'Domain-Driven Design', author: 'Eric Evans', isbn: null, cover_url: null, copyIds: ['copy-1', 'copy-2'] }],
        copyIds: ['copy-1', 'copy-2'],
      },
      error: null,
    });
    await clickElement(findButtonByText(document.body, 'Commit & Import to Catalog'));
    await vi.waitFor(() => {
      expect(document.body).toHaveTextContent('Catalog Rows Imported');
    });

    expect(document.body.querySelectorAll('.text-emerald-800').length).toBeGreaterThanOrEqual(3);
    expect(document.body.querySelectorAll('.text-amber-800').length).toBeGreaterThanOrEqual(1);
    expect(document.body.querySelector('.text-emerald-400')).toBeNull();
    expect(document.body.querySelector('.text-amber-400')).toBeNull();
  });
});
