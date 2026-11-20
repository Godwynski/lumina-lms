import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderClient, cleanupClients } from './helpers/render';
import { CompactPagination } from '@/components/ui/compact-pagination';

afterEach(() => cleanupClients());

const setup = async (props: Partial<Parameters<typeof CompactPagination>[0]> = {}) => {
  const onPageChange = vi.fn();
  const handle = await renderClient(
    <CompactPagination page={1} totalItems={127} pageSize={24} onPageChange={onPageChange} {...props} />
  );
  const input = handle.container.querySelector<HTMLInputElement>('input')!;
  return { ...handle, onPageChange, input };
};

// React tracks input values; set through the native setter so onChange fires.
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    input.focus();
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const key = (input: HTMLInputElement, k: string) =>
  act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });

describe('CompactPagination labels', () => {
  it('says what each number means: item range with a noun, and "Page N of M"', async () => {
    const { container, input } = await setup({ page: 2, itemLabel: 'books' });
    expect(container.querySelector('p')).toHaveTextContent('Showing 25-48 of 127 books');
    expect(container).toHaveTextContent('Page');
    expect(container).toHaveTextContent('of 6');
    expect(input).toHaveValue('2');
    expect(input).toHaveAccessibleName('Go to page, 1 to 6');
    expect(container.querySelector('[role="status"]')).toHaveTextContent('Page 2 of 6');
  });

  it('defaults the noun to "items" and handles zero items', async () => {
    const { container, input } = await setup({ totalItems: 0 });
    expect(container.querySelector('p')).toHaveTextContent('0-0 of 0 items');
    expect(container).toHaveTextContent('of 1');
    expect(input).toBeDisabled();
  });

  it('keeps "Per page" visible next to the page-size picker', async () => {
    const { container } = await setup({ pageSizeOptions: [24, 48], onPageSizeChange: vi.fn() });
    const label = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === 'Per page')!;
    expect(label).not.toHaveClass('sr-only');
    expect(container.querySelector('[aria-label="Items per page"]')).toHaveTextContent('24');
  });

  it('wraps to two rows on phones with the pager across the full width, one row from sm up', async () => {
    const { container } = await setup();
    expect(container.firstElementChild).toHaveClass('flex-wrap');
    expect(container.querySelector('nav[aria-label="Pagination"]')).toHaveClass('w-full', 'sm:w-auto');
  });
});

describe('CompactPagination page input', () => {
  it('jumps to a typed page on Enter', async () => {
    const { input, onPageChange } = await setup();
    await type(input, '4');
    expect(input).toHaveValue('4');
    await key(input, 'Enter');
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('jumps when the field loses focus', async () => {
    const { input, onPageChange } = await setup();
    await type(input, '3');
    await act(async () => input.blur());
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('clamps a page past the end to the last page and 0 to the first', async () => {
    const { input, onPageChange } = await setup({ page: 3 });
    await type(input, '99');
    await key(input, 'Enter');
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    await type(input, '0');
    await key(input, 'Enter');
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('ignores letters and does nothing for an empty entry or the current page', async () => {
    const { input, onPageChange } = await setup({ page: 2 });
    await type(input, 'ab');
    expect(input).toHaveValue('');
    await key(input, 'Enter');
    await type(input, '2');
    await key(input, 'Enter');
    expect(onPageChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('2');
  });

  it('reverts the field on Escape without navigating', async () => {
    const { input, onPageChange } = await setup({ page: 2 });
    await type(input, '5');
    await key(input, 'Escape');
    expect(input).toHaveValue('2');
    await act(async () => input.blur());
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('shows the new page after the parent moves to it', async () => {
    const { input, rerender, onPageChange } = await setup();
    await rerender(<CompactPagination page={5} totalItems={127} pageSize={24} onPageChange={onPageChange} />);
    expect(input).toHaveValue('5');
  });
});

describe('CompactPagination buttons and disabled state', () => {
  it('steps with Previous/Next and disables them at the ends', async () => {
    const { container, onPageChange } = await setup({ page: 6 });
    const next = container.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!;
    const prev = container.querySelector<HTMLButtonElement>('[aria-label="Previous page"]')!;
    expect(next).toBeDisabled();
    await act(async () => prev.click());
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('blocks every control while disabled', async () => {
    const { container, input } = await setup({ page: 3, disabled: true });
    expect(input).toBeDisabled();
    expect(container.querySelector('[aria-label="Next page"]')).toBeDisabled();
    expect(container.querySelector('[aria-label="Previous page"]')).toBeDisabled();
  });
});
