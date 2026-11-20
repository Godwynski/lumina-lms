import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddBookClient } from '@/app/(authenticated)/inventory/add/AddBookClient';
import { AdminManagementContent } from '@/components/catalog/AdminManagementContent';
import type { Book, BookCopyWithReservation } from '@/lib/types';
import { cleanupClients, clickElement, pressKey, renderClient, submitForm, typeIntoInput } from './helpers/render';

const actions = vi.hoisted(() => ({
  addBookCopies: vi.fn(),
  createBook: vi.fn(),
  getBookAdminDetails: vi.fn(),
  getCategories: vi.fn(),
  recordCopyDisposition: vi.fn(),
  updateBookCopyStatus: vi.fn(),
  updateCopyAcquisition: vi.fn(),
}));

vi.mock('@/lib/actions/catalog', () => actions);
vi.mock('@/lib/actions/isbn-lookup', () => ({ fetchISBNDetails: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,QR' } }));

const book: Book = { id: 'book', title: 'Chemistry', author: 'Jose Luna', total_copies: 4, available_copies: 2 };

function copy(number: number, status: BookCopyWithReservation['status'] = 'AVAILABLE'): BookCopyWithReservation {
  return {
    id: `copy-${number}`, book_id: book.id, status, reservation: null,
    qr_string: `QR-${number}`, accession_number: `ACC-${number}`, created_at: '2025-01-01T00:00:00Z',
  };
}

function input(root: ParentNode, label: string): HTMLInputElement | undefined {
  return Array.from(root.querySelectorAll('input')).find((control) =>
    control.getAttribute('aria-label') === label || Array.from(control.labels ?? []).some((item) => item.textContent === label)
  );
}

function button(root: ParentNode, label: string) {
  return Array.from(root.querySelectorAll('button')).find((control) =>
    (control.getAttribute('aria-label') ?? control.textContent?.trim()) === label
  );
}

async function changeSelect(root: ParentNode, label: string, value: string) {
  const control = Array.from(root.querySelectorAll('select')).find((select) =>
    Array.from(select.labels ?? []).some((item) => item.textContent === label)
  );
  if (!control) throw new Error(`Missing select: ${label}`);
  await act(async () => {
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function chooseStatus(root: ParentNode, label: string, option: string) {
  await pressKey(root.querySelector(`[aria-label="${label}"]`), 'Enter');
  await clickElement(Array.from(document.querySelectorAll('[role="option"]')).find((item) => item.textContent === option));
}

function renderInventory(copies = [copy(1), copy(2)], canManage = true) {
  return renderClient(<AdminManagementContent initialBook={book} initialCopies={copies} canManage={canManage} onClose={vi.fn()} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  actions.getCategories.mockResolvedValue([]);
  actions.getBookAdminDetails.mockResolvedValue({ book, copies: [copy(1), copy(2)], queue: [] });
  actions.createBook.mockResolvedValue({ success: true });
  actions.addBookCopies.mockResolvedValue({ success: true });
});

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

afterEach(cleanupClients);

describe('physical copy details', () => {
  it('keeps the acquisition action in the row and names the controls in the expanded panel', async () => {
    const { container } = await renderInventory();
    const actionsButton = button(container, 'Copy actions for ACC-1');
    await clickElement(actionsButton);
    const panel = document.getElementById(actionsButton!.getAttribute('aria-controls')!)!;
    expect(panel).toBeVisible();
    expect(panel).not.toHaveTextContent('No acquisition details recorded');
    expect(panel).toHaveTextContent('Copy status');
    expect(button(panel, 'Print QR')).toBeVisible();
    expect(button(panel, 'Record sale, donation, or loss')).toBeVisible();
    const edit = button(container, 'Edit acquisition for ACC-1');
    expect(edit).toBeVisible();
    await clickElement(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    expect(panel.querySelector('form')).toHaveAccessibleName('Acquisition for ACC-1');
    expect(button(panel, 'Print QR')).toBeUndefined();
    await clickElement(button(panel, 'Cancel'));
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    expect(button(panel, 'Print QR')).toBeVisible();
    expect(actions.updateCopyAcquisition).not.toHaveBeenCalled();
  });

  it('opens copies first and edits a donation directly from the matching accession row', async () => {
    const donated = { ...copy(1), lifecycle: {
      acquisition_method: 'DONATED' as const, acquired_on: '2025-01-02', purchase_price: null,
      disposition_on: null, sale_amount: null, last_lost_on: null,
    } };
    const { container } = await renderInventory([donated, copy(2)]);
    const copies = container.querySelector('[role="tab"][aria-selected="true"]');
    expect(copies).toHaveTextContent('Copies & acquisition');
    expect(container).toHaveTextContent('Donated');
    expect(container).toHaveTextContent('Acquisition not recorded');
    await clickElement(button(container, 'Edit acquisition for ACC-1'));
    expect(container.querySelector('form[aria-label="Acquisition for ACC-1"]')).toBeVisible();
    expect(input(container, 'Acquisition date')).toHaveValue('2025-01-02');
    expect(input(container, 'Price per copy (₱)')).toBeUndefined();

    await typeIntoInput(input(container, 'Acquisition date'), '2099-01-01');
    await clickElement(button(container, 'Save acquisition'));
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('Date cannot be in the future.');
    expect(actions.updateCopyAcquisition).not.toHaveBeenCalled();

    await typeIntoInput(input(container, 'Acquisition date'), '2025-02-03');
    actions.updateCopyAcquisition.mockResolvedValueOnce({ success: false, error: 'Could not update this copy.' });
    await clickElement(button(container, 'Save acquisition'));
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('Could not update this copy.');
    expect(input(container, 'Acquisition date')).toHaveValue('2025-02-03');

    actions.updateCopyAcquisition.mockResolvedValueOnce({ success: true });
    actions.getBookAdminDetails.mockResolvedValueOnce({
      book, copies: [{ ...donated, lifecycle: { ...donated.lifecycle, acquired_on: '2025-02-03' } }, copy(2)], queue: [],
    });
    await clickElement(button(container, 'Save acquisition'));
    expect(actions.updateCopyAcquisition).toHaveBeenLastCalledWith({
      id: 'copy-1', acquisition: { method: 'DONATED', acquiredOn: '2025-02-03', purchasePrice: null },
    });
    expect(container.querySelector('[role="status"]')).toHaveTextContent('Acquisition details saved.');
    expect(container).toHaveTextContent('Feb 3, 2025');
  });

  it('expands only one copy and saves a bought acquisition at zero pesos with inline feedback', async () => {
    const { container } = await renderInventory();
    const first = button(container, 'Copy actions for ACC-1');
    const second = button(container, 'Copy actions for ACC-2');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    await clickElement(first);
    expect(container).toHaveTextContent('Acquisition not recorded');
    await clickElement(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    await clickElement(button(container, 'Edit acquisition for ACC-2'));
    expect(input(container, 'Price per copy (₱)')).toBeUndefined();
    await changeSelect(container, 'Acquisition method', 'PURCHASED');
    await typeIntoInput(input(container, 'Acquisition date'), '2025-01-02');
    await typeIntoInput(input(container, 'Price per copy (₱)'), '0');
    actions.updateCopyAcquisition.mockResolvedValue({ success: true });
    actions.getBookAdminDetails.mockResolvedValue({ book, copies: [copy(1), {
      ...copy(2), lifecycle: {
        acquisition_method: 'PURCHASED', acquired_on: '2025-01-02', purchase_price: 0,
        disposition_on: null, sale_amount: null, last_lost_on: null,
      },
    }], queue: [] });

    await clickElement(button(container, 'Save acquisition'));

    expect(actions.updateCopyAcquisition).toHaveBeenCalledWith({ id: 'copy-2', acquisition: { method: 'PURCHASED', acquiredOn: '2025-01-02', purchasePrice: '0' } });
    const details = document.getElementById(second?.getAttribute('aria-controls') ?? '');
    expect(details?.querySelector('[role="status"]')).toHaveTextContent('Acquisition details saved');
    expect(container).toHaveTextContent('Bought');
    expect(container).toHaveTextContent('₱0.00');
  });

  it('prefills Lost from the old status menu and keeps an inline server error open for retry', async () => {
    const { container } = await renderInventory();
    await clickElement(button(container, 'Copy actions for ACC-1'));
    await chooseStatus(container, 'Copy status for ACC-1', 'Lost');
    expect(actions.updateBookCopyStatus).not.toHaveBeenCalled();
    expect(button(container, 'Copy actions for ACC-1')).toHaveAttribute('aria-expanded', 'true');
    expect(input(container, 'Sale amount (₱)')).toBeUndefined();
    await typeIntoInput(input(container, 'Date of change'), '2025-01-03');
    actions.recordCopyDisposition.mockResolvedValue({ success: false, error: 'A reservation must be resolved first.' });

    await clickElement(button(container, 'Confirm change'));

    expect(actions.recordCopyDisposition).toHaveBeenCalledWith({ id: 'copy-1', status: 'LOST', occurredOn: '2025-01-03' });
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('A reservation must be resolved first.');
    expect(input(container, 'Date of change')).toHaveValue('2025-01-03');
  });

  it('requires sale amount, accepts zero, and reports a waiting queue after recording a sale', async () => {
    const { container } = await renderInventory();
    await clickElement(button(container, 'Copy actions for ACC-1'));
    await clickElement(button(container, 'Record sale, donation, or loss'));
    await changeSelect(container, 'New status', 'SOLD');
    await typeIntoInput(input(container, 'Date of change'), '2025-01-03');

    await submitForm(input(container, 'Sale amount (₱)')?.form);
    expect(actions.recordCopyDisposition).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('Enter the sale amount');

    await typeIntoInput(input(container, 'Sale amount (₱)'), '0');
    actions.recordCopyDisposition.mockResolvedValue({ success: true, data: { id: 'copy-1', bookId: book.id, status: 'SOLD', queueWaiting: true } });
    actions.getBookAdminDetails.mockResolvedValue({ book, copies: [copy(1, 'SOLD'), copy(2)], queue: [] });
    await clickElement(button(container, 'Confirm change'));

    expect(actions.recordCopyDisposition).toHaveBeenCalledWith({ id: 'copy-1', status: 'SOLD', occurredOn: '2025-01-03', saleAmount: '0' });
    expect(container.querySelector('[role="status"]')).toHaveTextContent(/Sold.*reservation.*waiting/i);
    expect(button(container, 'Record sale, donation, or loss')).toBeUndefined();
  });

  it('keeps held copies out of the disposition form and lets a read-only user see copy details without editing', async () => {
    const { container, rerender } = await renderInventory([copy(1, 'RESERVED'), copy(2, 'BORROWED')]);
    await clickElement(button(container, 'Copy actions for ACC-1'));
    expect(button(container, 'Record sale, donation, or loss')).toBeUndefined();
    await clickElement(button(container, 'Copy actions for ACC-2'));
    await clickElement(button(container, 'Report lost'));
    const status = Array.from(container.querySelectorAll('select')).find((select) => select.value === 'LOST');
    expect(Array.from(status?.options ?? []).map((option) => option.value)).toEqual(['LOST']);

    await rerender(<AdminManagementContent initialBook={book} initialCopies={[copy(1), { ...copy(2), lifecycle: null }]} canManage={false} onClose={vi.fn()} />);
    expect(container).toHaveTextContent('Acquisition not recorded');
    expect(button(container, 'Copy actions for ACC-1')).toBeUndefined();
    expect(button(container, 'Edit acquisition for ACC-2')).toBeUndefined();
    expect(button(container, 'Report lost')).toBeUndefined();
    expect(button(container, 'Record sale, donation, or loss')).toBeUndefined();
    expect(button(container, 'Confirm change')).toBeUndefined();
    expect(button(container, 'Add Copies')).toBeUndefined();
  });

  it('lets a catalog manager date a legacy lost copy and still mark it found through the status menu', async () => {
    const { container } = await renderInventory([copy(1, 'LOST')]);
    await clickElement(button(container, 'Copy actions for ACC-1'));
    await clickElement(button(container, 'Add loss date'));
    await typeIntoInput(input(container, 'Date of change'), '2999-01-03');
    await clickElement(button(container, 'Confirm change'));
    expect(actions.recordCopyDisposition).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('Date cannot be in the future.');
    await typeIntoInput(input(container, 'Date of change'), '2025-01-03');
    actions.recordCopyDisposition.mockResolvedValue({ success: true, data: { id: 'copy-1', bookId: book.id, status: 'LOST', queueWaiting: false } });
    actions.getBookAdminDetails.mockResolvedValue({ book, copies: [{
      ...copy(1, 'LOST'), lifecycle: {
        acquisition_method: null, acquired_on: null, purchase_price: null,
        disposition_on: null, sale_amount: null, last_lost_on: '2025-01-03',
      },
    }], queue: [] });

    await clickElement(button(container, 'Confirm change'));

    expect(actions.recordCopyDisposition).toHaveBeenCalledWith({ id: 'copy-1', status: 'LOST', occurredOn: '2025-01-03' });
    expect(container).toHaveTextContent('Last reported lost');
    expect(button(container, 'Add loss date')).toBeUndefined();
    actions.updateBookCopyStatus.mockResolvedValue({ success: true });
    await chooseStatus(container, 'Copy status for ACC-1', 'Available');
    expect(actions.updateBookCopyStatus).toHaveBeenCalledWith({ id: 'copy-1', status: 'AVAILABLE' });
  });

  it('records a donation without a sale amount and keeps feedback visible when the active filter hides the row', async () => {
    const { container } = await renderInventory();
    await chooseStatus(container, 'Filter copies by status', 'Available');
    await clickElement(button(container, 'Copy actions for ACC-1'));
    await clickElement(button(container, 'Record sale, donation, or loss'));
    await changeSelect(container, 'New status', 'SOLD');
    await typeIntoInput(input(container, 'Sale amount (₱)'), '100');
    await changeSelect(container, 'New status', 'DONATED_OUT');
    expect(input(container, 'Sale amount (₱)')).toBeUndefined();
    await typeIntoInput(input(container, 'Date of change'), '2025-01-03');
    actions.recordCopyDisposition.mockResolvedValue({ success: true, data: { id: 'copy-1', bookId: book.id, status: 'DONATED_OUT', queueWaiting: false } });
    actions.getBookAdminDetails.mockResolvedValue({ book, copies: [copy(1, 'DONATED_OUT'), copy(2)], queue: [] });

    await clickElement(button(container, 'Confirm change'));

    expect(actions.recordCopyDisposition).toHaveBeenCalledWith({ id: 'copy-1', status: 'DONATED_OUT', occurredOn: '2025-01-03' });
    expect(container).not.toHaveTextContent('ACC-1');
    expect(container.querySelector('[role="status"]')).toHaveTextContent('Donated out');
  });

  it('filters sold and donated-out copies and excludes both from routine QR batches', async () => {
    const { container } = await renderInventory([copy(1), copy(2, 'SOLD'), copy(3, 'DONATED_OUT'), copy(4)]);
    await chooseStatus(container, 'Filter copies by status', 'Sold');
    expect(container).toHaveTextContent('ACC-2');
    expect(container).not.toHaveTextContent('ACC-1');
    await chooseStatus(container, 'Filter copies by status', 'Donated out');
    expect(container).toHaveTextContent('ACC-3');
    expect(container).not.toHaveTextContent('ACC-2');

    await clickElement(button(container, 'Print all QR'));

    const sheet = document.querySelector('[data-qr-print-sheet]');
    expect(sheet).toHaveTextContent('ACC-1');
    expect(sheet).toHaveTextContent('ACC-4');
    expect(sheet).not.toHaveTextContent('ACC-2');
    expect(sheet).not.toHaveTextContent('ACC-3');
  });
});

describe('acquisition details for new copies', () => {
  it('sends one optional acquisition for all initial copies and discards the price when changed to Donated', async () => {
    const { container } = await renderClient(<AddBookClient />);
    expect(input(container, 'Acquisition date')).toBeUndefined();
    await clickElement(button(container, 'Acquisition details'));
    await typeIntoInput(input(container, 'Book Title *'), 'Chemistry');
    await typeIntoInput(input(container, 'Author *'), 'Jose Luna');
    await typeIntoInput(input(container, 'Initial Copies'), '3');
    await changeSelect(container, 'Acquisition method', 'PURCHASED');
    await typeIntoInput(input(container, 'Price per copy (₱)'), '100.50');
    await changeSelect(container, 'Acquisition method', 'DONATED');
    expect(input(container, 'Price per copy (₱)')).toBeUndefined();
    await typeIntoInput(input(container, 'Acquisition date'), '2025-01-03');

    await submitForm(container.querySelector('form'));

    expect(actions.createBook).toHaveBeenCalledWith(expect.objectContaining({ copiesCount: 3, acquisition: { method: 'DONATED', acquiredOn: '2025-01-03', purchasePrice: null } }));
  });

  it('validates Add Copies bounds, sends per-copy details and keeps failed input for retry', async () => {
    const { container } = await renderInventory();
    await clickElement(button(container, 'Add Copies'));
    expect(input(container, 'Acquisition date')).toBeUndefined();
    const count = input(container, 'Number of copies to add');
    await typeIntoInput(count, '51');
    await submitForm(count?.form);
    expect(actions.addBookCopies).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('1 to 50');
    await typeIntoInput(count, '50');
    await clickElement(button(container, 'Acquisition details'));
    await changeSelect(container, 'Acquisition method', 'PURCHASED');
    await typeIntoInput(input(container, 'Price per copy (₱)'), '15.25');
    actions.addBookCopies.mockResolvedValueOnce({ success: false, error: 'Copy allocation failed.' });

    await clickElement(button(container, 'Confirm'));

    expect(actions.addBookCopies).toHaveBeenCalledWith({ bookId: book.id, copiesCount: 50, acquisition: { method: 'PURCHASED', acquiredOn: null, purchasePrice: '15.25' } });
    expect(container.querySelector('[role="alert"]')).toHaveTextContent('Copy allocation failed.');
    expect(input(container, 'Price per copy (₱)')).toHaveValue(15.25);
  });
});
