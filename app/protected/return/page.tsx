'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, QrCode, RotateCcw, ScanLine } from 'lucide-react';
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

type Notice = {
  tone: 'ok' | 'warn' | 'error';
  text: string;
};

type PendingReturn = {
  bookQr: string;
  bookTitle: string;
  studentName: string;
  dueDate?: string;
  borrowedAt?: string;
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

export default function ReturnPage() {
  const [scanValue, setScanValue] = useState('');
  const [pendingReturn, setPendingReturn] = useState<PendingReturn | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
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

  const processScannedBookQr = useCallback(async (rawQr: string) => {
    const bookQr = rawQr.trim();
    if (!bookQr || isPreviewing || isConfirming) return;

    const now = Date.now();
    const last = lastAcceptedScanRef.current;
    if (last && last.value === bookQr && now - last.at < SCAN_DEBOUNCE_MS) {
      setNotice({ tone: 'warn', text: 'Duplicate scan ignored. Wait 1.5 seconds or scan another copy.' });
      return;
    }

    lastAcceptedScanRef.current = { value: bookQr, at: now };

    setIsPreviewing(true);
    try {
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
      setScanValue('');
    } catch {
      setErrorModal({
        open: true,
        title: 'Network issue',
        body: 'Could not reach the return service. Try again.',
      });
    } finally {
      setIsPreviewing(false);
    }
  }, [isConfirming, isPreviewing]);

  const startPreviewReturn = useCallback(async () => {
    await processScannedBookQr(scanValue);
  }, [processScannedBookQr, scanValue]);

  const confirmReturn = async () => {
    if (!pendingReturn || isConfirming) return;

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
    }
  };

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
                await processScannedBookQr(first.rawValue);
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
        setNotice({ tone: 'error', text: 'Camera access denied or unavailable. Use manual QR input.' });
        stopCamera();
      }
    };

    void start();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [cameraOpen, cameraSupported, processScannedBookQr, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const clearState = () => {
    setPendingReturn(null);
    setScanValue('');
    setNotice({ tone: 'warn', text: 'Return flow reset. Scan another book QR to continue.' });
    lastAcceptedScanRef.current = null;
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
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Return</h1>
          <p className="text-xs text-muted-foreground">Scan copy QR and confirm return.</p>
        </div>
        <Button type="button" variant="outline" onClick={clearState} className="h-8 rounded-md border-border">
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
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

            <div className="mb-3 relative overflow-hidden rounded-xl border border-border bg-primary">
              <video ref={videoRef} className="h-[220px] w-full object-cover" muted playsInline />
              {!cameraOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/80 text-primary-foreground">
                    <div className="text-center">
                      <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-semibold">Camera scanner is idle</p>
                    <p className="mt-1 text-xs text-muted-foreground">Manual entry stays active below</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void startPreviewReturn();
                    }
                  }}
                  placeholder="Paste or type book QR payload"
                  className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none ring-ring transition focus:ring-2"
                />
                <Button className="h-9 rounded-md bg-primary hover:bg-primary/90" onClick={() => void startPreviewReturn()} disabled={isPreviewing || isConfirming}>
                  {isPreviewing ? 'Validating...' : 'Validate Return'}
                </Button>
              </div>
            </div>

            {notice && <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${noticeClasses}`}>{notice.text}</div>}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Status</h2>
            <p className="text-xs text-muted-foreground">{pendingReturn ? 'Validated and ready for confirmation.' : 'Waiting for a valid book scan.'}</p>
          </div>
        </div>
      </section>

      <Dialog open={!!pendingReturn} onOpenChange={(open) => (!open ? setPendingReturn(null) : null)}>
        <DialogContent className="rounded-2xl border-border sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Return Confirmation</DialogTitle>
            <DialogDescription>Review the return details before finalizing this transaction.</DialogDescription>
          </DialogHeader>

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
              <span className="font-semibold text-foreground">{dueDateLabel}</span>
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
