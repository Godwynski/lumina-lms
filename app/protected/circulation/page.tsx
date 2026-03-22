'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Camera,
  ChevronDown,
  Circle,
  CheckCircle2,
  QrCode,
  RefreshCcw,
  ScanLine,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FlowMode = 'checkout' | 'return';

type ScanResolveResponse =
  | {
      ok: true;
      type: 'student';
      data: {
        cardNumber: string;
        status: string;
        userId: string;
        fullName: string;
        studentId: string;
      };
    }
  | {
      ok: true;
      type: 'book';
      data: {
        copyId: string;
        qrString: string;
        status: string;
        bookId: string;
        bookTitle: string;
      };
    }
  | {
      ok: false;
      code?: string;
      message: string;
    };

type CheckoutPreviewResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  student_name?: string;
  student_id?: string;
  book_title?: string;
  due_date?: string;
  card_number?: string;
  book_qr?: string;
};

type CheckoutCommitResponse = CheckoutPreviewResponse & {
  borrowing_id?: string;
  idempotent?: boolean;
};

type ReturnPreviewResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  borrowing_id?: string;
  student_name?: string;
  book_title?: string;
  due_date?: string;
  borrowed_at?: string;
  book_qr?: string;
};

type ReturnCommitResponse = ReturnPreviewResponse & {
  returned_at?: string;
  idempotent?: boolean;
};

type ActiveStudent = {
  cardNumber: string;
  fullName: string;
  studentId: string;
  status: string;
};

type CheckoutDraft = {
  bookQr: string;
  bookTitle: string;
  dueDate: string;
  idempotencyKey: string;
};

type PendingReturn = {
  bookQr: string;
  bookTitle: string;
  studentName: string;
  dueDate?: string;
  borrowedAt?: string;
  idempotencyKey: string;
};

type Notice = {
  tone: 'ok' | 'warn' | 'error';
  text: string;
};

type BarcodeLike = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeLike[]>;
};

type WindowWithDetector = Window & {
  BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
};

const SCAN_DEBOUNCE_MS = 1500;

function getCameraIssueMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Unknown camera error.';

  if (error.name === 'NotAllowedError') return 'Camera permission was denied in browser settings.';
  if (error.name === 'NotFoundError') return 'No camera device was detected.';
  if (error.name === 'NotReadableError') return 'Camera is busy in another app or browser tab.';
  if (error.name === 'OverconstrainedError') return 'Requested camera constraints are not supported.';
  if (error.name === 'SecurityError') return 'Camera access requires HTTPS or localhost.';
  if (error.name === 'AbortError') return 'Camera startup was interrupted.';

  return error.message || 'Unable to initialize camera.';
}

export default function CirculationPage() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'return' ? 'return' : 'checkout';

  const [mode, setMode] = useState<FlowMode>(initialMode);
  const [manualValue, setManualValue] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraPermissionAvailable, setCameraPermissionAvailable] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [cameraIssue, setCameraIssue] = useState<string | null>(null);
  const [showScannerHelp, setShowScannerHelp] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [activeStudent, setActiveStudent] = useState<ActiveStudent | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutDraft | null>(null);
  const [pendingReturn, setPendingReturn] = useState<PendingReturn | null>(null);
  const [studentScanFlash, setStudentScanFlash] = useState(false);

  const [contextLockOpen, setContextLockOpen] = useState(false);
  const [blockedStudent, setBlockedStudent] = useState<{ fullName: string; studentId: string } | null>(null);
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; body: string }>({
    open: false,
    title: '',
    body: '',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastAcceptedScanRef = useRef<{ value: string; at: number } | null>(null);

  const focusManualInput = useCallback(() => {
    manualInputRef.current?.focus();
  }, []);

  const playScanCue = useCallback((type: 'success' | 'error') => {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 220, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      oscillator.start(now);
      oscillator.stop(now + 0.16);
      void ctx.close();
    } catch {
      // Ignore audio context failures.
    }
  }, []);

  const dueDateLabel = useMemo(() => {
    if (!pendingCheckout?.dueDate) return '';
    return new Date(pendingCheckout.dueDate).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [pendingCheckout?.dueDate]);

  const returnDueDateLabel = useMemo(() => {
    if (!pendingReturn?.dueDate) return 'N/A';
    return new Date(pendingReturn.dueDate).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [pendingReturn?.dueDate]);

  const borrowedAtLabel = useMemo(() => {
    if (!pendingReturn?.borrowedAt) return 'N/A';
    return new Date(pendingReturn.borrowedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [pendingReturn?.borrowedAt]);

  const activeStudentKey = activeStudent?.cardNumber;

  useEffect(() => {
    if (!activeStudentKey) return;
    setStudentScanFlash(true);
    const timer = window.setTimeout(() => setStudentScanFlash(false), 1400);
    return () => window.clearTimeout(timer);
  }, [activeStudentKey]);

  const stopCamera = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const clearAll = useCallback((nextMode: FlowMode = mode) => {
    setActiveStudent(null);
    setPendingCheckout(null);
    setPendingReturn(null);
    setBlockedStudent(null);
    setContextLockOpen(false);
    setManualValue('');
    setNotice({
      tone: 'ok',
      text:
        nextMode === 'checkout'
          ? 'Checkout context cleared. Start by scanning a student card.'
          : 'Return context cleared. Scan a book copy QR to continue.',
    });
    lastAcceptedScanRef.current = null;
    window.setTimeout(focusManualInput, 0);
  }, [focusManualInput, mode]);

  const setFlowMode = (nextMode: FlowMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    clearAll(nextMode);
  };

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setNotice({ tone: 'error', text: 'Camera API is unavailable in this browser.' });
      return false;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      media.getTracks().forEach((track) => track.stop());
      setCameraPermission('granted');
      setCameraIssue(null);
      setNotice({ tone: 'ok', text: 'Camera permission granted. You can start scanner now.' });
      return true;
    } catch (error) {
      setCameraPermission('denied');
      setCameraIssue(getCameraIssueMessage(error));
      setNotice({ tone: 'error', text: 'Camera permission denied. Check troubleshooting details.' });
      return false;
    }
  }, []);

  const handleCameraToggle = useCallback(async () => {
    if (cameraOpen) {
      stopCamera();
      return;
    }

    if (!cameraSupported) {
      setNotice({ tone: 'warn', text: 'Camera scanner is unavailable on this browser/device.' });
      return;
    }

    const granted = cameraPermission === 'granted' ? true : await requestCameraPermission();
    if (!granted) return;
    setCameraOpen(true);
  }, [cameraOpen, cameraPermission, cameraSupported, requestCameraPermission, stopCamera]);

  const resolveScan = useCallback(async (scanValue: string): Promise<ScanResolveResponse | null> => {
    const response = await fetch('/api/circulation/resolve-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanValue, expectedType: 'auto' }),
    });

    const payload = (await response.json()) as ScanResolveResponse;
    if (!response.ok && !payload.ok) {
      return payload;
    }
    return payload;
  }, []);

  const startPreviewCheckout = useCallback(async (studentCardQr: string, bookQr: string) => {
    const response = await fetch('/api/circulation/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentCardQr,
        bookQr,
        previewOnly: true,
      }),
    });

    const payload = (await response.json()) as CheckoutPreviewResponse;
    if (!response.ok || !payload.ok) {
      setErrorModal({
        open: true,
        title: 'Checkout blocked',
        body: payload.message ?? 'The checkout request failed validation.',
      });
      return;
    }

    setPendingCheckout({
      bookQr,
      bookTitle: payload.book_title ?? 'Unknown title',
      dueDate: payload.due_date ?? new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
    });
  }, []);

  const handleResolvedCheckoutPayload = useCallback(async (payload: ScanResolveResponse) => {
    if (!payload.ok) {
      setNotice({ tone: 'error', text: payload.message });
      return false;
    }

    if (!activeStudent) {
      if (payload.type === 'book') {
        setNotice({ tone: 'warn', text: 'Scan the student library card first, then scan book copies.' });
        return false;
      }

      if (payload.data.status !== 'active') {
        setErrorModal({
          open: true,
          title: 'Card inactive',
          body: 'This student card is not active. Only active cards can check out books.',
        });
        return false;
      }

      setActiveStudent({
        cardNumber: payload.data.cardNumber,
        fullName: payload.data.fullName,
        studentId: payload.data.studentId,
        status: payload.data.status,
      });
      setNotice({ tone: 'ok', text: 'Student locked. Continue by scanning one book copy QR.' });
      return true;
    }

    if (payload.type === 'student') {
      if (payload.data.cardNumber === activeStudent.cardNumber) {
        setNotice({ tone: 'warn', text: 'This student card is already active in the current checkout flow.' });
        return false;
      }

      setBlockedStudent({ fullName: payload.data.fullName, studentId: payload.data.studentId });
      setContextLockOpen(true);
      return false;
    }

    await startPreviewCheckout(activeStudent.cardNumber, payload.data.qrString);
    return true;
  }, [activeStudent, startPreviewCheckout]);

  const startPreviewReturn = useCallback(async (rawQr: string) => {
    const bookQr = rawQr.trim();
    if (!bookQr || isConfirming) return false;

    const response = await fetch('/api/circulation/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookQr,
        previewOnly: true,
      }),
    });

    const payload = (await response.json()) as ReturnPreviewResponse;
    if (!response.ok || !payload.ok) {
      setErrorModal({
        open: true,
        title: 'Return blocked',
        body: payload.message ?? 'Unable to prepare return confirmation.',
      });
      return false;
    }

    setPendingReturn({
      bookQr,
      bookTitle: payload.book_title ?? 'Unknown title',
      studentName: payload.student_name ?? 'Student',
      dueDate: payload.due_date,
      borrowedAt: payload.borrowed_at,
      idempotencyKey: crypto.randomUUID(),
    });
    return true;
  }, [isConfirming]);

  const processScan = useCallback(async (rawValue: string) => {
    const scanValue = rawValue.trim();
    if (!scanValue || isResolving || isConfirming) return;

    const now = Date.now();
    const last = lastAcceptedScanRef.current;
    if (last && last.value === scanValue && now - last.at < SCAN_DEBOUNCE_MS) {
      setNotice({ tone: 'warn', text: 'Duplicate scan ignored. Wait 1.5 seconds before scanning again.' });
      playScanCue('error');
      return;
    }

    lastAcceptedScanRef.current = { value: scanValue, at: now };
    setIsResolving(true);

    try {
      if (mode === 'checkout') {
        const payload = await resolveScan(scanValue);
        if (!payload) {
          setNotice({ tone: 'error', text: 'Failed to decode QR scan response.' });
          playScanCue('error');
          return;
        }
        const ok = await handleResolvedCheckoutPayload(payload);
        playScanCue(ok ? 'success' : 'error');
      } else {
        const ok = await startPreviewReturn(scanValue);
        playScanCue(ok ? 'success' : 'error');
      }
      setManualValue('');
    } catch {
      setNotice({ tone: 'error', text: 'Unable to process the scanned QR value right now.' });
      playScanCue('error');
    } finally {
      setIsResolving(false);
      focusManualInput();
    }
  }, [focusManualInput, handleResolvedCheckoutPayload, isConfirming, isResolving, mode, playScanCue, resolveScan, startPreviewReturn]);

  const confirmCheckout = async () => {
    if (!activeStudent || !pendingCheckout) return;

    setIsConfirming(true);
    try {
      const response = await fetch('/api/circulation/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentCardQr: activeStudent.cardNumber,
          bookQr: pendingCheckout.bookQr,
          idempotencyKey: pendingCheckout.idempotencyKey,
          previewOnly: false,
        }),
      });

      const payload = (await response.json()) as CheckoutCommitResponse;

      if (response.status === 409) {
        setPendingCheckout(null);
        setErrorModal({
          open: true,
          title: 'Book already checked out',
          body:
            payload.message ??
            'This book copy was just checked out by another session. Please scan a different copy.',
        });
        return;
      }

      if (!response.ok || !payload.ok) {
        setErrorModal({
          open: true,
          title: 'Checkout failed',
          body: payload.message ?? 'Unable to finalize checkout.',
        });
        return;
      }

      setNotice({
        tone: 'ok',
        text: payload.idempotent
          ? 'Checkout already finalized from a previous confirm attempt.'
          : 'Checkout confirmed successfully.',
      });
      setPendingCheckout(null);
    } catch {
      setErrorModal({
        open: true,
        title: 'Network issue',
        body: 'Checkout request failed due to a connection issue. You can safely press Confirm again.',
      });
    } finally {
      setIsConfirming(false);
      focusManualInput();
    }
  };

  const confirmReturn = async () => {
    if (!pendingReturn) return;

    setIsConfirming(true);
    try {
      const response = await fetch('/api/circulation/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookQr: pendingReturn.bookQr,
          idempotencyKey: pendingReturn.idempotencyKey,
          previewOnly: false,
        }),
      });

      const payload = (await response.json()) as ReturnCommitResponse;

      if (response.status === 409) {
        setErrorModal({
          open: true,
          title: 'Return conflict',
          body: payload.message ?? 'This copy is being processed in another session.',
        });
        return;
      }

      if (!response.ok || !payload.ok) {
        setErrorModal({
          open: true,
          title: 'Return failed',
          body: payload.message ?? 'Unable to complete this return.',
        });
        return;
      }

      setNotice({
        tone: 'ok',
        text: payload.idempotent
          ? 'Return already finalized from a previous confirm attempt.'
          : 'Book return confirmed successfully.',
      });
      setPendingReturn(null);
    } catch {
      setErrorModal({
        open: true,
        title: 'Network issue',
        body: 'Return request failed due to a connection issue. You can safely press Confirm again.',
      });
    } finally {
      setIsConfirming(false);
      focusManualInput();
    }
  };

  useEffect(() => {
    focusManualInput();
  }, [focusManualInput, mode]);

  useEffect(() => {
    const detectorCtor = (window as WindowWithDetector).BarcodeDetector;
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasGetUserMedia = typeof navigator.mediaDevices?.getUserMedia === 'function';

    setCameraPermissionAvailable(hasMediaDevices && hasGetUserMedia);

    let reason: string | null = null;
    if (!window.isSecureContext) {
      reason = 'Camera only works on HTTPS or localhost.';
    } else if (!hasMediaDevices) {
      reason = 'This browser does not expose mediaDevices.';
    } else if (!hasGetUserMedia) {
      reason = 'This browser does not support getUserMedia.';
    } else if (!detectorCtor) {
      reason = 'QR scanner API (BarcodeDetector) is unavailable in this browser.';
    }

    setCameraSupported(!reason);
    setCameraIssue(reason);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !cameraSupported) return;

    let mounted = true;
    const detectorCtor = (window as WindowWithDetector).BarcodeDetector;
    if (detectorCtor) {
      detectorRef.current = new detectorCtor({ formats: ['qr_code'] });
    }

    const start = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        });

        if (!mounted) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = media;
        setCameraPermission('granted');
        setCameraIssue(null);
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
        }

        const tick = async () => {
          if (!mounted || !videoRef.current || !detectorRef.current) return;

          try {
            if (videoRef.current.readyState >= 2) {
              const codes = await detectorRef.current.detect(videoRef.current);
              const first = codes.find((code) => !!code.rawValue?.trim());
              if (first?.rawValue) {
                await processScan(first.rawValue);
              }
            }
          } catch {
            // Keep scanning loop alive.
          }

          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (error) {
        setCameraPermission('denied');
        setCameraIssue(getCameraIssueMessage(error));
        setNotice({ tone: 'error', text: 'Camera access denied or unavailable. You can still use manual input.' });
        stopCamera();
      }
    };

    void start();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [cameraOpen, cameraSupported, processScan, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const noticeClasses =
    notice?.tone === 'ok'
      ? 'status-success'
      : notice?.tone === 'warn'
        ? 'status-warning'
        : 'status-danger';

  const checkoutStep = !activeStudent ? 1 : pendingCheckout ? 3 : 2;
  const returnStep = pendingReturn ? (isConfirming ? 3 : 2) : 1;
  const scannerStatus = !cameraSupported
    ? { label: 'Camera unavailable', dot: 'status-dot-warning', tone: 'status-warning' }
    : cameraOpen
    ? { label: 'Scanner live', dot: 'status-dot-success animate-pulse', tone: 'status-success' }
    : cameraPermission === 'denied'
    ? { label: 'Permission denied', dot: 'status-dot-danger', tone: 'status-danger' }
    : cameraPermission === 'granted'
    ? { label: 'Camera ready', dot: 'status-dot-success', tone: 'status-success' }
    : { label: 'Permission needed', dot: 'status-dot-warning', tone: 'text-muted-foreground' };
  const nextActionLabel =
    mode === 'checkout'
      ? checkoutStep === 1
        ? 'Scan student card'
        : checkoutStep === 2
          ? 'Scan book QR'
          : 'Confirm checkout'
      : returnStep === 1
        ? 'Scan book QR'
        : returnStep === 2
          ? 'Review details'
          : 'Confirm return';
  const actionCtaLabel =
    mode === 'checkout'
      ? checkoutStep === 1
        ? 'Process student card'
        : checkoutStep === 2
          ? 'Process book QR'
          : 'Ready to confirm checkout'
      : returnStep === 1
        ? 'Process book QR'
        : returnStep === 2
          ? 'Ready to confirm return'
          : 'Finalizing return';
  return (
    <div className="w-full space-y-2 pb-4 md:space-y-2.5 md:pb-5">
      <div className="border-b border-border pb-4">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Circulation Desk</h1>
            <p className="text-sm text-muted-foreground">Process checkout and return workflows with scanner or manual input.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted p-1">
              <Button
                type="button"
                variant={mode === 'checkout' ? 'default' : 'ghost'}
                className="h-8 rounded-md px-3"
                onClick={() => setFlowMode('checkout')}
              >
                Checkout
              </Button>
              <Button
                type="button"
                variant={mode === 'return' ? 'default' : 'ghost'}
                className="h-8 rounded-md px-3"
                onClick={() => setFlowMode('return')}
              >
                Return
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => clearAll()}
              className="h-8 rounded-md border-border px-3"
            >
              <RefreshCcw className="mr-2 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <section className="grid gap-2 lg:grid-cols-12">
        <div className="lg:col-span-9">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm md:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <ScanLine className="h-4 w-4 text-muted-foreground" />
                Scanner
              </h2>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-[11px]">
                <span className={`h-2 w-2 rounded-full ${scannerStatus.dot}`} />
                <span className={`font-medium ${scannerStatus.tone}`}>{scannerStatus.label}</span>
              </div>
            </div>

            {cameraIssue && (
              <Collapsible open={showScannerHelp} onOpenChange={setShowScannerHelp} className="mb-2">
                <div className="status-warning rounded-md px-2 py-1.5">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="h-6 w-full justify-between px-1 text-[11px]">
                      <span className="font-semibold">Scanner help</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showScannerHelp ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-1 pb-1 text-[11px]">
                      <p>{cameraIssue}</p>
                      <p className="mt-1">Try allowing camera permission, closing apps using camera, or switching to Chrome/Edge.</p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-8 rounded-md"
                onClick={() => void requestCameraPermission()}
                disabled={!cameraPermissionAvailable}
              >
                {cameraPermission === 'granted' ? 'Camera Enabled' : 'Enable Camera Permission'}
              </Button>
              {!cameraPermissionAvailable && (
                <span className="text-[11px] text-muted-foreground">Permission prompt not supported in this context.</span>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="relative overflow-hidden rounded-xl border border-border bg-primary">
                <video ref={videoRef} className="h-[250px] w-full object-cover md:h-[320px]" muted playsInline />
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-2xl border border-border/25" />
                <div className="absolute right-3 bottom-3">
                  <Button
                    variant={cameraOpen ? 'destructive' : 'secondary'}
                    size="sm"
                    className="h-8 rounded-md px-3 text-xs"
                    onClick={() => void handleCameraToggle()}
                    disabled={!cameraSupported}
                  >
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                    {cameraOpen ? 'Stop camera' : 'Start camera'}
                  </Button>
                </div>
                {!cameraOpen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/80 text-primary-foreground">
                    <div className="text-center">
                      <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-semibold">Camera scanner is idle</p>
                      <p className="mt-1 text-xs text-muted-foreground">Use manual input if camera is unavailable</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Manual input</p>
                  <p className="text-[11px] text-muted-foreground">{nextActionLabel}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    ref={manualInputRef}
                    value={manualValue}
                    onChange={(event) => setManualValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void processScan(manualValue);
                      }
                    }}
                    placeholder={
                      mode === 'checkout'
                        ? 'Scan student card first, then book QR'
                        : 'Paste or type book QR payload'
                    }
                    autoFocus
                    className="h-8 flex-1 rounded-md border border-border bg-card px-2.5 text-xs outline-none ring-ring transition focus:ring-2"
                  />
                  <Button
                    variant="outline"
                    className="h-8 rounded-md px-3 text-xs"
                    onClick={() => void processScan(manualValue)}
                    disabled={isResolving || isConfirming || actionCtaLabel.includes('Ready')}
                  >
                      {isResolving ? 'Processing...' : actionCtaLabel}
                  </Button>
                </div>
              </div>

              {notice && <div className={`rounded-lg border px-3 py-2 text-sm ${noticeClasses}`}>{notice.text}</div>}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm md:p-4">
            <h2 className="mb-3 text-base font-semibold text-foreground">Workflow guide</h2>
            {mode === 'checkout' ? (
              <div className="space-y-3">
                <div className="space-y-1.5 text-xs">
                  {[
                    { step: 1, label: 'Student card' },
                    { step: 2, label: 'Book QR' },
                    { step: 3, label: 'Confirm' },
                  ].map((item, index, arr) => {
                    const active = checkoutStep === item.step;
                    const done = checkoutStep > item.step;
                    return (
                      <div key={item.step} className="flex items-start gap-2">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? 'status-success' : active ? 'border-primary/40 bg-primary/10 text-primary animate-pulse' : 'border-border bg-muted text-muted-foreground'}`}>
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <ScanLine className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          </span>
                          {index < arr.length - 1 && <span className="my-0.5 h-4 w-px bg-border" />}
                        </div>
                        <p className={`pt-0.5 ${active || done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{item.label}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  {checkoutStep === 1
                    ? 'Start by scanning a student card.'
                    : checkoutStep === 2
                      ? 'Student locked. Scan one book copy QR next.'
                      : 'Preview ready. Confirm checkout in the dialog.'}
                </p>
                {!activeStudent ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
                    Waiting for student card scan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`rounded-lg border p-3 text-foreground transition-colors ${studentScanFlash ? 'status-success' : 'border-border bg-muted'}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active student</p>
                      <p className="mt-1 text-base font-bold">{activeStudent.fullName}</p>
                      <p className="text-xs text-muted-foreground">Card: {activeStudent.cardNumber}</p>
                    </div>
                    <div className="status-warning rounded-lg p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Identity verification
                      </p>
                      <p className="mt-1 text-sm">Ask the student to verbally confirm this ID:</p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{activeStudent.studentId}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5 text-xs">
                  {[
                    { step: 1, label: 'Book QR' },
                    { step: 2, label: 'Review' },
                    { step: 3, label: 'Confirm' },
                  ].map((item, index, arr) => {
                    const active = returnStep === item.step;
                    const done = returnStep > item.step;
                    return (
                      <div key={item.step} className="flex items-start gap-2">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? 'status-success' : active ? 'border-primary/40 bg-primary/10 text-primary animate-pulse' : 'border-border bg-muted text-muted-foreground'}`}>
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <ScanLine className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          </span>
                          {index < arr.length - 1 && <span className="my-0.5 h-4 w-px bg-border" />}
                        </div>
                        <p className={`pt-0.5 ${active || done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{item.label}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  {returnStep === 1
                    ? 'Scan a book copy QR to start return validation.'
                    : 'Review borrower and due date, then confirm return in the dialog.'}
                </p>
                {pendingReturn ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted p-3 text-sm">
                    <div className="status-success flex items-center gap-2 rounded-md px-2 py-1">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.1em]">Validated</span>
                    </div>
                    <p className="font-semibold text-foreground">{pendingReturn.bookTitle}</p>
                    <p className="text-xs text-muted-foreground">Borrower: {pendingReturn.studentName}</p>
                    <p className="text-xs text-muted-foreground">Due: {returnDueDateLabel}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
                    Waiting for book QR scan.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={!!pendingCheckout} onOpenChange={(open) => (!open ? setPendingCheckout(null) : null)}>
        <DialogContent className="rounded-2xl border-border sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Checkout Confirmation</DialogTitle>
            <DialogDescription>Review details before finalizing this checkout.</DialogDescription>
          </DialogHeader>

          <div className="status-warning rounded-lg px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Primary Focus</p>
            <p className="mt-0.5 text-sm font-semibold">Confirm borrower identity, then finalize checkout.</p>
            <p className="text-xs">Risk check: student verbally confirms ID before you press Confirm.</p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Student</span>
              <span className="font-semibold text-foreground">{activeStudent?.fullName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Student ID</span>
              <span className="font-mono font-semibold text-foreground">{activeStudent?.studentId}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Book</span>
              <span className="text-right font-semibold text-foreground">{pendingCheckout?.bookTitle}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Due Date</span>
              <span className="font-semibold text-foreground">{dueDateLabel}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setPendingCheckout(null)}>
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={isConfirming} onClick={() => void confirmCheckout()}>
              {isConfirming ? 'Finalizing...' : 'Confirm Checkout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingReturn} onOpenChange={(open) => (!open ? setPendingReturn(null) : null)}>
        <DialogContent className="rounded-2xl border-border sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Return Confirmation</DialogTitle>
            <DialogDescription>Review details before finalizing this return.</DialogDescription>
          </DialogHeader>

          <div className="status-success rounded-lg px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Primary Focus</p>
            <p className="mt-0.5 text-sm font-semibold">Verify loan details, then finalize return.</p>
            <p className="text-xs">Risk check: confirm title and borrower before you press Confirm.</p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Student</span>
              <span className="font-semibold text-foreground">{pendingReturn?.studentName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Book</span>
              <span className="text-right font-semibold text-foreground">{pendingReturn?.bookTitle}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Borrowed</span>
              <span className="font-semibold text-foreground">{borrowedAtLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Due Date</span>
              <span className="font-semibold text-foreground">{returnDueDateLabel}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setPendingReturn(null)}>
              Cancel
            </Button>
            <Button className="rounded-xl bg-primary hover:bg-primary/90" disabled={isConfirming} onClick={() => void confirmReturn()}>
              {isConfirming ? 'Finalizing...' : 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contextLockOpen} onOpenChange={setContextLockOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Checkout context is locked</DialogTitle>
            <DialogDescription>
              Another student card was scanned while a checkout is already in progress.
            </DialogDescription>
          </DialogHeader>
          <div className="status-warning rounded-xl p-3 text-sm">
            <p>
              Detected: <span className="font-semibold">{blockedStudent?.fullName ?? 'Student'}</span> ({' '}
              {blockedStudent?.studentId ?? 'N/A'})
            </p>
            <p className="mt-2">Complete current checkout, or clear context to switch students.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setContextLockOpen(false)}>
              Continue Current
            </Button>
            <Button className="rounded-xl" onClick={() => clearAll('checkout')}>
              Clear & Switch Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorModal.open} onOpenChange={(open) => setErrorModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="rounded-2xl sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {errorModal.title}
            </DialogTitle>
            <DialogDescription className="pt-1 text-muted-foreground">{errorModal.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="rounded-xl bg-primary hover:bg-primary/90"
              onClick={() => setErrorModal((prev) => ({ ...prev, open: false }))}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
