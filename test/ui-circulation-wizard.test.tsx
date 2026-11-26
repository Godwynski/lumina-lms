import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
  submitForm,
} from './helpers/render';

const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
const mockRouterPush = vi.fn();
let mockSearchParamsString = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
    push: mockRouterPush,
  }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
  redirect: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/actions/circulation', () => ({
  resolveScan: vi.fn(),
  checkoutBook: vi.fn(),
  returnBook: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockScannerStart = vi.fn();
const mockScannerStop = vi.fn();
const mockScannerClear = vi.fn();
vi.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class MockHtml5Qrcode {
    isScanning = true;
    start() {
      return mockScannerStart();
    }
    stop() {
      return mockScannerStop();
    }
    clear() {
      return mockScannerClear();
    }
    getRunningTrackSettings() {
      return { deviceId: 'cam-1' };
    }
  },
}));

import { metadata as circulationMetadata } from '@/app/(authenticated)/circulation/layout';
import { CirculationWizard } from '@/components/circulation/CirculationWizard';
import { ScanStep } from '@/components/circulation/steps/ScanStep';
import { FineSettlementDialog } from '@/components/common/FineSettlementDialog';

describe('B3 Circulation & Fines UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsString = '';
    mockScannerStart.mockResolvedValue(undefined);
    mockScannerStop.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
  });

  it('uses canonical "Circulation Desk" page metadata title', () => {
    expect(circulationMetadata.title).toBe('Circulation Desk');
  });

  it('ScanStep auto-focuses #circulation-code, renders manual input before camera toggle, and collapses camera preview until started', async () => {
    const onScan = vi.fn().mockResolvedValue(true);
    const { container } = await renderClient(
      <ScanStep
        title="Scan library card"
        description="Scan library card or enter number."
        label="Card or Patron ID"
        placeholder="e.g. DEMO-STU-001"
        onScan={onScan}
        isProcessing={false}
        actionLabel="Process"
      />
    );

    const input = container.querySelector('#circulation-code') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input.placeholder).toBe('e.g. DEMO-STU-001');

    const label = container.querySelector('label[for="circulation-code"]');
    expect(label?.textContent?.trim()).toBe('Card or Patron ID');
    expect(label?.textContent?.trim()).not.toBe(input.placeholder);

    const startCamBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start camera')
    ) as HTMLButtonElement;
    expect(startCamBtn).toBeDefined();

    // Manual input appears before camera toggle in DOM order
    const rel = input.compareDocumentPosition(startCamBtn);
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Camera viewport wrapper is hidden initially
    const scannerEl = container.querySelector('[id^="circulation-scanner"]') as HTMLElement;
    expect(scannerEl.parentElement?.className).toContain('hidden');

    // Submit manual code
    await typeIntoInput(input, 'demo-stu-001');
    await submitForm(input.closest('form'));
    expect(onScan).toHaveBeenCalledWith('DEMO-STU-001', true);
  });

  it('CirculationWizard supplies concrete ID placeholder on initial step 1', async () => {
    const { container } = await renderClient(<CirculationWizard />);
    const input = container.querySelector('#circulation-code') as HTMLInputElement;
    expect(input.placeholder).toContain('LIB-2026-0001');
    expect(document.activeElement).toBe(input);
  });

  it('FineSettlementDialog avoids auto-focusing remarks textarea and groups secondary vs primary footer actions', async () => {
    const onOpenChange = vi.fn();
    const onReturnOnly = vi.fn();
    const onResolve = vi.fn();

    await renderClient(
      <FineSettlementDialog
        open
        onOpenChange={onOpenChange}
        title="Return & Penalty Settlement"
        description="Book is overdue."
        fineAmount={85}
        allowReturnOnly
        onReturnOnly={onReturnOnly}
        onResolve={onResolve}
      />
    );

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();

    const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement;
    expect(document.activeElement).not.toBe(textarea);

    const cancelBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel');
    const returnOnlyBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Return Only')
    );
    const condonedBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark as Condoned')
    );
    const paidBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark as Paid (₱85.00)')
    );

    expect(cancelBtn).toBeDefined();
    expect(returnOnlyBtn).toBeDefined();
    expect(condonedBtn).toBeDefined();
    expect(paidBtn).toBeDefined();

    // Secondary actions live in a separate group from primary settlement actions
    expect(cancelBtn?.parentElement).toBe(returnOnlyBtn?.parentElement);
    expect(condonedBtn?.parentElement).toBe(paidBtn?.parentElement);
    expect(cancelBtn?.parentElement).not.toBe(paidBtn?.parentElement);

    await clickElement(paidBtn);
    expect(onResolve).toHaveBeenCalledWith('PAID', '');
  });
});
