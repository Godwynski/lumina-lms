import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderClient, cleanupClients } from './helpers/render';

// --- External boundary mocks ---
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
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockResolveScan = vi.fn();
const mockCheckoutBook = vi.fn();
const mockReturnBook = vi.fn();
vi.mock('@/lib/actions/circulation', () => ({
  resolveScan: (...args: unknown[]) => mockResolveScan(...args),
  checkoutBook: (...args: unknown[]) => mockCheckoutBook(...args),
  returnBook: (...args: unknown[]) => mockReturnBook(...args),
}));

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

// Mock html5-qrcode dynamic import boundary for useScanner
const mockQrStart = vi.fn();
const mockQrStop = vi.fn();
const mockQrClear = vi.fn();
const mockQrGetRunningTrackSettings = vi.fn();
let mockQrIsScanning = false;
let capturedQrSuccessCallback: ((decodedText: string) => Promise<void> | void) | null = null;
const mockHtml5QrcodeInstances: Array<{ containerId: string }> = [];

vi.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class MockHtml5Qrcode {
    isScanning = false;
    constructor(containerId: string) {
      mockHtml5QrcodeInstances.push({ containerId });
    }
    async start(
      cameraIdOrConfig: unknown,
      config: { qrbox?: (w: number, h: number) => { width: number; height: number } },
      onSuccess: (decodedText: string) => Promise<void> | void
    ) {
      capturedQrSuccessCallback = onSuccess;
      config.qrbox?.(200, 300);
      await mockQrStart(cameraIdOrConfig, config);
      this.isScanning = true;
      mockQrIsScanning = true;
    }
    async stop() {
      await mockQrStop();
      this.isScanning = false;
      mockQrIsScanning = false;
    }
    clear() {
      mockQrClear();
    }
    getRunningTrackSettings() {
      return mockQrGetRunningTrackSettings();
    }
  },
}));

import { useCirculationWizard, CHECKOUT_STEPS, RETURN_STEPS } from '@/hooks/use-circulation-wizard';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { useLogout } from '@/hooks/use-logout';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScanFeedback } from '@/hooks/use-scan-feedback';
import { useScanner } from '@/hooks/use-scanner';
import { useSearchParamsLite } from '@/hooks/use-search-params-lite';

describe('Custom Hooks Behavioral Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsString = '';
    mockQrIsScanning = false;
    capturedQrSuccessCallback = null;
    mockHtml5QrcodeInstances.length = 0;
  });

  afterEach(() => {
    cleanupClients();
    vi.useRealTimers();
  });

  describe('useCirculationWizard', () => {
    function WizardHarness({
      onState,
    }: {
      onState: (api: ReturnType<typeof useCirculationWizard>) => void;
    }) {
      const api = useCirculationWizard();
      onState(api);
      return (
        <div>
          <span data-testid="mode">{api.mode}</span>
          <span data-testid="step">{api.currentStep}</span>
          <span data-testid="confirmed">{String(api.isConfirmed)}</span>
          <span data-testid="student">{api.activeStudent?.fullName ?? 'none'}</span>
          <span data-testid="fine">{api.pendingReturn?.fineAmount ?? 'none'}</span>
          <span data-testid="overdue-days">{api.pendingReturn?.overdueDays ?? 'none'}</span>
        </div>
      );
    }

    it('runs full checkout flow: student scan -> book preview -> confirm checkout -> reset', async () => {
      let api!: ReturnType<typeof useCirculationWizard>;
      const handle = await renderClient(<WizardHarness onState={(s) => { api = s; }} />);

      expect(api.mode).toBe('checkout');
      expect(api.steps).toEqual(CHECKOUT_STEPS);
      expect(api.currentStep).toBe(1);

      // Invalid student scan stays on step 1
      mockResolveScan.mockResolvedValueOnce({ success: false, error: 'Card not found' });
      let ok = false;
      await act(async () => {
        ok = await api.processScan('BAD-CARD', true);
      });
      expect(ok).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith('Card not found');
      expect(api.currentStep).toBe(1);

      // Valid student scan advances to step 2
      mockResolveScan.mockResolvedValueOnce({
        success: true,
        data: {
          type: 'student',
          data: {
            cardNumber: 'LIB-1001',
            fullName: 'Maria Clara',
            studentId: '2024-0001',
            status: 'ACTIVE',
          },
        },
      });
      await act(async () => {
        ok = await api.processScan('LIB-1001', true);
      });
      expect(ok).toBe(true);
      expect(api.currentStep).toBe(2);
      expect(api.activeStudent?.fullName).toBe('Maria Clara');
      expect(mockToastSuccess).toHaveBeenCalledWith('Student verified. Please scan the book copy.');

      // Book preview failure stays on step 2
      mockCheckoutBook.mockResolvedValueOnce({ success: false, error: 'Copy already borrowed' });
      await act(async () => {
        ok = await api.processScan('BK-COPY-9', true);
      });
      expect(ok).toBe(false);
      expect(api.currentStep).toBe(2);
      expect(mockToastError).toHaveBeenCalledWith('Copy already borrowed');

      // Book preview success advances to step 3
      mockCheckoutBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'Clean Code',
          due_date: '2026-12-01T00:00:00Z',
        },
      });
      await act(async () => {
        ok = await api.processScan('BK-COPY-1', true);
      });
      expect(ok).toBe(true);
      expect(api.currentStep).toBe(3);
      expect(api.pendingCheckout?.bookTitle).toBe('Clean Code');
      expect(api.pendingCheckout?.idempotencyKey).toBeTruthy();

      // Confirm checkout commits with previewOnly: false
      mockCheckoutBook.mockResolvedValueOnce({ success: true, data: {} });
      await act(async () => {
        await api.confirmAction();
      });
      expect(mockCheckoutBook).toHaveBeenLastCalledWith({
        studentCardQr: 'LIB-1001',
        bookQr: 'BK-COPY-1',
        idempotencyKey: expect.any(String),
        previewOnly: false,
        isManual: true,
      });
      expect(api.isConfirmed).toBe(true);
      expect(api.currentStep).toBe(4);
      expect(handle.container.querySelector('[data-testid="confirmed"]')?.textContent).toBe('true');

      // Reset clears wizard back to step 1
      await act(async () => {
        api.handleReset();
      });
      expect(api.currentStep).toBe(1);
      expect(api.activeStudent).toBeNull();
      expect(api.pendingCheckout).toBeNull();
      expect(api.isConfirmed).toBe(false);
    });

    it('runs return flow with overdue fine preview and forwards settleFine false vs true', async () => {
      mockSearchParamsString = 'mode=return';
      let api!: ReturnType<typeof useCirculationWizard>;
      const handle = await renderClient(<WizardHarness onState={(s) => { api = s; }} />);

      expect(api.mode).toBe('return');
      expect(api.steps).toEqual(RETURN_STEPS);
      expect(api.currentStep).toBe(1);

      // Return preview populates fineAmount and overdueDays
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'Design Patterns',
          student_name: 'Juan Dela Cruz',
          due_date: '2026-11-10T00:00:00Z',
          borrowed_at: '2026-11-01T00:00:00Z',
          fine_amount: 25,
          overdue_days: 5,
        },
      });
      await act(async () => {
        await api.processScan('BK-RETURN-1', false);
      });

      expect(api.currentStep).toBe(2);
      expect(api.pendingReturn).toMatchObject({
        bookQr: 'BK-RETURN-1',
        bookTitle: 'Design Patterns',
        studentName: 'Juan Dela Cruz',
        fineAmount: 25,
        overdueDays: 5,
      });
      expect(handle.container.querySelector('[data-testid="fine"]')?.textContent).toBe('25');
      expect(handle.container.querySelector('[data-testid="overdue-days"]')?.textContent).toBe('5');

      // Return Only (settleFine = false)
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: { reservation_ready: false },
      });
      await act(async () => {
        await api.confirmAction(false);
      });
      expect(mockReturnBook).toHaveBeenLastCalledWith({
        bookQr: 'BK-RETURN-1',
        idempotencyKey: expect.any(String),
        previewOnly: false,
        isManual: true,
        settleFine: false,
      });
      expect(api.isConfirmed).toBe(true);

      // Reset and test Return & Settle (settleFine = true) with reservation ready
      await act(async () => {
        api.handleReset();
      });
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: {
          book_title: 'Algorithms',
          student_name: 'Ana Reyes',
          fine_amount: 15,
          overdue_days: 3,
        },
      });
      await act(async () => {
        await api.processScan('BK-RETURN-2', true);
      });
      mockReturnBook.mockResolvedValueOnce({
        success: true,
        data: { reservation_ready: true, reserved_for: 'Pedro Santos' },
      });
      await act(async () => {
        await api.confirmAction(true);
      });
      expect(mockReturnBook).toHaveBeenLastCalledWith({
        bookQr: 'BK-RETURN-2',
        idempotencyKey: expect.any(String),
        previewOnly: false,
        isManual: true,
        settleFine: true,
      });
      expect(api.reservationData).toEqual({ ready: true, studentName: 'Pedro Santos' });
    });

    it('switches mode, ignores stale async scan results after reset, and surfaces thrown errors', async () => {
      let api!: ReturnType<typeof useCirculationWizard>;
      await renderClient(<WizardHarness onState={(s) => { api = s; }} />);

      let resolveDeferred!: (val: unknown) => void;
      mockResolveScan.mockImplementationOnce(
        () => new Promise((res) => { resolveDeferred = res; })
      );

      let scanPromise!: Promise<boolean>;
      act(() => {
        scanPromise = api.processScan('STALE-CARD', true);
      });

      // Switch mode while scan is still in flight
      await act(async () => {
        api.switchMode('return');
      });
      expect(mockRouterReplace).toHaveBeenCalledWith('?mode=return');
      expect(api.mode).toBe('return');

      // Resolve stale checkout scan; should be dropped
      let result = true;
      await act(async () => {
        resolveDeferred({
          success: true,
          data: {
            type: 'student',
            data: { cardNumber: 'STALE', fullName: 'Ghost', studentId: '0', status: 'ACTIVE' },
          },
        });
        result = await scanPromise;
      });
      expect(result).toBe(false);
      expect(api.activeStudent).toBeNull();

      // Thrown error during return scan triggers toast.error
      mockReturnBook.mockRejectedValueOnce(new Error('Network down'));
      await act(async () => {
        result = await api.processScan('ERR-QR', true);
      });
      expect(result).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith('Network down', { id: 'circulation-error-toast' });
    });
  });

  describe('useNotifications', () => {
    function makeNotification(id: string, isRead: boolean, createdAt: string): Notification {
      return {
        id,
        user_id: 'user-1',
        title: `Title ${id}`,
        content: `Body ${id}`,
        type: 'OVERDUE',
        priority: 'high',
        is_read: isRead,
        metadata: {},
        created_at: createdAt,
      };
    }

    function NotificationsHarness({
      onState,
    }: {
      onState: (api: ReturnType<typeof useNotifications>) => void;
    }) {
      const api = useNotifications();
      onState(api);
      return (
        <div>
          <span data-testid="loading">{String(api.loading)}</span>
          <span data-testid="unread">{api.unreadCount}</span>
          <span data-testid="count">{api.notifications.length}</span>
        </div>
      );
    }

    it('loads initial notifications, marks read/all read, searches, loads more, and handles realtime events', async () => {
      const handlers: Record<string, (payload: { new: Notification }) => void> = {};
      const mockChannel = {
        on: vi.fn().mockImplementation(
          (_type: string, filter: { event: string }, cb: (payload: { new: Notification }) => void) => {
            handlers[filter.event] = cb;
            return mockChannel;
          }
        ),
        subscribe: vi.fn().mockReturnThis(),
      };
      const mockRemoveChannel = vi.fn();

      // Create 50 notifications so hasMore = true and olderUnread = 2 (total unread 3 - 1 loaded unread)
      const initialList: Notification[] = Array.from({ length: 50 }, (_, i) =>
        makeNotification(`n-${i + 1}`, i !== 0, `2026-11-${String(30 - (i % 28)).padStart(2, '0')}T10:00:00Z`)
      );
      const olderPage: Notification[] = [
        makeNotification('n-51', false, '2026-10-01T10:00:00Z'),
      ];

      const updateBuilder = {
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (val: { error: null }) => void) => Promise.resolve({ error: null }).then(resolve),
      };

      const selectBuilder = {
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn(),
        then: undefined as unknown,
      };

      // Track calls to notifications.select(...)
      let selectCall = 0;
      const fromMock = vi.fn().mockImplementation(() => ({
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          selectCall += 1;
          if (opts?.head) {
            const countBuilder = {
              eq: vi.fn().mockReturnThis(),
              then: (resolve: (v: { count: number; error: null }) => void) =>
                Promise.resolve({ count: 3, error: null }).then(resolve),
            };
            return countBuilder;
          }
          const currentCall = selectCall;
          return {
            ...selectBuilder,
            limit: vi.fn().mockImplementation(() => {
              if (currentCall === 1) return Promise.resolve({ data: initialList, error: null });
              if (currentCall === 3) return Promise.resolve({ data: olderPage, error: null });
              return Promise.resolve({ data: [makeNotification('n-search', false, '2026-11-01T00:00:00Z')], error: null });
            }),
          };
        },
        update: vi.fn().mockImplementation(() => updateBuilder),
      }));

      mockCreateClient.mockReturnValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }),
        },
        from: fromMock,
        channel: vi.fn().mockReturnValue(mockChannel),
        removeChannel: mockRemoveChannel,
      });

      let api!: ReturnType<typeof useNotifications>;
      const handle = await renderClient(<NotificationsHarness onState={(s) => { api = s; }} />);

      expect(api.loading).toBe(false);
      expect(api.notifications).toHaveLength(50);
      expect(api.hasMore).toBe(true);
      expect(api.olderUnread).toBe(2);
      expect(api.unreadCount).toBe(3);

      // Realtime INSERT prepends notification and shows toast
      const realtimeNew = makeNotification('n-rt-1', false, '2026-11-30T12:00:00Z');
      await act(async () => {
        handlers.INSERT({ new: realtimeNew });
      });
      expect(api.notifications[0].id).toBe('n-rt-1');
      expect(api.unreadCount).toBe(4);
      expect(mockToastInfo).toHaveBeenCalledWith('Title n-rt-1', {
        id: 'notification-n-rt-1',
        description: 'Body n-rt-1',
      });

      // Realtime UPDATE updates existing item
      await act(async () => {
        handlers.UPDATE({ new: { ...realtimeNew, is_read: true } });
      });
      expect(api.notifications[0].is_read).toBe(true);
      expect(api.unreadCount).toBe(3);

      // loadMore fetches older page and reduces olderUnread
      await act(async () => {
        await api.loadMore();
      });
      expect(api.notifications).toHaveLength(52);
      expect(api.olderUnread).toBe(1);
      expect(api.hasMore).toBe(false);

      // searchNotifications strips PostgREST special characters
      let searchResults: Notification[] | null = null;
      await act(async () => {
        searchResults = await api.searchNotifications('overdue,(test)*');
      });
      expect(searchResults).toHaveLength(1);

      // markAsRead on an unloaded id decrements olderUnread
      await act(async () => {
        await api.markAsRead('unloaded-id');
      });
      expect(api.olderUnread).toBe(0);

      // markAllAsRead clears all remaining unread items
      await act(async () => {
        await api.markAllAsRead();
      });
      expect(api.unreadCount).toBe(0);

      handle.unmount();
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('useLogout', () => {
    function LogoutHarness({
      onState,
    }: {
      onState: (api: ReturnType<typeof useLogout>) => void;
    }) {
      const api = useLogout();
      onState(api);
      return <span data-testid="logging-out">{String(api.isLoggingOut)}</span>;
    }

    it('signs out via Supabase, sets isLoggingOut, and redirects to /', async () => {
      vi.useFakeTimers();
      const signOutMock = vi.fn().mockResolvedValue({ error: null });
      mockCreateClient.mockReturnValue({
        auth: { signOut: signOutMock },
      });

      const originalLocation = window.location;
      const locationMock = { ...originalLocation, href: '/dashboard' };
      Object.defineProperty(window, 'location', {
        value: locationMock,
        writable: true,
        configurable: true,
      });

      let api!: ReturnType<typeof useLogout>;
      const handle = await renderClient(<LogoutHarness onState={(s) => { api = s; }} />);
      expect(api.isLoggingOut).toBe(false);

      let logoutPromise!: Promise<void>;
      await act(async () => {
        logoutPromise = api.logout();
      });
      expect(handle.container.querySelector('[data-testid="logging-out"]')?.textContent).toBe('true');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await logoutPromise;
      });

      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(locationMock.href).toBe('/');

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('useIsMobile', () => {
    function MobileHarness() {
      const isMobile = useIsMobile();
      return <span data-testid="mobile">{String(isMobile)}</span>;
    }

    it('tracks viewport width and responds to matchMedia change events', async () => {
      let changeListener: (() => void) | null = null;
      const removeEventListenerMock = vi.fn();
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: true,
          media: query,
          addEventListener: (_evt: string, cb: () => void) => { changeListener = cb; },
          removeEventListener: removeEventListenerMock,
        })),
      });

      const handle = await renderClient(<MobileHarness />);
      expect(handle.container.querySelector('[data-testid="mobile"]')?.textContent).toBe('true');

      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
      await act(async () => {
        changeListener?.();
      });
      expect(handle.container.querySelector('[data-testid="mobile"]')?.textContent).toBe('false');

      handle.unmount();
      expect(removeEventListenerMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('useScanFeedback', () => {
    function FeedbackHarness({
      onReady,
    }: {
      onReady: (play: ReturnType<typeof useScanFeedback>['playScanCue']) => void;
    }) {
      const { playScanCue } = useScanFeedback();
      onReady(playScanCue);
      return <div />;
    }

    it('triggers distinct haptic vibrations and Web Audio tones for success and error', async () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        writable: true,
        configurable: true,
      });

      const freqSet = vi.fn();
      const startMock = vi.fn();
      const stopMock = vi.fn();
      const closeMock = vi.fn().mockResolvedValue(undefined);
      class MockAudioContext {
        currentTime = 1;
        destination = {};
        createOscillator() {
          return {
            type: 'sine',
            frequency: { setValueAtTime: freqSet },
            connect: vi.fn(),
            start: startMock,
            stop: stopMock,
          };
        }
        createGain() {
          return {
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
          };
        }
        close = closeMock;
      }

      const originalAudioCtx = (window as unknown as { AudioContext?: unknown }).AudioContext;
      (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;

      let play!: ReturnType<typeof useScanFeedback>['playScanCue'];
      await renderClient(<FeedbackHarness onReady={(fn) => { play = fn; }} />);

      play('success');
      expect(vibrateMock).toHaveBeenCalledWith([10, 50, 10]);
      expect(freqSet).toHaveBeenCalledWith(880, 1);

      play('error');
      expect(vibrateMock).toHaveBeenCalledWith(200);
      expect(freqSet).toHaveBeenCalledWith(220, 1);
      expect(startMock).toHaveBeenCalledTimes(2);
      expect(stopMock).toHaveBeenCalledTimes(2);
      expect(closeMock).toHaveBeenCalledTimes(2);

      (window as unknown as { AudioContext?: unknown }).AudioContext = originalAudioCtx;
    });
  });

  describe('useScanner', () => {
    function ScannerHarness({
      onScan,
      isProcessing = false,
      onApi,
    }: {
      onScan: (val: string) => Promise<void>;
      isProcessing?: boolean;
      onApi: (api: ReturnType<typeof useScanner>) => void;
    }) {
      const api = useScanner({ onScan, isProcessing, scannerId: 'test-scanner' });
      onApi(api);
      return <div id={api.scannerId} data-open={String(api.cameraOpen)} />;
    }

    it('starts camera, enumerates multiple cameras, deduplicates repeated scans, switches, and stops', async () => {
      const onScan = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: {
          enumerateDevices: vi.fn().mockResolvedValue([
            { kind: 'videoinput', deviceId: 'cam-1' },
            { kind: 'videoinput', deviceId: 'cam-2' },
          ]),
        },
      });
      mockQrStart.mockResolvedValue(undefined);
      mockQrStop.mockResolvedValue(undefined);
      mockQrGetRunningTrackSettings.mockReturnValue({ deviceId: 'cam-1' });

      let api!: ReturnType<typeof useScanner>;
      await renderClient(<ScannerHarness onScan={onScan} onApi={(a) => { api = a; }} />);

      expect(api.scannerId.startsWith('test-scanner-')).toBe(true);
      await act(async () => {
        await api.startScanner();
      });

      expect(api.cameraOpen).toBe(true);
      expect(api.hasMultipleCameras).toBe(true);

      // Scan value invokes onScan once, immediate duplicate within 3s is suppressed
      await act(async () => {
        await capturedQrSuccessCallback?.('QR-123');
        await capturedQrSuccessCallback?.('QR-123');
      });
      expect(onScan).toHaveBeenCalledTimes(1);
      expect(onScan).toHaveBeenCalledWith('QR-123');

      // Switch camera picks cam-2
      await act(async () => {
        api.switchCamera();
        await Promise.resolve();
      });
      expect(mockQrStart).toHaveBeenLastCalledWith('cam-2', expect.any(Object));

      // Stop camera closes stream
      await act(async () => {
        await api.stopCamera();
      });
      expect(api.cameraOpen).toBe(false);
      expect(mockQrIsScanning).toBe(false);
      expect(mockQrClear).toHaveBeenCalled();
    });

    it('maps camera permission denied errors to user-friendly message', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: { enumerateDevices: vi.fn().mockResolvedValue([]) },
      });
      mockQrStart.mockRejectedValueOnce(new Error('NotAllowedError: Permission denied'));

      let api!: ReturnType<typeof useScanner>;
      await renderClient(<ScannerHarness onScan={vi.fn()} onApi={(a) => { api = a; }} />);

      await act(async () => {
        await api.startScanner();
      });
      expect(api.cameraOpen).toBe(false);
      expect(api.cameraIssue).toBe(
        'Camera access is blocked. Allow camera access or enter the code manually.'
      );
    });
  });

  describe('useSearchParamsLite', () => {
    function SearchParamsHarness() {
      const params = useSearchParamsLite();
      return (
        <div>
          <span data-testid="status">{params.get('status') ?? 'none'}</span>
          <span data-testid="q">{params.get('q') ?? 'none'}</span>
        </div>
      );
    }

    it('returns a reactive URLSearchParams instance reflecting search param updates', async () => {
      mockSearchParamsString = 'status=OVERDUE&q=design';
      const handle = await renderClient(<SearchParamsHarness />);

      expect(handle.container.querySelector('[data-testid="status"]')?.textContent).toBe('OVERDUE');
      expect(handle.container.querySelector('[data-testid="q"]')?.textContent).toBe('design');

      mockSearchParamsString = 'status=SETTLED';
      await handle.rerender(<SearchParamsHarness />);
      expect(handle.container.querySelector('[data-testid="status"]')?.textContent).toBe('SETTLED');
      expect(handle.container.querySelector('[data-testid="q"]')?.textContent).toBe('none');
    });
  });
});
