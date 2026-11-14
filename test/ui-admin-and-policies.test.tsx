import * as React from 'react';
import { act } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
  pressKey,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();

function useReactiveSearchParams() {
  const [search, setSearch] = React.useState(() =>
    typeof window !== 'undefined' ? window.location.search : ''
  );
  React.useEffect(() => {
    const origReplace = window.history.replaceState.bind(window.history);
    const notify = () => setSearch(window.location.search);
    window.history.replaceState = (...args) => {
      origReplace(...args);
      notify();
    };
    window.addEventListener('popstate', notify);
    return () => {
      window.history.replaceState = origReplace;
      window.removeEventListener('popstate', notify);
    };
  }, []);
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => useReactiveSearchParams(),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

const mockGetBookPublicDetails = vi.fn();
vi.mock('@/lib/actions/catalog', () => ({
  getBookPublicDetails: (...args: unknown[]) => mockGetBookPublicDetails(...args),
  getBookAdminDetails: vi.fn(),
  getCategories: vi.fn(),
}));

import { IdentityListManager } from '@/components/admin/policies/IdentityListManager';
import { SupportFAQManager } from '@/components/admin/policies/SupportFAQManager';
import { PolicyField } from '@/components/admin/policies/PolicyField';
import { PolicyLayout } from '@/components/admin/policies/PolicyLayout';
import { PolicyCommitModal } from '@/components/admin/PolicyCommitModal';
import { PolicySimulationPanel } from '@/components/admin/PolicySimulationPanel';
import { AuditLogClient } from '@/components/admin/AuditLogClient';
import { AuditLogExportImportModal } from '@/components/admin/AuditLogExportImportModal';
import { AuditSubjectFilter, AuditSubjectChip } from '@/components/admin/AuditSubjectFilter';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { CategoryDialog } from '@/components/admin/categories/CategoryDialog';
import { CategoryItem } from '@/components/admin/categories/CategoryItem';
import { SystemAnnouncement } from '@/components/admin/system-announcement';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Category, PolicySetting } from '@/types/admin';

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

describe('Admin & Policies UI Components', () => {
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
    window.history.replaceState(null, '', '/');
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. IdentityListManager
  // ───────────────────────────────────────────────────────────────────────────
  describe('IdentityListManager', () => {
    it('renders JSON and comma-separated lists, New badges, and empty state', async () => {
      const initial = JSON.stringify(['BS Computer Science']);
      const current = JSON.stringify(['BS Computer Science', 'BS Data Science']);

      const handle = await renderClient(
        <IdentityListManager
          value={current}
          initialValue={initial}
          onChange={vi.fn()}
          disabled={false}
        />
      );

      expect(handle.container).toHaveTextContent('2 Registered Programs');
      expect(handle.container).toHaveTextContent('BS Computer Science');
      expect(handle.container).toHaveTextContent('BS Data Science');
      expect(handle.container).toHaveTextContent('New');

      await handle.rerender(
        <IdentityListManager
          value="BSIT, BSIS"
          initialValue="BSIT"
          onChange={vi.fn()}
          disabled={false}
        />
      );
      expect(handle.container).toHaveTextContent('BSIT');
      expect(handle.container).toHaveTextContent('BSIS');

      await handle.rerender(
        <IdentityListManager value="[]" initialValue="[]" onChange={vi.fn()} disabled={false} />
      );
      expect(handle.container).toHaveTextContent('0 Registered Programs');
      expect(handle.container).toHaveTextContent('No Academic Programs');
    });

    it('adds, edits, validates duplicates/length, and removes entries', async () => {
      const onChange = vi.fn();
      const initial = JSON.stringify(['BS Computer Science']);

      const handle = await renderClient(
        <IdentityListManager
          value={initial}
          initialValue={initial}
          onChange={onChange}
          disabled={false}
        />
      );

      // Open Add dialog
      await clickElement(findButtonByText(handle.container, 'Add Program'));
      expect(document.body).toHaveTextContent('Add Academic Program');

      const dialogInput = document.body.querySelector(
        'input[placeholder="e.g. BS Information Technology"]'
      ) as HTMLInputElement;
      const submitAddBtn = Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Add Program' && b.closest('[role="dialog"]')
      ) as HTMLButtonElement;

      // Empty is invalid (disabled)
      expect(submitAddBtn).toBeDisabled();

      // Over 60 chars disables submit
      await typeIntoInput(dialogInput, 'A'.repeat(61));
      expect(document.body).toHaveTextContent('61/60');
      expect(submitAddBtn).toBeDisabled();

      // Duplicate entry shows toast.error and does not call onChange
      await typeIntoInput(dialogInput, 'BS Computer Science');
      expect(submitAddBtn).not.toBeDisabled();
      await clickElement(submitAddBtn);
      expect(mockToastError).toHaveBeenCalledWith('Program already exists in the list');
      expect(onChange).not.toHaveBeenCalled();

      // Valid new entry via Enter key
      await typeIntoInput(dialogInput, 'BS Information Systems');
      await pressKey(dialogInput, 'Enter');
      expect(onChange).toHaveBeenCalledWith(
        JSON.stringify(['BS Computer Science', 'BS Information Systems'])
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Program added');

      // Edit existing entry
      const editBtn = handle.container.querySelector('button[aria-label="Edit program name"]');
      await clickElement(editBtn);
      expect(document.body).toHaveTextContent('Edit Program');

      const editInput = document.body.querySelector(
        'input[placeholder="e.g. BS Information Technology"]'
      ) as HTMLInputElement;
      const saveChangesBtn = findButtonByText(document.body, 'Save Changes')!;
      // Unchanged name keeps Save Changes disabled
      expect(saveChangesBtn).toBeDisabled();

      await typeIntoInput(editInput, 'BS Computer Engineering');
      expect(saveChangesBtn).not.toBeDisabled();
      await clickElement(saveChangesBtn);
      expect(onChange).toHaveBeenCalledWith(JSON.stringify(['BS Computer Engineering']));
      expect(mockToastSuccess).toHaveBeenCalledWith('Program updated');

      // Remove entry
      const removeBtn = handle.container.querySelector('button[aria-label="Remove program"]');
      await clickElement(removeBtn);
      expect(onChange).toHaveBeenCalledWith(JSON.stringify([]));
      expect(mockToastSuccess).toHaveBeenCalledWith('Program removed');
    });

    it('supports bulk editing: add row, edit, remove, discard, and save deduplicated', async () => {
      const onChange = vi.fn();
      const initial = JSON.stringify(['BSCS', 'BSIT']);

      const handle = await renderClient(
        <IdentityListManager
          value={initial}
          initialValue={initial}
          onChange={onChange}
          disabled={false}
        />
      );

      await clickElement(findButtonByText(handle.container, 'Bulk Management'));
      expect(handle.container).toHaveTextContent('Edit course and program names directly');

      // Add a blank row and type a duplicate + discard
      await clickElement(findButtonByText(handle.container, 'Add Row'));
      let inputs = handle.container.querySelectorAll('input');
      expect(inputs).toHaveLength(3);
      await clickElement(findButtonByText(handle.container, 'Discard'));
      expect(handle.container).not.toHaveTextContent('Edit course and program names directly');

      // Re-enter bulk edit, add duplicate + blank, and save
      await clickElement(findButtonByText(handle.container, 'Bulk Management'));
      await clickElement(findButtonByText(handle.container, 'Add Row'));
      await clickElement(findButtonByText(handle.container, 'Add Row'));
      inputs = handle.container.querySelectorAll('input');
      await typeIntoInput(inputs[2] as HTMLInputElement, '  BSCS  ');
      await typeIntoInput(inputs[3] as HTMLInputElement, '  BSIS  ');

      await clickElement(findButtonByText(handle.container, 'Save Changes'));
      expect(onChange).toHaveBeenCalledWith(JSON.stringify(['BSCS', 'BSIT', 'BSIS']));
      expect(mockToastSuccess).toHaveBeenCalledWith('Updated 3 academic programs');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SupportFAQManager
  // ───────────────────────────────────────────────────────────────────────────
  describe('SupportFAQManager', () => {
    const initialFaqs = [
      { question: 'How do I borrow?', answer: 'Present your QR card.' },
      { question: 'What is the fine?', answer: '5 PHP per day.' },
    ];

    it('renders FAQs, badges for New/Edited, and empty state', async () => {
      const modifiedFaqs = [
        { question: 'How do I borrow?', answer: 'Present your digital card.' },
        { question: 'Where is the desk?', answer: 'Ground floor.' },
      ];

      const handle = await renderClient(
        <SupportFAQManager
          value={JSON.stringify(modifiedFaqs)}
          initialValue={JSON.stringify(initialFaqs)}
          onChange={vi.fn()}
          disabled={false}
        />
      );

      expect(handle.container).toHaveTextContent('2 entries registered');
      expect(handle.container).toHaveTextContent('Edited');
      expect(handle.container).toHaveTextContent('New');
      expect(handle.container).toHaveTextContent('Pending Removal');
      expect(handle.container).toHaveTextContent('Q: What is the fine?');

      await handle.rerender(
        <SupportFAQManager value="[]" initialValue="[]" onChange={vi.fn()} disabled={false} />
      );
      expect(handle.container).toHaveTextContent('No entries found');
    });

    it('adds, edits, removes, and restores FAQ entries with validation', async () => {
      const onChange = vi.fn();
      const handle = await renderClient(
        <SupportFAQManager
          value={JSON.stringify([initialFaqs[0]])}
          initialValue={JSON.stringify(initialFaqs)}
          onChange={onChange}
          disabled={false}
        />
      );

      // Add FAQ
      await clickElement(findButtonByText(handle.container, 'Add Entry'));
      const qInput = document.body.querySelector(
        'input[placeholder="How do I borrow a book?"]'
      ) as HTMLInputElement;
      const aTextarea = document.body.querySelector(
        'textarea[placeholder="Enter the detailed answer here..."]'
      ) as HTMLTextAreaElement;
      const modalAddBtn = Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Add Entry' && b.closest('[role="dialog"]')
      ) as HTMLButtonElement;

      expect(modalAddBtn).toBeDisabled();
      await typeIntoInput(qInput, 'Can I renew?');
      expect(modalAddBtn).toBeDisabled();
      await typeIntoInput(aTextarea, 'Yes, up to 2 times.');
      expect(modalAddBtn).not.toBeDisabled();

      // Exceeding max length disables save
      await typeIntoInput(qInput, 'Q'.repeat(121));
      expect(modalAddBtn).toBeDisabled();

      await typeIntoInput(qInput, 'Can I renew?');
      await clickElement(modalAddBtn);
      expect(onChange).toHaveBeenCalledWith(
        JSON.stringify([initialFaqs[0], { question: 'Can I renew?', answer: 'Yes, up to 2 times.' }])
      );

      // Edit FAQ
      const editBtn = handle.container.querySelector('button[aria-label="Edit FAQ"]');
      await clickElement(editBtn);
      expect(document.body).toHaveTextContent('Edit FAQ');
      const editAnswer = document.body.querySelector(
        'textarea[placeholder="Enter the detailed answer here..."]'
      ) as HTMLTextAreaElement;
      await typeIntoInput(editAnswer, 'Show your QR code at the desk.');
      await clickElement(findButtonByText(document.body, 'Save Changes'));
      expect(onChange).toHaveBeenCalledWith(
        JSON.stringify([{ question: 'How do I borrow?', answer: 'Show your QR code at the desk.' }])
      );

      // Remove FAQ
      const removeBtn = handle.container.querySelector('button[aria-label="Remove FAQ"]');
      await clickElement(removeBtn);
      expect(onChange).toHaveBeenCalledWith(JSON.stringify([]));

      // Restore pending removal FAQ
      const restoreBtn = handle.container.querySelector('button[aria-label="Restore FAQ"]');
      await clickElement(restoreBtn);
      expect(onChange).toHaveBeenCalledWith(JSON.stringify([initialFaqs[0], initialFaqs[1]]));
    });

    it('hides mutation controls when disabled', async () => {
      const handle = await renderClient(
        <SupportFAQManager
          value={JSON.stringify([initialFaqs[0]])}
          initialValue={JSON.stringify(initialFaqs)}
          onChange={vi.fn()}
          disabled={true}
        />
      );

      expect(findButtonByText(handle.container, 'Add Entry')).toBeUndefined();
      expect(handle.container.querySelector('button[aria-label="Edit FAQ"]')).toBeNull();
      expect(handle.container.querySelector('button[aria-label="Remove FAQ"]')).toBeNull();
      expect(handle.container.querySelector('button[aria-label="Restore FAQ"]')).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. PolicyCommitModal
  // ───────────────────────────────────────────────────────────────────────────
  describe('PolicyCommitModal', () => {
    it('renders scalar and JSON array diffs, validates 10-char audit reason, and submits', async () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      await renderClient(
        <PolicyCommitModal
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          changedKeys={['loan_period_days', 'academic_programs', 'student_faq_list']}
          initialValues={{
            loan_period_days: '14',
            academic_programs: JSON.stringify(['BSCS', 'BSIT']),
            student_faq_list: JSON.stringify([
              { question: 'Q1', answer: 'A1' },
              { question: 'Q2', answer: 'A2' },
            ]),
          }}
          formData={{
            loan_period_days: '21',
            academic_programs: JSON.stringify(['BSCS', 'BSIS']),
            student_faq_list: JSON.stringify([
              { question: 'Q2', answer: 'A2' },
              { question: 'Q1', answer: 'A1' },
            ]),
          }}
          loading={false}
        />
      );

      expect(document.body).toHaveTextContent('Review Updates');
      expect(document.body).toHaveTextContent('3 modifications');
      expect(document.body).toHaveTextContent('14');
      expect(document.body).toHaveTextContent('21');
      expect(document.body).toHaveTextContent('Added: BSIS');
      expect(document.body).toHaveTextContent('Removed: BSIT');
      expect(document.body).toHaveTextContent('Reordered collection items');

      const confirmBtn = findButtonByText(document.body, 'Confirm & Commit')!;
      const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;

      expect(document.body).toHaveTextContent('10 chars min');
      expect(confirmBtn).toBeDisabled();

      await typeIntoInput(textarea, 'Too short');
      expect(document.body).toHaveTextContent('1 chars min');
      expect(confirmBtn).toBeDisabled();

      await typeIntoInput(textarea, 'Extending loan period for midterms');
      expect(document.body).toHaveTextContent('Validated');
      expect(confirmBtn).not.toBeDisabled();

      await clickElement(confirmBtn);
      expect(onConfirm).toHaveBeenCalledWith('Extending loan period for midterms');

      await clickElement(findButtonByText(document.body, 'Cancel'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows Processing spinner and disables buttons while loading', async () => {
      await renderClient(
        <PolicyCommitModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          changedKeys={['loan_period_days']}
          initialValues={{ loan_period_days: '14' }}
          formData={{ loan_period_days: '15' }}
          loading={true}
        />
      );

      expect(document.body).toHaveTextContent('Processing');
      expect(findButtonByText(document.body, 'Cancel')).toBeDisabled();
      expect(findButtonByText(document.body, 'Processing')).toBeDisabled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. PolicySimulationPanel
  // ───────────────────────────────────────────────────────────────────────────
  describe('PolicySimulationPanel', () => {
    it('displays configured hold_expiry_days and defaults to 7 when missing', async () => {
      const handle = await renderClient(
        <PolicySimulationPanel formData={{ hold_expiry_days: '10' }} />
      );
      expect(handle.container).toHaveTextContent('Hold Period');
      expect(handle.container).toHaveTextContent('10 Day Reservation');
      expect(handle.container).toHaveTextContent('Items are held for 10 days before expiration.');

      await handle.rerender(<PolicySimulationPanel formData={{}} />);
      expect(handle.container).toHaveTextContent('7 Day Reservation');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PolicyLayout
  // ───────────────────────────────────────────────────────────────────────────
  describe('PolicyLayout', () => {
    const baseSettings: PolicySetting[] = [
      { id: 'set-1', key: 'loan_period_days', value: '14', description: 'Loan days', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'set-2', key: 'hold_expiry_days', value: '7', description: 'Hold days', updated_at: '2026-01-01T00:00:00Z' },
    ];
    const sampleCategories: Category[] = [
      { id: 'cat-1', name: 'Science', slug: 'science', description: 'Natural sciences', is_active: true },
    ];

    it('renders role-gated sidebar, switches sections, and cleans up realtime channel', async () => {
      const removeChannel = vi.fn();
      const channelObj = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
      mockCreateClient.mockReturnValue({
        channel: vi.fn().mockReturnValue(channelObj),
        removeChannel,
      });

      const handle = await renderClient(
        <PolicyLayout
          settings={baseSettings}
          canEdit={true}
          role="admin"
          categoriesPromise={Promise.resolve(sampleCategories)}
        />
      );

      // Admin does not see Lifecycle
      expect(findButtonByText(handle.container, 'Lifecycle')).toBeUndefined();
      expect(handle.container).toHaveTextContent('Borrowing Duration');

      // Switch to Reservations -> PolicySimulationPanel appears
      await clickElement(findButtonByText(handle.container, 'Reservations'));
      expect(handle.container).toHaveTextContent('Simulation Engine');
      expect(handle.container).toHaveTextContent('7 Day Reservation');

      // Switch to Categories -> resolves categoriesPromise
      await clickElement(findButtonByText(handle.container, 'Categories'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(handle.container).toHaveTextContent('1 Registered Category');
      expect(handle.container).toHaveTextContent('Science');

      // Switch to Broadcasts -> Global Announcement + Trigger Policies
      await clickElement(findButtonByText(handle.container, 'Broadcasts'));
      expect(handle.container).toHaveTextContent('Global Announcement');
      expect(handle.container).toHaveTextContent('Trigger Policies');

      // Rerender as super_admin -> Lifecycle becomes visible
      await handle.rerender(
        <PolicyLayout
          settings={baseSettings}
          canEdit={true}
          role="super_admin"
          categoriesPromise={Promise.resolve(sampleCategories)}
        />
      );
      await clickElement(findButtonByText(handle.container, 'Lifecycle'));
      expect(handle.container).toHaveTextContent('Batch Account Reset');

      handle.unmount();
      expect(removeChannel).toHaveBeenCalledWith(channelObj);
    });

    it('tracks unsaved edits, confirms navigation discard, and commits changes via fetch', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const handle = await renderClient(
        <PolicyLayout
          settings={baseSettings}
          canEdit={true}
          role="admin"
          categoriesPromise={Promise.resolve(sampleCategories)}
        />
      );

      const loanInput = handle.container.querySelector(
        'input[aria-label="Borrowing Duration (days)"]'
      ) as HTMLInputElement;
      await typeIntoInput(loanInput, '21');

      expect(handle.container).toHaveTextContent('1 unsaved changes');

      // Trying to switch section prompts Unsaved Policy Changes dialog
      await clickElement(findButtonByText(handle.container, 'Reservations'));
      expect(document.body).toHaveTextContent('Unsaved Policy Changes');
      await clickElement(findButtonByText(document.body, 'Cancel'));
      expect(handle.container).toHaveTextContent('Borrowing Duration');

      // Review Changes -> Commit Modal -> POST /api/admin/policy-settings
      await clickElement(findButtonByText(handle.container, 'Review Changes'));
      expect(document.body).toHaveTextContent('Review Updates');

      const reasonTextarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
      await typeIntoInput(reasonTextarea, 'Adjusting standard term loan duration');
      await clickElement(findButtonByText(document.body, 'Confirm & Commit'));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/policy-settings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            key: 'loan_period_days',
            value: '21',
            description:
              'The number of days a student is allowed to keep a borrowed book before it is marked overdue.',
            reason: 'Adjusting standard term loan duration',
          }),
        })
      );
      expect(mockRouterRefresh).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Changes synchronized');
    });

    it('detects concurrent server updates as conflicts and lets user keep or discard', async () => {
      const handle = await renderClient(
        <PolicyLayout
          settings={baseSettings}
          canEdit={true}
          role="admin"
          categoriesPromise={Promise.resolve(sampleCategories)}
        />
      );

      const loanInput = handle.container.querySelector(
        'input[aria-label="Borrowing Duration (days)"]'
      ) as HTMLInputElement;
      await typeIntoInput(loanInput, '21');

      // Server pushes new value for loan_period_days while user has local edit
      await handle.rerender(
        <PolicyLayout
          settings={[
            { id: 'set-1', key: 'loan_period_days', value: '10', description: 'Loan days', updated_at: '2026-01-02T00:00:00Z' },
          ]}
          canEdit={true}
          role="admin"
          categoriesPromise={Promise.resolve(sampleCategories)}
        />
      );

      const alert = handle.container.querySelector('[role="alert"]');
      expect(alert).toHaveTextContent('Another administrator changed');
      expect(findButtonByText(handle.container, 'Review Changes')).toBeDisabled();

      await clickElement(findButtonByText(handle.container, 'Keep my edit'));
      expect(handle.container.querySelector('[role="alert"]')).toBeNull();
      expect(findButtonByText(handle.container, 'Review Changes')).not.toBeDisabled();

      // Discard clears edits
      await clickElement(findButtonByText(handle.container, 'Discard'));
      expect(mockToastSuccess).toHaveBeenCalledWith('All unsaved changes discarded');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. AuditLogClient
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuditLogClient', () => {
    const sampleLog = {
      id: 'log-1',
      admin_id: 'admin-1',
      entity_type: 'book',
      entity_id: 'book-1',
      action: 'update',
      reason: 'Updated catalog metadata',
      details: {
        added: [{ title: 'Clean Code' }],
        removed: ['Old Edition'],
        source: 'manual',
      },
      old_value: { title: 'Clean Cod', copies: 2 },
      new_value: { title: 'Clean Code', copies: 3 },
      created_at: '2026-11-14T00:00:00.000Z',
      profiles: { full_name: 'Elena Reyes', email: 'elena@lumina.edu', role: 'admin' },
    };

    function renderAuditLogs() {
      return renderClient(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <AuditLogClient />
        </SWRConfig>
      );
    }

    it('renders loading skeletons, fetched rows with Manila timestamps, and expands diff details', async () => {
      let resolveFetch!: (val: Response) => void;
      const pendingPromise = new Promise<Response>((res) => {
        resolveFetch = res;
      });
      const fetchMock = vi.fn().mockReturnValue(pendingPromise);
      vi.stubGlobal('fetch', fetchMock);

      const handle = await renderAuditLogs();
      expect(handle.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => ({ logs: [sampleLog], total: 25 }),
        } as Response);
      });

      expect(handle.container).toHaveTextContent('2026-11-14 08:00:00');
      expect(handle.container).toHaveTextContent('Elena Reyes');
      expect(handle.container).toHaveTextContent('Updated catalog metadata');
      expect(handle.container).toHaveTextContent('Showing 1-20 of 25');

      // Expand diff row
      const viewBtn = handle.container.querySelector('button[aria-label^="View details"]');
      await clickElement(viewBtn);
      expect(handle.container).toHaveTextContent('Added Elements');
      expect(handle.container).toHaveTextContent('Clean Code');
      expect(handle.container).toHaveTextContent('Removed Elements');
      expect(handle.container).toHaveTextContent('Old Edition');
      expect(handle.container).toHaveTextContent('Value Changes');

      // Collapse diff row
      const hideBtn = handle.container.querySelector('button[aria-label^="Hide details"]');
      await clickElement(hideBtn);
      expect(handle.container).not.toHaveTextContent('Added Elements');
    });

    it('shows empty state and surfaces 403 error toast', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ logs: [], total: 0 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const handle = await renderAuditLogs();
      await vi.waitFor(() => {
        expect(handle.container).toHaveTextContent('No Entries Found');
      });

      cleanupClients();

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({ error: 'Forbidden' }),
        })
      );
      await renderAuditLogs();
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Access Denied: Please ensure your session is active and you have administrative permissions.'
        );
      });
    });

    it('debounces search, validates advanced filter dates, clears filters, and opens Export/Import modal', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ logs: [sampleLog], total: 1 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const handle = await renderAuditLogs();
      await vi.waitFor(() => {
        expect(handle.container).toHaveTextContent('Elena Reyes');
      });

      vi.useFakeTimers();
      const searchInput = handle.container.querySelector(
        'input[placeholder="Search records, names, or actions…"]'
      ) as HTMLInputElement;
      await typeIntoInput(searchInput, 'catalog');
      await act(async () => {
        vi.advanceTimersByTime(450);
      });
      vi.useRealTimers();

      await vi.waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([url]) => String(url).includes('query=catalog'))
        ).toBe(true);
      });

      // Open Advanced Filters modal and validate date bounds
      await clickElement(findButtonByText(handle.container, 'Filters'));
      expect(document.body).toHaveTextContent('Advanced Audit Filters');

      const startInput = document.body.querySelector('#audit-start-date') as HTMLInputElement;
      const endInput = document.body.querySelector('#audit-end-date') as HTMLInputElement;

      await typeIntoInput(startInput, '2026-11-10');
      await typeIntoInput(endInput, '2026-11-05');
      expect(mockToastError).toHaveBeenCalledWith('End date cannot be before start date');

      await typeIntoInput(endInput, '2026-11-14');

      // Clear all filters via modal Clear all button, then close modal
      await clickElement(findButtonByText(document.body, 'Clear all'));
      expect(mockToastSuccess).toHaveBeenCalledWith('All filters cleared');
      await clickElement(findButtonByText(document.body, 'Done'));

      // Open Export / Import modal
      await clickElement(findButtonByText(handle.container, 'Export / Import'));
      expect(document.body).toHaveTextContent('Audit Log Operations');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. AuditLogExportImportModal
  // ───────────────────────────────────────────────────────────────────────────
  describe('AuditLogExportImportModal', () => {
    it('configures export format & columns, triggers download, and validates empty columns', async () => {
      const onClose = vi.fn();

      await renderClient(
        <AuditLogExportImportModal
          isOpen={true}
          onClose={onClose}
          currentFilters={{ query: 'book', entityType: 'book', startDate: '2026-11-01' }}
        />
      );

      expect(document.body).toHaveTextContent('Audit Log Operations');
      expect(document.body).toHaveTextContent('Search: "book"');
      expect(document.body).toHaveTextContent('Customize Columns (15 / 15)');
      expect(document.body).toHaveTextContent('Copy barcode');
      expect(document.body).toHaveTextContent('Student ID');

      // Switch format to Developer JSON
      await clickElement(findButtonByText(document.body, 'Developer JSON'));
      expect(findButtonByText(document.body, 'Developer JSON')).toHaveAttribute('aria-pressed', 'true');

      // Clear columns disables Download Backup File; Select All re-enables it
      await clickElement(
        Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === 'Clear')
      );
      expect(document.body).toHaveTextContent('Customize Columns (0 / 15)');
      expect(findButtonByText(document.body, 'Download Backup File')).toBeDisabled();

      await clickElement(findButtonByText(document.body, 'Select All'));
      expect(document.body).toHaveTextContent('Customize Columns (15 / 15)');

      const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      vi.useFakeTimers();

      await clickElement(findButtonByText(document.body, 'Download Backup File'));
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith('Exporting customized JSON logs...');

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      vi.useRealTimers();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('parses uploaded JSON audit backup, previews valid/skipped rows, and commits restoration', async () => {
      const onImportSuccess = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ count: 1 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await renderClient(
        <AuditLogExportImportModal
          isOpen={true}
          onClose={vi.fn()}
          onImportSuccess={onImportSuccess}
          currentFilters={{}}
        />
      );

      await clickElement(findButtonByText(document.body, 'Restoration & Import'));
      expect(document.body).toHaveTextContent('Restoration Warning');

      const firstFileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;

      // Reject unsupported extension
      const badFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
      await act(async () => {
        Object.defineProperty(firstFileInput, 'files', { value: [badFile], configurable: true });
        firstFileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 40));
      });
      expect(mockToastError).toHaveBeenCalledWith(
        'Unsupported file format. Please upload JSON, CSV, or XLSX.'
      );

      // Re-query input since it remounts after importFile resets to null
      const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;

      // Upload valid JSON with 1 valid and 1 invalid row
      const payload = [
        {
          entity_type: 'book',
          action: 'create',
          reason: 'Initial import',
          created_at: '2026-11-10T08:00:00.000Z',
        },
        {
          entity_type: '',
          action: 'update',
          reason: 'Missing entity',
        },
      ];
      const jsonFile = new File([JSON.stringify(payload)], 'audit-backup.json', {
        type: 'application/json',
      });

      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [jsonFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 40));
      });

      expect(document.body).toHaveTextContent('audit-backup.json');
      expect(document.body).toHaveTextContent('Total Rows');
      expect(document.body).toHaveTextContent('Valid Records');
      expect(document.body).toHaveTextContent('Skipped Rows');
      expect(mockToastWarning).toHaveBeenCalledWith(
        'Parsed file. Warning: 1 rows are missing required entity/action columns.'
      );

      // Commit restoration
      await clickElement(findButtonByText(document.body, 'Commit Restoration'));
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/audit-logs/import',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ logs: [payload[0]] }),
        })
      );
      expect(document.body).toHaveTextContent('Restoration Complete!');
      expect(document.body).toHaveTextContent('Successfully inserted 1 valid audit logs');
      expect(onImportSuccess).toHaveBeenCalledTimes(1);

      // Reset via Import Another File
      await clickElement(findButtonByText(document.body, 'Import Another File'));
      expect(document.body).toHaveTextContent('Drag & Drop Log Backup');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. CategoryManagement & CategoryItem
  // ───────────────────────────────────────────────────────────────────────────
  describe('CategoryManagement & CategoryItem', () => {
    const initialCategories: Category[] = [
      { id: 'c1', name: 'Fiction', slug: 'fiction', description: 'Novels and stories', is_active: true },
      { id: 'c2', name: 'Rare Books', slug: 'rare-books', description: 'Vault collection', is_active: false },
    ];

    it('renders empty state and active/archived CategoryItems with action callbacks', async () => {
      const onEdit = vi.fn();
      const onArchive = vi.fn();
      const onRestore = vi.fn();

      const handle = await renderClient(
        <TooltipProvider>
          <div>
            <CategoryItem
              category={initialCategories[0]}
              isBulkEditing={false}
              isChanged={false}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
            />
            <CategoryItem
              category={initialCategories[1]}
              isBulkEditing={false}
              isChanged={false}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          </div>
        </TooltipProvider>
      );

      expect(handle.container).toHaveTextContent('Fiction');
      expect(handle.container).toHaveTextContent('fiction');
      expect(handle.container).toHaveTextContent('Archived');

      await clickElement(handle.container.querySelector('button[aria-label="Edit category"]'));
      expect(onEdit).toHaveBeenCalledWith(initialCategories[0]);

      await clickElement(handle.container.querySelector('button[aria-label="Archive category"]'));
      expect(onArchive).toHaveBeenCalledWith('c1');

      await clickElement(handle.container.querySelector('button[aria-label="Restore category"]'));
      expect(onRestore).toHaveBeenCalledWith('c2');
    });

    it('creates, edits, archives, restores, and bulk-saves categories via fetch', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url === '/api/admin/categories' && method === 'POST') {
          const body = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({ id: 'c3', ...body, is_active: true }),
            { status: 201 }
          );
        }
        if (url === '/api/admin/categories/c1' && method === 'PUT') {
          const body = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({ ...initialCategories[0], ...body }),
            { status: 200 }
          );
        }
        if (url === '/api/admin/categories/c2' && method === 'PUT') {
          const body = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({ ...initialCategories[1], ...body }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      });
      vi.stubGlobal('fetch', fetchMock);

      const emptyHandle = await renderClient(<CategoryManagement initialCategories={[]} />);
      expect(emptyHandle.container).toHaveTextContent('No categories defined');
      emptyHandle.unmount();

      const handle = await renderClient(
        <CategoryManagement initialCategories={initialCategories} />
      );
      expect(handle.container).toHaveTextContent('2 Registered Categories');

      // Add Category
      await clickElement(findButtonByText(handle.container, 'Add Category'));
      await typeIntoInput(document.body.querySelector('#name') as HTMLInputElement, 'History');
      await typeIntoInput(
        document.body.querySelector('#description') as HTMLInputElement,
        'World history'
      );
      const modalAddBtn = Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Add Category') && b.closest('[role="dialog"]')
      ) as HTMLButtonElement;
      await clickElement(modalAddBtn);

      expect(handle.container).toHaveTextContent('3 Registered Categories');
      expect(handle.container).toHaveTextContent('History');
      expect(mockToastSuccess).toHaveBeenCalledWith('Category added successfully');

      // Archive first category
      const archiveBtns = handle.container.querySelectorAll('button[aria-label="Archive category"]');
      await clickElement(archiveBtns[0]);
      expect(mockToastSuccess).toHaveBeenCalledWith('Category archived');

      // Restore second category
      const restoreBtns = handle.container.querySelectorAll('button[aria-label="Restore category"]');
      await clickElement(restoreBtns[1]);
      expect(mockToastSuccess).toHaveBeenCalledWith('Category restored');

      // Edit first category
      const editBtns = handle.container.querySelectorAll('button[aria-label="Edit category"]');
      await clickElement(editBtns[0]);
      await typeIntoInput(
        document.body.querySelector('#name') as HTMLInputElement,
        'Literary Fiction'
      );
      await clickElement(findButtonByText(document.body, 'Save Changes'));
      expect(handle.container).toHaveTextContent('Literary Fiction');
      expect(mockToastSuccess).toHaveBeenCalledWith('Category updated successfully');

      // Bulk management: edit inline row & save
      await clickElement(findButtonByText(handle.container, 'Bulk Management'));
      const firstRowNameInput = handle.container.querySelector(
        'input[placeholder="Category Name"]'
      ) as HTMLInputElement;
      await typeIntoInput(firstRowNameInput, 'Modern Fiction');

      expect(handle.container).toHaveTextContent('1 Pending Mods');
      expect(handle.container).toHaveTextContent('Modified');

      await clickElement(findButtonByText(handle.container, 'Save Changes'));
      expect(handle.container).toHaveTextContent('Modern Fiction');
      expect(mockToastSuccess).toHaveBeenCalledWith('Successfully updated 1 categories');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. SystemAnnouncement
  // ───────────────────────────────────────────────────────────────────────────
  describe('SystemAnnouncement', () => {
    it('validates fields, discards draft, confirms broadcast, and displays recipient count', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, count: 42 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const handle = await renderClient(<SystemAnnouncement />);

      const subjectInput = handle.container.querySelector(
        'input[placeholder="e.g. Scheduled Library Maintenance This Weekend"]'
      ) as HTMLInputElement;
      const bodyTextarea = handle.container.querySelector('textarea') as HTMLTextAreaElement;
      const sendBtn = findButtonByText(handle.container, 'Send Announcement')!;

      expect(sendBtn).toBeDisabled();
      expect(handle.container).toHaveTextContent('0/500');

      await typeIntoInput(subjectInput, 'Holiday Closure');
      expect(sendBtn).toBeDisabled();
      expect(findButtonByText(handle.container, 'Discard Draft')).toBeDefined();

      // Discard Draft resets inputs
      await clickElement(findButtonByText(handle.container, 'Discard Draft'));
      expect(subjectInput.value).toBe('');

      // Fill both fields and send
      await typeIntoInput(subjectInput, 'Library Hours');
      await typeIntoInput(bodyTextarea, 'Open until 8 PM.');
      expect(handle.container).toHaveTextContent('16/500');
      expect(sendBtn).not.toBeDisabled();

      await clickElement(sendBtn);
      expect(document.body).toHaveTextContent('Confirm Announcement Broadcast');
      expect(document.body).toHaveTextContent('Library Hours');
      expect(document.body).toHaveTextContent('Students & Student Assistants');

      await clickElement(findButtonByText(document.body, 'Confirm & Send'));

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notifications/bulk',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            target: 'students',
            title: 'Library Hours',
            content: 'Open until 8 PM.',
            type: 'SYSTEM',
            priority: 'high',
          }),
        })
      );
      expect(document.body).toHaveTextContent('Announcement Sent');
      expect(document.body).toHaveTextContent('Successfully broadcasted to 42 users');

      await clickElement(findButtonByText(document.body, 'Done'));
      expect(subjectInput.value).toBe('');
      expect(bodyTextarea.value).toBe('');
    });

    it('supports controlled draft props and shows toast error on API failure', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Broadcast service unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false, count: 0 }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const onDraftChange = vi.fn();
      const onClearDraft = vi.fn();

      const handle = await renderClient(
        <SystemAnnouncement
          draft={{ title: 'System Alert', content: 'Maintenance tonight', target: 'all' }}
          onDraftChange={onDraftChange}
          onClearDraft={onClearDraft}
        />
      );

      const subjectInput = handle.container.querySelector(
        'input[placeholder="e.g. Scheduled Library Maintenance This Weekend"]'
      ) as HTMLInputElement;
      await typeIntoInput(subjectInput, 'Updated Alert');
      expect(onDraftChange).toHaveBeenCalledWith({
        title: 'Updated Alert',
        content: 'Maintenance tonight',
        target: 'all',
      });

      await clickElement(findButtonByText(handle.container, 'Send Announcement'));
      expect(document.body).toHaveTextContent('All Users (Everyone)');
      await clickElement(findButtonByText(document.body, 'Confirm & Send'));

      expect(mockToastError).toHaveBeenCalledWith('Broadcast service unavailable');
      expect(onClearDraft).not.toHaveBeenCalled();

      // Unconfirmed delivery keeps draft and surfaces error toast
      await clickElement(findButtonByText(document.body, 'Confirm & Send'));
      expect(mockToastError).toHaveBeenCalledWith(
        'Delivery was not confirmed. Your draft has been kept.'
      );
      expect(onClearDraft).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Coverage Expansion: Audit Export/Import, AuditLogClient, AuditSubjectFilter,
  //     PolicyField, PolicyLayout, CategoryDialog & CategoryItem
  // ───────────────────────────────────────────────────────────────────────────
  describe('Uncovered Admin & Policies Branches', () => {
    it('AuditLogExportImportModal parses CSV with Excel/Unix/ISO dates, handles drag-drop, empty/malformed files, and import API errors', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Import rejected by server' }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const onClose = vi.fn();

      await renderClient(
        <AuditLogExportImportModal
          isOpen={true}
          onClose={onClose}
          currentFilters={{
            actionType: 'update',
            endDate: '2026-11-14',
            bookId: 'b-1',
            studentId: 's-1',
            copyId: 'c-1',
            userId: 'u-1',
          }}
        />
      );

      // Export tab filter indicators and format switches + column checkbox toggle
      expect(document.body).toHaveTextContent('Action: update');
      expect(document.body).toHaveTextContent('... to 2026-11-14');
      expect(document.body).toHaveTextContent('Selected book, student, copy, and staff filters are included.');

      await clickElement(findButtonByText(document.body, 'Excel XLSX'));
      expect(findButtonByText(document.body, 'Excel XLSX')).toHaveAttribute('aria-pressed', 'true');
      await clickElement(findButtonByText(document.body, 'Spreadsheet CSV'));
      expect(findButtonByText(document.body, 'Spreadsheet CSV')).toHaveAttribute('aria-pressed', 'true');

      const firstCheckbox = document.body.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await clickElement(firstCheckbox);
      expect(document.body).toHaveTextContent('Customize Columns (14 / 15)');

      // Switch to Import tab
      await clickElement(findButtonByText(document.body, 'Restoration & Import'));

      // 1. Empty JSON array via drag & drop onto the drop zone containing the file input
      const emptyFile = new File(['[]'], 'empty.json', { type: 'application/json' });
      const dropZone = document.body.querySelector('input[type="file"]')?.parentElement as HTMLElement;
      await act(async () => {
        const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
        dropZone.dispatchEvent(dragOverEvent);
        const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [emptyFile] } });
        dropZone.dispatchEvent(dropEvent);
        await new Promise((r) => setTimeout(r, 40));
      });
      expect(mockToastError).toHaveBeenCalledWith('The file is empty.');

      // 2. Malformed JSON
      const badJson = new File(['{bad json'], 'broken.json', { type: 'application/json' });
      const fileInput1 = document.body.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        Object.defineProperty(fileInput1, 'files', { value: [badJson], configurable: true });
        fileInput1.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 40));
      });
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('File parsing error:'));

      // 3. Valid CSV with Excel serial date, Unix seconds, Unix ms, and JSON cells
      const csvRows = [
        'Timestamp,Entity,Action,Reason,Old Value,New Value,Details',
        '46161.5,book,create,Excel serial date,"{""a"":1}","{""a"":2}","{""note"":""ok""}"',
        '1779321600,profile,update,Unix seconds,,,',
        '1779321600000,book_copy,archive,Unix ms,,,',
      ].join('\n');
      const csvFile = new File([csvRows], 'backup.csv', { type: 'text/csv' });
      const fileInput2 = document.body.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        Object.defineProperty(fileInput2, 'files', { value: [csvFile], configurable: true });
        fileInput2.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 60));
      });
      expect(document.body).toHaveTextContent('backup.csv');
      expect(mockToastSuccess).toHaveBeenCalledWith('Successfully parsed 3 audit records.');

      // Commit restoration -> server returns 400/500 -> toast error
      await clickElement(findButtonByText(document.body, 'Commit Restoration'));
      expect(mockToastError).toHaveBeenCalledWith('Import rejected by server');

      // Cancel calls onClose
      await clickElement(findButtonByText(document.body, 'Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('AuditLogClient renders creation/deletion DataDiffs, string details, subject links, quick dates, chips, and generic error', async () => {
      mockGetBookPublicDetails.mockResolvedValue({
        book: {
          id: 'book-42',
          title: 'Clean Architecture',
          author: 'Uncle Bob',
          isbn: '9780134494166',
          available_copies: 1,
          total_copies: 1,
          categories: { name: 'CS' },
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

      const logs = [
        {
          id: 'log-create',
          admin_id: 'admin-1',
          entity_type: 'book',
          entity_id: 'book-42',
          action: 'create',
          reason: null,
          details: JSON.stringify({ added: ['TagA'], source: 'import' }),
          old_value: null,
          new_value: { title: 'Clean Architecture', active: true, tags: ['Arch'], meta: { a: 1, b: 2, c: 3 } },
          created_at: '2026-11-14T01:00:00.000Z',
          subject_book_id: 'book-42',
          subject_student_id: 'stu-7',
          book_title: 'Clean Architecture',
          student_name: 'Pedro Penduko',
          student_number: '2024-0007',
          copy_barcode: 'BC-42',
          copy_accession: 'ACC-42',
          profiles: { full_name: null, email: 'admin@lumina.edu', role: 'super_admin' },
        },
        {
          id: 'log-delete',
          admin_id: 'admin-1',
          entity_type: 'category',
          entity_id: 'cat-9',
          action: 'delete',
          reason: 'Cleanup',
          details: null,
          old_value: { name: 'Obsolete', items: [] },
          new_value: null,
          created_at: '2026-11-14T02:00:00.000Z',
          profiles: null,
        },
      ];

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/admin/audit-logs/options')) {
          return new Response(
            JSON.stringify({
              options: [{ id: 'book-42', label: 'Clean Architecture', description: 'ISBN 9780134494166' }],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ logs, total: 2 }), { status: 200 });
      });
      vi.stubGlobal('fetch', fetchMock);

      window.history.replaceState(
        null,
        '',
        '/?bookId=book-42&studentId=stu-7&copyId=copy-1&userId=u-1&query=clean&entityType=book&actionType=create&startDate=2026-11-01&endDate=2026-11-14'
      );

      const handle = await renderClient(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <AuditLogClient />
        </SWRConfig>
      );
      await vi.waitFor(() => {
        expect(handle.container).toHaveTextContent('Clean Architecture');
      });

      expect(handle.container).toHaveTextContent('admin@lumina.edu');
      expect(handle.container).toHaveTextContent('System');
      expect(handle.container).toHaveTextContent('Pedro Penduko · 2024-0007');
      expect(handle.container).toHaveTextContent('BC-42 · ACC-42');
      expect(handle.container).toHaveTextContent('No reason');

      // Expand first row via table row click
      const rows = handle.container.querySelectorAll('tbody tr');
      await clickElement(rows[0]);
      expect(handle.container).toHaveTextContent('TagA');
      expect(handle.container).toHaveTextContent('Yes');

      // Expand second row (deletion state)
      await clickElement(handle.container.querySelectorAll('button[aria-label^="View details"]')[0]);
      expect(handle.container).toHaveTextContent('Obsolete');
      expect(handle.container).toHaveTextContent('Empty');

      // Click book title in table body opens BookDetailModal
      await clickElement(findButtonByText(handle.container.querySelector('tbody')!, 'Clean Architecture'));
      expect(mockGetBookPublicDetails).toHaveBeenCalledWith('book-42');

      // Open Advanced Filters modal -> quick date buttons + start > end validation
      await clickElement(findButtonByText(handle.container, 'Filters'));
      await clickElement(findButtonByText(document.body, 'Today'));
      await clickElement(findButtonByText(document.body, 'Last 7 days'));
      await clickElement(findButtonByText(document.body, 'This month'));

      const startInput = document.body.querySelector('#audit-start-date') as HTMLInputElement;
      await typeIntoInput(startInput, '2026-12-31');
      expect(mockToastError).toHaveBeenCalledWith('Start date cannot be after end date');

      await clickElement(findButtonByText(document.body, 'Done'));

      // Remove an active filter chip
      const removeSearchChip = handle.container.querySelector(
        'button[aria-label="Remove search filter"]'
      );
      await clickElement(removeSearchChip);
      expect(handle.container.querySelector('button[aria-label="Remove search filter"]')).toBeNull();

      cleanupClients();

      // Generic 500 error triggers error toast
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Database offline' }),
        })
      );
      await renderClient(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <AuditLogClient />
        </SWRConfig>
      );
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Database offline');
      });
    });

    it('AuditSubjectFilter opens, searches with debounce, selects/clears option, handles Escape & error, and AuditSubjectChip removes', async () => {
      const onChange = vi.fn();
      const onRemove = vi.fn();

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('query=fail')) {
          return new Response(JSON.stringify({}), { status: 500 });
        }
        return new Response(
          JSON.stringify({
            options: [
              { id: 'stu-1', label: 'Juan Dela Cruz', description: '2024-0001 · BSCS' },
            ],
          }),
          { status: 200 }
        );
      });
      vi.stubGlobal('fetch', fetchMock);

      const handle = await renderClient(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <div>
            <AuditSubjectChip
              kind="student"
              label="Student"
              value="stu-1"
              onRemove={onRemove}
            />
            <AuditSubjectFilter
              kind="student"
              label="Student"
              value="stu-1"
              onChange={onChange}
            />
          </div>
        </SWRConfig>
      );

      await vi.waitFor(() => {
        expect(handle.container).toHaveTextContent('Juan Dela Cruz · 2024-0001');
      });

      await clickElement(handle.container.querySelector('button[aria-label="Remove student filter"]'));
      expect(onRemove).toHaveBeenCalledTimes(1);

      // Open details dropdown
      const details = handle.container.querySelector('details') as HTMLDetailsElement;
      await act(async () => {
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
      });
      await vi.waitFor(() => {
        expect(handle.container).toHaveTextContent('2024-0001 · BSCS');
      });

      // Select option inside details dropdown
      await clickElement(findButtonByText(details, 'Juan Dela Cruz'));
      expect(onChange).toHaveBeenCalledWith({
        id: 'stu-1',
        label: 'Juan Dela Cruz',
        description: '2024-0001 · BSCS',
      });

      // Reopen, search with debounced failure query, then clear selection
      await act(async () => {
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
      });
      const searchInput = handle.container.querySelector(
        'input[aria-label="Search student"]'
      ) as HTMLInputElement;
      vi.useFakeTimers();
      await typeIntoInput(searchInput, 'fail');
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      vi.useRealTimers();
      await vi.waitFor(() => {
        expect(handle.container.querySelector('[role="alert"]')).toHaveTextContent(
          'Could not load choices. Reopen to retry.'
        );
      });

      await clickElement(findButtonByText(handle.container, 'Clear student selection'));
      expect(onChange).toHaveBeenCalledWith(null);

      // Escape key closes details
      await act(async () => {
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
      });
      await pressKey(details, 'Escape');
      expect(details.open).toBe(false);
    });

    it('PolicyField renders slider, Modified badge, and onBlur cleanup; PolicyLayout handles broadcast discard, server conflict keep, and commit failure', async () => {
      const onChange = vi.fn();
      const fieldHandle = await renderClient(
        <TooltipProvider>
          <div>
            <PolicyField
              policyKey="due_soon_reminder_days"
              value="3"
              initialValue="1"
              onChange={onChange}
              disabled={false}
              loading={false}
            />
            <PolicyField
              policyKey="loan_period_days"
              value="14"
              initialValue="14"
              onChange={onChange}
              onInvalidChange={vi.fn()}
              disabled={false}
              loading={false}
            />
          </div>
        </TooltipProvider>
      );

      expect(fieldHandle.container).toHaveTextContent('Modified');
      expect(fieldHandle.container).toHaveTextContent('3');

      const numInput = fieldHandle.container.querySelector(
        'input[aria-label="Borrowing Duration (days)"]'
      ) as HTMLInputElement;
      await typeIntoInput(numInput, '20');
      await act(async () => {
        numInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith('20');
      cleanupClients();

      // PolicyLayout: broadcasts unsaved draft Discard & Move, server conflict "Use their value", and failed commit
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Save failed' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const layoutHandle = await renderClient(
        <PolicyLayout
          settings={[{ id: 's1', key: 'loan_period_days', value: '14', description: '', updated_at: '' }]}
          canEdit={true}
          role="super_admin"
          categoriesPromise={Promise.resolve([{ id: 'c1', name: 'Fiction', slug: 'fiction', is_active: true }])}
        />
      );

      // Switch to Broadcasts, type announcement draft, then try switching to Support -> Discard & Move
      await clickElement(findButtonByText(layoutHandle.container, 'Broadcasts'));
      const subjectInput = layoutHandle.container.querySelector(
        'input[placeholder="e.g. Scheduled Library Maintenance This Weekend"]'
      ) as HTMLInputElement;
      await typeIntoInput(subjectInput, 'Maintenance');
      expect(layoutHandle.container).toHaveTextContent('Unsaved Draft');

      await clickElement(findButtonByText(layoutHandle.container, 'Support'));
      expect(document.body).toHaveTextContent('Unsaved Announcement Draft');
      await clickElement(findButtonByText(document.body, 'Discard & Move'));
      expect(mockToastSuccess).toHaveBeenCalledWith('Changes discarded');

      // Go back to Circulation, edit loan_period_days, simulate conflict, choose "Use their value"
      await clickElement(findButtonByText(layoutHandle.container, 'Circulation'));
      const loanInput = layoutHandle.container.querySelector(
        'input[aria-label="Borrowing Duration (days)"]'
      ) as HTMLInputElement;
      await typeIntoInput(loanInput, '25');

      await layoutHandle.rerender(
        <PolicyLayout
          settings={[{ id: 's1', key: 'loan_period_days', value: '10', description: '', updated_at: '' }]}
          canEdit={true}
          role="super_admin"
          categoriesPromise={Promise.resolve([{ id: 'c1', name: 'Fiction', slug: 'fiction', is_active: true }])}
        />
      );
      await clickElement(findButtonByText(layoutHandle.container, 'Use their value'));
      expect(layoutHandle.container.querySelector('[role="alert"]')).toBeNull();
      expect(layoutHandle.container).not.toHaveTextContent('unsaved changes');

      // Make another edit and test failed commit toast
      await typeIntoInput(loanInput, '28');
      await clickElement(findButtonByText(layoutHandle.container, 'Review Changes'));
      await typeIntoInput(document.body.querySelector('textarea') as HTMLTextAreaElement, 'Test commit failure reason');
      await clickElement(findButtonByText(document.body, 'Confirm & Commit'));
      expect(mockToastError).toHaveBeenCalledWith('Failed to save some settings');
    });

    it('CategoryDialog and CategoryItem cover error toast, manual slug editing, validation limits, and bulk inputs', async () => {
      const onDraftChange = vi.fn();
      const itemHandle = await renderClient(
        <CategoryItem
          category={{ id: 'c1', name: 'Fiction', slug: 'fiction', description: 'Desc', is_active: true }}
          draftCategory={{ id: 'c1', name: 'Fiction', slug: 'fiction', description: 'Desc', is_active: true }}
          isBulkEditing={true}
          isChanged={true}
          onDraftChange={onDraftChange}
        />
      );

      const bulkSlug = itemHandle.container.querySelector('input[placeholder="slug-identifier"]') as HTMLInputElement;
      const bulkDesc = itemHandle.container.querySelector('input[placeholder="Optional description"]') as HTMLInputElement;
      await typeIntoInput(bulkSlug, 'new-fiction');
      await typeIntoInput(bulkDesc, 'Updated desc');
      expect(onDraftChange).toHaveBeenCalledWith('slug', 'new-fiction');
      expect(onDraftChange).toHaveBeenCalledWith('description', 'Updated desc');
      expect(itemHandle.container).toHaveTextContent('Modified');
      cleanupClients();

      const onOpenChange = vi.fn();
      const setFormData = vi.fn();
      await renderClient(
        <CategoryDialog
          isOpen={true}
          onOpenChange={onOpenChange}
          editingId={null}
          formData={{ name: 'Sci Fi', slug: 'sci-fi', description: 'Space' }}
          setFormData={setFormData}
          onSave={vi.fn()}
          loading={false}
          error="Duplicate slug"
        />
      );
      expect(mockToastError).toHaveBeenCalledWith('Duplicate slug');

      const slugInput = document.body.querySelector('#slug') as HTMLInputElement;
      await typeIntoInput(slugInput, 'Science Fiction!');
      expect(setFormData).toHaveBeenCalled();

      await clickElement(findButtonByText(document.body, 'Cancel'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
