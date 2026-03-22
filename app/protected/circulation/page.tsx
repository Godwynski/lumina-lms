'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  QrCode,
  RefreshCcw,
  ScanLine,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function CirculationPage() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'return' ? 'return' : 'checkout';

  const [mode, setMode] = useState<FlowMode>(initialMode);
  const [manualValue, setManualValue] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isResolving, setIsResolving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [activeStudent, setActiveStudent] = useState<ActiveStudent | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutDraft | null>(null);
  const [pendingReturn, setPendingReturn] = useState<PendingReturn | null>(null);

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

  const requestCameraPermission = useCallback(async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setNotice({ tone: 'error', text: 'Camera API is unavailable in this browser.' });
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      media.getTracks().forEach((track) => track.stop());
      setCameraPermission('granted');
      setNotice({ tone: 'ok', text: 'Camera permission granted. You can start scanner now.' });
    } catch {
      setCameraPermission('denied');
      setNotice({ tone: 'error', text: 'Camera permission denied. Allow camera access in browser settings.' });
    }
  }, []);

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
      return;
    }

    if (!activeStudent) {
      if (payload.type === 'book') {
        setNotice({ tone: 'warn', text: 'Scan the student library card first, then scan book copies.' });
        return;
      }

      if (payload.data.status !== 'active') {
        setErrorModal({
          open: true,
          title: 'Card inactive',
          body: 'This student card is not active. Only active cards can check out books.',
        });
        return;
      }

      setActiveStudent({
        cardNumber: payload.data.cardNumber,
        fullName: payload.data.fullName,
        studentId: payload.data.studentId,
        status: payload.data.status,
      });
      setNotice({ tone: 'ok', text: 'Student locked. Continue by scanning one book copy QR.' });
      return;
    }

    if (payload.type === 'student') {
      if (payload.data.cardNumber === activeStudent.cardNumber) {
        setNotice({ tone: 'warn', text: 'This student card is already active in the current checkout flow.' });
        return;
      }

      setBlockedStudent({ fullName: payload.data.fullName, studentId: payload.data.studentId });
      setContextLockOpen(true);
      return;
    }

    await startPreviewCheckout(activeStudent.cardNumber, payload.data.qrString);
  }, [activeStudent, startPreviewCheckout]);

  const startPreviewReturn = useCallback(async (rawQr: string) => {
    const bookQr = rawQr.trim();
    if (!bookQr || isConfirming) return;

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
      return;
    }

    setPendingReturn({
      bookQr,
      bookTitle: payload.book_title ?? 'Unknown title',
      studentName: payload.student_name ?? 'Student',
      dueDate: payload.due_date,
      borrowedAt: payload.borrowed_at,
      idempotencyKey: crypto.randomUUID(),
    });
  }, [isConfirming]);

  const processScan = useCallback(async (rawValue: string) => {
    const scanValue = rawValue.trim();
    if (!scanValue || isResolving || isConfirming) return;

    const now = Date.now();
    const last = lastAcceptedScanRef.current;
    if (last && last.value === scanValue && now - last.at < SCAN_DEBOUNCE_MS) {
      setNotice({ tone: 'warn', text: 'Duplicate scan ignored. Wait 1.5 seconds before scanning again.' });
      return;
    }

    lastAcceptedScanRef.current = { value: scanValue, at: now };
    setIsResolving(true);

    try {
      if (mode === 'checkout') {
        const payload = await resolveScan(scanValue);
        if (!payload) {
          setNotice({ tone: 'error', text: 'Failed to decode QR scan response.' });
          return;
        }
        await handleResolvedCheckoutPayload(payload);
      } else {
        await startPreviewReturn(scanValue);
      }
      setManualValue('');
    } catch {
      setNotice({ tone: 'error', text: 'Unable to process the scanned QR value right now.' });
    } finally {
      setIsResolving(false);
      focusManualInput();
    }
  }, [focusManualInput, handleResolvedCheckoutPayload, isConfirming, isResolving, mode, resolveScan, startPreviewReturn]);

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
    setCameraSupported(
      !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        !!detectorCtor,
    );
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
      } catch {
        setCameraPermission('denied');
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
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : notice?.tone === 'warn'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-700';

  const checkoutStep = !activeStudent ? 1 : pendingCheckout ? 3 : 2;
  const returnStep = pendingReturn ? (isConfirming ? 3 : 2) : 1;
  const cameraStateLabel = !cameraSupported ? 'Scanner Unavailable' : cameraOpen ? 'Live Scanner' : 'Scanner Idle';
  const permissionLabel =
    !cameraSupported
      ? 'Manual input mode'
      : cameraPermission === 'granted'
      ? 'Camera ready'
      : cameraPermission === 'denied'
        ? 'Permission denied'
        : 'Permission needed';
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
  const stepChipClasses = (active: boolean) =>
    active
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-border bg-muted text-muted-foreground';

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
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm md:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <ScanLine className="h-4 w-4 text-muted-foreground" />
                Scanner
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md border border-border bg-muted px-2 py-1 font-medium text-muted-foreground">{cameraStateLabel}</span>
                <span className="rounded-md border border-border bg-muted px-2 py-1 font-medium text-muted-foreground">{permissionLabel}</span>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {cameraSupported ? (
                <>
                  <Button
                    variant="outline"
                    className="h-8 rounded-md"
                    onClick={() => void requestCameraPermission()}
                  >
                    {cameraPermission === 'granted' ? 'Camera Enabled' : 'Enable Camera Permission'}
                  </Button>
                  <Button
                    variant={cameraOpen ? 'destructive' : 'outline'}
                    className="h-8 rounded-md"
                    onClick={() => (cameraOpen ? stopCamera() : setCameraOpen(true))}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {cameraOpen ? 'Stop Camera' : 'Start Camera'}
                  </Button>
                </>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-border bg-primary">
                <video ref={videoRef} className="h-[176px] w-full object-cover md:h-[196px]" muted playsInline />
                <div className="pointer-events-none absolute inset-x-8 top-8 h-16 rounded-full border border-border/20" />
                {!cameraOpen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/80 text-primary-foreground">
                    <div className="text-center">
                      <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-semibold">Camera scanner is idle</p>
                      <p className="mt-1 text-xs text-muted-foreground">Manual input is always available below</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Manual input</p>
                  <p className="text-xs font-medium text-muted-foreground">Next step: {nextActionLabel}</p>
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
                    className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none ring-ring transition focus:ring-2"
                  />
                  <Button
                    className="h-9 rounded-md bg-primary px-4 hover:bg-primary/90"
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

        <div className="space-y-2.5 lg:col-span-4">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm md:p-4">
            <h2 className="mb-3 text-base font-semibold text-foreground">Workflow guide</h2>
            {mode === 'checkout' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-md border px-2 py-1 font-semibold ${stepChipClasses(checkoutStep === 1)}`}>Step 1: Student card</span>
                  <span className={`rounded-md border px-2 py-1 font-semibold ${stepChipClasses(checkoutStep === 2)}`}>Step 2: Book QR</span>
                  <span className={`rounded-md border px-2 py-1 font-semibold ${stepChipClasses(checkoutStep === 3)}`}>Step 3: Confirm</span>
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
                    <div className="rounded-lg border border-border bg-muted p-3 text-foreground">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active student</p>
                      <p className="mt-1 text-base font-bold">{activeStudent.fullName}</p>
                      <p className="text-xs text-muted-foreground">Card: {activeStudent.cardNumber}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Identity verification
                      </p>
                      <p className="mt-1 text-sm text-amber-900">Ask the student to verbally confirm this ID:</p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-amber-900">{activeStudent.studentId}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-md border px-2 py-1 font-semibold ${stepChipClasses(returnStep === 1)}`}>Step 1: Book QR</span>
                  <span className={`rounded-md border px-2 py-1 font-semibold ${stepChipClasses(returnStep === 2)}`}>Step 2: Review</span>
                  <span className={`rounded-md border px-2 py-1 font-semibold ${stepChipClasses(returnStep === 3)}`}>Step 3: Confirm</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {returnStep === 1
                    ? 'Scan a book copy QR to start return validation.'
                    : 'Review borrower and due date, then confirm return in the dialog.'}
                </p>
                {pendingReturn ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted p-3 text-sm">
                    <div className="flex items-center gap-2 text-emerald-700">
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

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">Primary Focus</p>
            <p className="mt-0.5 text-sm font-semibold text-amber-900">Confirm borrower identity, then finalize checkout.</p>
            <p className="text-xs text-amber-800">Risk check: student verbally confirms ID before you press Confirm.</p>
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

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Primary Focus</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-900">Verify loan details, then finalize return.</p>
            <p className="text-xs text-emerald-800">Risk check: confirm title and borrower before you press Confirm.</p>
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
              <AlertCircle className="h-4 w-4 text-red-600" />
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
