import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookOpen, Plus, SearchX } from 'lucide-react';
import {
  renderClient,
  cleanupClients,
  clickElement,
  pressKey,
} from './helpers/render';

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

import { AdminTableShell } from '@/components/admin/AdminTableShell';
import { LuminaTable, type LuminaColumn } from '@/components/common/LuminaTable';
import { EmptyState } from '@/components/ui/empty-state';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { ViewModeToggle, resolveViewMode } from '@/components/common/ViewModeToggle';

interface SampleRow {
  id: string;
  title: string;
  status: string;
}

const COLUMNS: LuminaColumn<SampleRow>[] = [
  { header: 'Title', accessor: 'title', mobileMain: true },
  { header: 'Status', accessor: 'status' },
];

describe('B2 Shared Table & States', () => {
  afterEach(() => {
    cleanupClients();
    vi.clearAllMocks();
  });

  it('LuminaTable hides <thead> when data is empty and renders EmptyState inside container', async () => {
    const onClear = vi.fn();
    const { container, rerender } = await renderClient(
      <LuminaTable
        data={[]}
        columns={COLUMNS}
        emptyState={{
          title: 'No matches found',
          description: 'Try clearing active filters.',
          variant: 'no-results',
          icon: SearchX,
          action: { label: 'Clear all filters', onClick: onClear },
        }}
      />
    );

    expect(container.querySelector('thead')).toBeNull();
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('No matches found');
    expect(container.textContent).toContain('Try clearing active filters.');

    const clearBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear all filters')
    );
    expect(clearBtn).toBeDefined();
    expect(clearBtn?.className).not.toContain('uppercase');
    await clickElement(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);

    // Non-empty renders both desktop table <thead> and mobile card list
    await rerender(
      <LuminaTable
        data={[{ id: '1', title: 'Clean Code', status: 'Available' }]}
        columns={COLUMNS}
      />
    );
    expect(container.querySelector('thead')).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelector('tbody tr')).toHaveTextContent('Clean Code');

    // Loading state renders consistent sentence-case Refreshing... indicator
    await rerender(
      <LuminaTable
        data={[]}
        columns={COLUMNS}
        isLoading
      />
    );
    expect(container.textContent).toContain('Refreshing...');
  });

  it('LuminaTable renders custom or default mobile cards and triggers keyboard row click', async () => {
    const onRowClick = vi.fn();
    const { container, rerender } = await renderClient(
      <LuminaTable
        data={[{ id: 'b1', title: 'Refactoring', status: 'Borrowed' }]}
        columns={COLUMNS}
        onRowClick={onRowClick}
      />
    );

    const mobileCard = container.querySelector('[role="button"]') as HTMLElement;
    expect(mobileCard).not.toBeNull();
    expect(mobileCard.textContent).toContain('Refactoring');
    expect(mobileCard.textContent).toContain('Borrowed');

    await pressKey(mobileCard, 'Enter');
    expect(onRowClick).toHaveBeenCalledWith({ id: 'b1', title: 'Refactoring', status: 'Borrowed' });

    await rerender(
      <LuminaTable
        data={[{ id: 'b1', title: 'Refactoring', status: 'Borrowed' }]}
        columns={COLUMNS}
        renderMobileRow={(item) => <div data-testid="custom-mobile">{item.title} :: custom</div>}
      />
    );
    expect(container.querySelector('[data-testid="custom-mobile"]')?.textContent).toBe(
      'Refactoring :: custom'
    );
  });

  it('EmptyState differentiates first-use and no-results variants with sentence-case buttons', async () => {
    const onClear = vi.fn();
    const { container, rerender } = await renderClient(
      <EmptyState
        variant="first-use"
        icon={BookOpen}
        title="No books in inventory yet"
        description="Add your first book to get started."
        action={{ label: 'Add Book', href: '/inventory/add', icon: Plus }}
      />
    );

    expect(container.querySelector('[data-empty-variant="first-use"]')).not.toBeNull();
    const firstUseLink = container.querySelector('a[href="/inventory/add"]');
    expect(firstUseLink?.textContent).toContain('Add Book');
    expect(firstUseLink?.className).not.toContain('uppercase');

    await rerender(
      <EmptyState
        variant="no-results"
        icon={SearchX}
        title="No matches found"
        description="Nothing matched your query."
        action={{ label: 'Clear all filters', onClick: onClear }}
      />
    );

    expect(container.querySelector('[data-empty-variant="no-results"]')).not.toBeNull();
    const btn = container.querySelector('button');
    expect(btn?.textContent).toContain('Clear all filters');
    expect(btn?.className).not.toContain('uppercase');
    await clickElement(btn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('AdminTableShell, CompactPagination, and ViewModeToggle render sentence-case labels and toggle state', async () => {
    const onPageChange = vi.fn();
    const onModeChange = vi.fn();
    const { container } = await renderClient(
      <AdminTableShell
        title="Inventory"
        description="Manage library titles"
        controls={<ViewModeToggle value="cards" onChange={onModeChange} />}
        pagination={
          <CompactPagination
            page={1}
            totalItems={20}
            pageSize={10}
            onPageChange={onPageChange}
            pageSizeOptions={[10, 20]}
            onPageSizeChange={vi.fn()}
          />
        }
      >
        <div>Table content</div>
      </AdminTableShell>
    );

    expect(container.querySelector('h2')?.textContent).toBe('Inventory');
    expect(container.textContent).toContain('Per page');
    expect(container.textContent).toContain('Showing 1-10 of 20');

    const cardsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cards')
    );
    const tableBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Table')
    );
    expect(cardsBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(tableBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(tableBtn?.className).not.toContain('uppercase');

    await clickElement(tableBtn);
    expect(onModeChange).toHaveBeenCalledWith('table');
    expect(resolveViewMode('table', 'cards')).toBe('table');
    expect(resolveViewMode(null, 'table')).toBe('table');
    expect(resolveViewMode(null, undefined)).toBe('cards');
  });
});
