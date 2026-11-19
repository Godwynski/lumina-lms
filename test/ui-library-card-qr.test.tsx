import { afterEach, describe, expect, it, vi } from 'vitest';
import MyCardContainer from '@/components/library/MyCardContainer';
import { AnimationProvider } from '@/components/providers/animation-provider';
import { cleanupClients, clickElement, renderClient } from './helpers/render';

const baseData = {
  fullName: 'Demo Patron',
  studentId: '2024-0099',
  cardNumber: 'LIB-2024-0099',
  department: 'Computer Science',
  status: 'active' as const,
  expiryDate: '2027-06-30',
  avatarUrl: null,
  qrUrl: null,
};

afterEach(() => {
  cleanupClients();
  vi.unstubAllGlobals();
});

function renderCard() {
  return renderClient(
    <AnimationProvider>
      <MyCardContainer initialData={baseData} variant="dashboard" />
    </AnimationProvider>
  );
}

function exportButton(container: HTMLElement) {
  return [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Export');
}

describe('Library card QR', () => {
  it.each([
    [401, "Your session ended. Sign in again to load your card QR.", false],
    [403, "Your account can't access this card QR. Contact the library desk.", false],
    [400, "Your library ID is missing. Contact the library desk.", false],
    [404, "The card service is unavailable. Try again or contact the library desk.", true],
    [200, "Your card QR isn't ready yet. Try again or contact the library desk.", true],
  ] as const)('explains QR failure for status %s and offers the appropriate recovery', async (status, message, canRetry) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      status === 200 ? JSON.stringify({ qr_exists: true, qr_url: null }) : null,
      { status },
    )));

    const { container } = await renderCard();

    const alert = container.querySelector('[role="alert"]')!;
    expect(alert).toHaveTextContent(message);
    expect(Boolean(alert.querySelector('button'))).toBe(canRetry);
    expect(exportButton(container)).toBeDisabled();
  });

  it('retries a service error and enables export when a private QR URL arrives', async () => {
    const fetchAssets = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json({
        qr_exists: true,
        qr_url: 'https://example.com/signed/qr.png',
        profile_exists: false,
      }));
    vi.stubGlobal('fetch', fetchAssets);

    const { container } = await renderCard();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toHaveTextContent("The card service couldn't load your QR. Try again.");
    expect(exportButton(container)).toBeDisabled();

    await clickElement(alert?.querySelector('button'));
    expect(fetchAssets).toHaveBeenNthCalledWith(2, '/api/my-card/assets-status', {
      method: 'GET',
      cache: 'no-store',
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('#library-card-front img[alt^="QR code"]')).toHaveAttribute('src', 'https://example.com/signed/qr.png');
    expect(exportButton(container)).toBeEnabled();
  });
});
