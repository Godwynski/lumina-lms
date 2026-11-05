/**
 * Regression tests for fixes from docs/UI_AUDIT_QA.md.
 * Uses real DOM events in jsdom (react-dom/client + act).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}));

import { PolicyField } from '@/components/admin/policies/PolicyField';
import { LuminaTable } from '@/components/common/LuminaTable';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { FieldGroup } from '@/components/common/FieldGroup';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Notification } from '@/hooks/use-notifications';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  push.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(ui: React.ReactElement) {
  act(() => root.render(ui));
}

// Set a controlled input's value the way a user would.
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function keyDown(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

describe('UI-28 PolicyField number drafts', () => {
  function renderField(onChange: (v: string) => void) {
    render(
      <TooltipProvider>
        <PolicyField
          policyKey="loan_period_days"
          value="7"
          initialValue="7"
          onChange={onChange}
          disabled={false}
          loading={false}
        />
      </TooltipProvider>
    );
    return container.querySelector('input') as HTMLInputElement;
  }

  it('clearing the box never commits 0 and shows guidance', () => {
    const onChange = vi.fn();
    const input = renderField(onChange);
    typeInto(input, '');
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain('Enter a value.');
  });

  it('valid whole numbers are passed through unchanged', () => {
    const onChange = vi.fn();
    const input = renderField(onChange);
    typeInto(input, '14');
    expect(onChange).toHaveBeenLastCalledWith('14');
  });

  it('decimals are rejected instead of silently truncated', () => {
    const onChange = vi.fn();
    const input = renderField(onChange);
    typeInto(input, '3.5');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('UI-11 LuminaTable nested controls', () => {
  it('Space on a row checkbox does not open the row; Enter on the row does', () => {
    const onRowClick = vi.fn();
    render(
      <LuminaTable
        data={[{ id: '1', name: 'Ada' }]}
        onRowClick={onRowClick}
        columns={[
          { header: 'Select', cell: () => <input type="checkbox" aria-label="Select Ada" /> },
          { header: 'Name', accessor: 'name' },
        ]}
      />
    );
    const row = container.querySelector('tbody tr') as HTMLElement;
    const checkbox = row.querySelector('input[type=checkbox]') as HTMLElement;

    keyDown(checkbox, ' ');
    expect(onRowClick).not.toHaveBeenCalled();

    keyDown(row, 'Enter');
    expect(onRowClick).toHaveBeenCalledTimes(1);
    // Desktop rows keep table semantics (no role="button" on <tr>).
    expect(row.getAttribute('role')).toBeNull();
  });
});

describe('UI-22 NotificationItem mark-as-read by keyboard', () => {
  const notification: Notification = {
    id: 'n1',
    user_id: 'u1',
    title: 'Due soon',
    content: 'A long message '.repeat(20),
    type: 'DUE_SOON',
    priority: 'medium',
    is_read: false,
    metadata: {},
    created_at: new Date().toISOString(),
  };

  it('Enter on the mark-read button does not navigate', () => {
    const onMarkRead = vi.fn();
    render(<NotificationItem notification={notification} onMarkRead={onMarkRead} />);
    const button = container.querySelector('button[aria-label^="Mark"]') as HTMLElement;
    keyDown(button, 'Enter');
    expect(push).not.toHaveBeenCalled();
  });

  it('UI-21 full variant does not clamp the message', () => {
    render(<NotificationItem notification={notification} onMarkRead={vi.fn()} />);
    expect(container.innerHTML).not.toContain('line-clamp');
  });
});

describe('UI-25 FieldGroup label association', () => {
  it('links the visible label to the input', () => {
    render(
      <FieldGroup label="Display Name">
        <Input />
      </FieldGroup>
    );
    const label = container.querySelector('label') as HTMLLabelElement;
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.id).toBeTruthy();
    expect(label.htmlFor).toBe(input.id);
  });
});
