'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, QrCode, RotateCcw, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function ReturnPage() {
  const [scanValue, setScanValue] = useState('');
  const [pendingReturn, setPendingReturn] = useState<PendingReturn | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; body: string }>({
    open: false,
    title: '',
    body: '',
  });

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

  const startPreviewReturn = async () => {
    const bookQr = scanValue.trim();
    if (!bookQr || isPreviewing || isConfirming) return;

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
  };

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

  const clearState = () => {
    setPendingReturn(null);
    setScanValue('');
    setNotice({ tone: 'warn', text: 'Return flow reset. Scan another book QR to continue.' });
  };

  const noticeClasses =
    notice?.tone === 'ok'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : notice?.tone === 'warn'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">QR Return</h1>
            <p className="text-sm text-zinc-500">Scan a book QR to validate and finalize the return.</p>
          </div>
          <Button type="button" variant="outline" onClick={clearState} className="h-10 rounded-xl">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-900">
          <ScanLine className="h-4 w-4 text-indigo-600" />
          Scan Book QR
        </h2>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={scanValue}
            onChange={(event) => setScanValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void startPreviewReturn();
              }
            }}
            placeholder="Paste or type book QR payload"
            className="h-10 flex-1 rounded-lg border border-zinc-300 px-3 text-sm outline-none ring-indigo-500 transition focus:ring-2"
          />
          <Button className="h-10 rounded-lg" onClick={() => void startPreviewReturn()} disabled={isPreviewing}>
            {isPreviewing ? 'Validating...' : 'Validate Return'}
          </Button>
        </div>

        {notice && <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${noticeClasses}`}>{notice.text}</div>}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">Return safeguards enabled</h3>
        <div className="grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            Locks the scanned copy to prevent double-return races.
          </p>
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            Verifies there is an active borrowing record before completing.
          </p>
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
            Repeated confirm clicks are idempotent-safe.
          </p>
          <p className="flex items-start gap-2">
            <QrCode className="mt-0.5 h-4 w-4 text-indigo-600" />
            Copy status flips back to AVAILABLE after successful return.
          </p>
        </div>
      </div>

      <Dialog open={!!pendingReturn} onOpenChange={(open) => (!open ? setPendingReturn(null) : null)}>
        <DialogContent className="rounded-2xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-900">Return Confirmation</DialogTitle>
            <DialogDescription>Review the return details before finalizing this transaction.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Student</span>
              <span className="font-semibold text-zinc-900">{pendingReturn?.studentName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Book</span>
              <span className="text-right font-semibold text-zinc-900">{pendingReturn?.bookTitle}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Borrowed</span>
              <span className="font-semibold text-zinc-900">{borrowedAtLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-500">Due Date</span>
              <span className="font-semibold text-zinc-900">{dueDateLabel}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setPendingReturn(null)}>
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={isConfirming} onClick={() => void confirmReturn()}>
              {isConfirming ? 'Finalizing...' : 'Confirm Return'}
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
    </div>
  );
}
