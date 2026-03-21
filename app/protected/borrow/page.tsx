'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, QrCode, RefreshCcw, ScanLine, ShieldAlert, UserRound } from 'lucide-react';
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
    <div className="w-full space-y-4 pb-6 md:pb-8">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Checkout</h1>
          <p className="text-xs text-muted-foreground">Scan card, scan book, confirm.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={clearContext}
          className="h-8 rounded-md border-border"
          disabled={!activeStudent && !pendingCheckout}
        >
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ScanLine className="h-4 w-4 text-muted-foreground" />
                Scanner
              </h2>
            {cameraSupported ? (
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Camera scanner unsupported in this browser</span>
            )}
            </div>

            <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl border border-border bg-primary">
                  <video ref={videoRef} className="h-[220px] w-full object-cover" muted playsInline />
                  <div className="pointer-events-none absolute inset-x-8 top-8 h-16 rounded-full border border-border/20" />
                  {!cameraOpen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/80 text-primary-foreground">
                    <div className="text-center">
                      <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-semibold">Camera scanner is idle</p>
                      <p className="mt-1 text-xs text-muted-foreground">Manual input stays available below</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-muted p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Manual</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={manualValue}
                    onChange={(event) => setManualValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleManualSubmit();
                      }
                    }}
                    placeholder="Paste or type QR payload"
                    className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none ring-ring transition focus:ring-2"
                  />
                  <Button className="h-9 rounded-md bg-primary hover:bg-primary/90" onClick={() => void handleManualSubmit()}>
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

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                Session Context
              </h2>

            {!activeStudent ? (
              <div className="rounded-xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
                Scan a student library card to lock context for this checkout run.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-muted p-3 text-foreground">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active student</p>
                  <p className="mt-1 text-sm font-semibold">{activeStudent.fullName}</p>
                  <p className="text-xs text-muted-foreground">Card: {activeStudent.cardNumber}</p>
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
        <DialogContent className="rounded-2xl border-border sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Borrowing Confirmation</DialogTitle>
            <DialogDescription>
              Review the checkout details before finalizing this transaction.
            </DialogDescription>
          </DialogHeader>

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
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <AlertCircle className="h-4 w-4 text-red-600" />
              {errorModal.title}
            </DialogTitle>
            <DialogDescription className="pt-1 text-muted-foreground">{errorModal.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setErrorModal((prev) => ({ ...prev, open: false }))}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
