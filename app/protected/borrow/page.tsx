'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, CreditCard, QrCode, RefreshCcw, ScanLine, ShieldAlert, UserRound, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

type BarcodeLike = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeLike[]>;
};

type WindowWithDetector = Window & {
  BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
};

const SCAN_DEBOUNCE_MS = 1500;

export default function BorrowPage() {
  const [activeStudent, setActiveStudent] = useState<ActiveStudent | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutDraft | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isResolving, setIsResolving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [contextLockOpen, setContextLockOpen] = useState(false);
  const [blockedStudent, setBlockedStudent] = useState<{ fullName: string; studentId: string } | null>(null);

  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; body: string }>({
    open: false,
    title: '',
    body: '',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastAcceptedScanRef = useRef<{ value: string; at: number } | null>(null);

  const dueDateLabel = useMemo(() => {
    if (!pendingCheckout?.dueDate) return '';
    return new Date(pendingCheckout.dueDate).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [pendingCheckout?.dueDate]);

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

  const resolveScan = useCallback(
    async (scanValue: string): Promise<ScanResolveResponse | null> => {
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
    },
    [],
  );

  const startPreviewCheckout = useCallback(
    async (studentCardQr: string, bookQr: string) => {
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
          body: payload.message ?? 'The borrow request failed validation.',
        });
        return;
      }

      setPendingCheckout({
        bookQr,
        bookTitle: payload.book_title ?? 'Unknown title',
        dueDate: payload.due_date ?? new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      });
    },
    [],
  );

  const handleResolvedPayload = useCallback(
    async (payload: ScanResolveResponse) => {
      if (!payload.ok) {
        setNotice({ tone: 'error', text: payload.message });
        return;
      }

      if (!activeStudent) {
        if (payload.type === 'book') {
          setNotice({ tone: 'warn', text: 'Scan the student library card first before scanning books.' });
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
        setNotice({ tone: 'ok', text: 'Student checkout context is now locked. Continue by scanning book QR codes.' });
        return;
      }

      if (payload.type === 'student') {
        if (payload.data.cardNumber === activeStudent.cardNumber) {
          setNotice({ tone: 'warn', text: 'Student card already active in this checkout context.' });
          return;
        }

        setBlockedStudent({ fullName: payload.data.fullName, studentId: payload.data.studentId });
        setContextLockOpen(true);
        return;
      }

      await startPreviewCheckout(activeStudent.cardNumber, payload.data.qrString);
    },
    [activeStudent, startPreviewCheckout],
  );

  const processScan = useCallback(
    async (rawValue: string) => {
      const scanValue = rawValue.trim();
      if (!scanValue || isResolving || isConfirming) return;

      const now = Date.now();
      const last = lastAcceptedScanRef.current;
      if (last && now - last.at < SCAN_DEBOUNCE_MS) {
        setNotice({ tone: 'warn', text: 'Scanner debounce active. Wait 1.5 seconds before the next scan.' });
        return;
      }

      lastAcceptedScanRef.current = { value: scanValue, at: now };
      setIsResolving(true);

      try {
        const payload = await resolveScan(scanValue);
        if (!payload) {
          setNotice({ tone: 'error', text: 'Failed to decode QR scan response.' });
          return;
        }
        await handleResolvedPayload(payload);
      } catch {
        setNotice({ tone: 'error', text: 'Unable to process the scanned QR value right now.' });
      } finally {
        setIsResolving(false);
      }
    },
    [handleResolvedPayload, isConfirming, isResolving, resolveScan],
  );

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
        setNotice({ tone: 'error', text: 'Camera access denied or unavailable. You can still use manual scan input.' });
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

  const handleManualSubmit = async () => {
    const value = manualValue.trim();
    if (!value) return;
    await processScan(value);
    setManualValue('');
  };

  const clearContext = () => {
    setActiveStudent(null);
    setPendingCheckout(null);
    setBlockedStudent(null);
    setContextLockOpen(false);
    setNotice({ tone: 'ok', text: 'Checkout context cleared. You can scan a different student card.' });
  };

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
          body: payload.message ?? 'Unable to finalize the borrow.',
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
    }
  };

  const noticeClasses =
    notice?.tone === 'ok'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : notice?.tone === 'warn'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-white via-cyan-50/40 to-amber-50/60 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-52 w-52 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Circulation Desk</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">Borrow Flow Console</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Scan student card, verify identity, then process book QR. Built for fast desk throughput with guardrails.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={clearContext}
            className="h-10 rounded-xl border-zinc-300 bg-white/80"
            disabled={!activeStudent && !pendingCheckout}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset Session
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
                <ScanLine className="h-4 w-4 text-cyan-700" />
                Scanner Deck
              </h2>
            {cameraSupported ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="h-9 rounded-lg"
                  onClick={() => void requestCameraPermission()}
                >
                  {cameraPermission === 'granted' ? 'Camera Enabled' : 'Enable Camera Permission'}
                </Button>
                <Button
                  variant={cameraOpen ? 'destructive' : 'outline'}
                  className="h-9 rounded-lg"
                  onClick={() => (cameraOpen ? stopCamera() : setCameraOpen(true))}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {cameraOpen ? 'Stop Camera' : 'Start Camera'}
                </Button>
              </div>
            ) : (
              <span className="text-xs font-medium text-zinc-500">Camera scanner unsupported in this browser</span>
            )}
            </div>

            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                <video ref={videoRef} className="h-[280px] w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-x-8 top-8 h-16 rounded-full border border-cyan-300/20" />
                {!cameraOpen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 text-zinc-100">
                    <div className="text-center">
                      <QrCode className="mx-auto mb-2 h-8 w-8 text-cyan-200" />
                      <p className="text-sm font-semibold">Camera scanner is idle</p>
                      <p className="mt-1 text-xs text-zinc-300">Manual input stays available below</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Manual fallback</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={manualValue}
                    onChange={(event) => setManualValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleManualSubmit();
                      }
                    }}
                    placeholder="Paste or type QR payload"
                    className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none ring-cyan-500 transition focus:ring-2"
                  />
                  <Button className="h-10 rounded-lg bg-cyan-700 hover:bg-cyan-800" onClick={() => void handleManualSubmit()}>
                    Process Scan
                  </Button>
                </div>
              </div>

              {notice && (
                <div className={`rounded-xl border px-3 py-2 text-sm ${noticeClasses}`}>
                  {notice.text}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-zinc-900">
              <CreditCard className="h-4 w-4 text-cyan-700" />
              Progress Rail
            </h2>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border p-3 text-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Step 1</p>
                <p className="mt-1 font-semibold">Scan student card</p>
                <p className={activeStudent ? 'mt-1 text-emerald-700' : 'mt-1 text-zinc-500'}>
                  {activeStudent ? 'Completed' : 'Waiting'}
                </p>
              </div>
              <div className="rounded-xl border p-3 text-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Step 2</p>
                <p className="mt-1 font-semibold">Scan book copy QR</p>
                <p className={pendingCheckout ? 'mt-1 text-emerald-700' : 'mt-1 text-zinc-500'}>
                  {pendingCheckout ? 'Ready to confirm' : 'Waiting'}
                </p>
              </div>
              <div className="rounded-xl border p-3 text-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Step 3</p>
                <p className="mt-1 font-semibold">Confirm checkout</p>
                <p className="mt-1 text-zinc-500">Finalized in confirmation modal</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-900">
              <UserRound className="h-4 w-4 text-cyan-700" />
              Student Context
            </h2>

            {!activeStudent ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                Scan a student library card to lock context for this checkout run.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <p className="text-xs font-semibold uppercase tracking-wider">Context locked</p>
                  <p className="mt-1 text-sm font-semibold">{activeStudent.fullName}</p>
                  <p className="text-xs">Card: {activeStudent.cardNumber}</p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Identity verification
                  </p>
                  <p className="mt-1 text-sm text-amber-900">Ask the student to verbally state this ID:</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-amber-900">{activeStudent.studentId}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog open={!!pendingCheckout} onOpenChange={(open) => (!open ? setPendingCheckout(null) : null)}>
        <DialogContent className="rounded-2xl border-zinc-200 sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-900">Borrowing Confirmation</DialogTitle>
            <DialogDescription>
              Review the checkout details before finalizing this transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Student</span>
              <span className="font-semibold text-zinc-900">{activeStudent?.fullName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Student ID</span>
              <span className="font-mono font-semibold text-zinc-900">{activeStudent?.studentId}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Book</span>
              <span className="text-right font-semibold text-zinc-900">{pendingCheckout?.bookTitle}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Due Date</span>
              <span className="font-semibold text-zinc-900">{dueDateLabel}</span>
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

      <Dialog open={contextLockOpen} onOpenChange={setContextLockOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">Checkout context is locked</DialogTitle>
            <DialogDescription>
              Another student card was scanned while a checkout is already in progress.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              Detected: <span className="font-semibold">{blockedStudent?.fullName ?? 'Student'}</span> ({' '}
              {blockedStudent?.studentId ?? 'N/A'})
            </p>
            <p className="mt-2">Complete the current transaction or clear the context to switch students.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setContextLockOpen(false)}>
              Continue Current
            </Button>
            <Button className="rounded-xl" onClick={clearContext}>
              Clear & Switch Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorModal.open} onOpenChange={(open) => setErrorModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="rounded-2xl sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <AlertCircle className="h-4 w-4 text-red-600" />
              {errorModal.title}
            </DialogTitle>
            <DialogDescription className="pt-1 text-zinc-600">{errorModal.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="rounded-xl" onClick={() => setErrorModal((prev) => ({ ...prev, open: false }))}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">Scanner safeguards enabled</h3>
        <div className="grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            1.5-second scanner debounce prevents duplicate reads.
          </p>
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            Context lock blocks accidental student switching mid-transaction.
          </p>
          <p className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 text-red-600" />
            Inactive cards, over-limit borrowers, and unavailable copies are auto-blocked.
          </p>
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
            Simultaneous scans for the same copy return a friendly conflict message.
          </p>
        </div>
      </div>
    </div>
  );
}
