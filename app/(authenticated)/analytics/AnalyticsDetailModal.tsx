"use client";
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getAnalyticsDetail, type AnalyticsSelection, type AnalyticsDetailRow } from '@/lib/actions/analytics';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
import { BorrowerDetailsModal, type BorrowerSummary } from '@/components/common/BorrowerDetailsModal';
export function AnalyticsDetailModal({ selection, onClose }: { selection: AnalyticsSelection; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: AnalyticsDetailRow[]; total: number } | null>(null);
  const recordsRef = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [book, setBook] = useState<string | null>(null);
  const [borrower, setBorrower] = useState<BorrowerSummary | null>(null);
  useEffect(() => {
    let active = true;
    getAnalyticsDetail(selection, page).then(result => { if (active) { setData(result); setTotal(result.total); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [selection, page, attempt]);
  const changePage = (next: number) => { setData(null); setError(false); setPage(next); if (recordsRef.current) recordsRef.current.scrollTop = 0; };
  return <>
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-8"><DialogTitle>{selection.title}</DialogTitle>
          <DialogDescription>{selection.from} – {selection.to} · Manila time</DialogDescription></DialogHeader>
        <div ref={recordsRef} role="region" aria-label="Analytics records" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain pr-1">
        {error ? <div role="alert" className="space-y-2 text-sm"><p>Records could not be loaded.</p><button type="button" className="underline" onClick={() => { setError(false); setAttempt(n => n + 1); }}>Retry</button></div>
          : !data ? <p role="status" className="text-sm text-muted-foreground">Loading records…</p>
          : <><p className="text-sm text-muted-foreground">{data.total} records</p>
            {!data.rows.length ? <p className="py-8 text-center text-sm">No records for this selection.</p> :
              <ul className="divide-y divide-border">{data.rows.map(row => <li key={row.id} className="space-y-1 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  {row.book_id ? <button type="button" className="text-left font-medium hover:underline" onClick={() => setBook(row.book_id)}>{row.book_title || 'Book details'}</button> : <span>Library visit</span>}
                  <time className="text-xs text-muted-foreground">{new Date(row.occurred_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</time>
                </div>
                {row.borrower_id ? <button type="button" className="text-left text-muted-foreground hover:underline" onClick={() => setBorrower({ id: row.borrower_id!, full_name: row.borrower_name, email: row.email, student_id: row.student_id })}>{row.borrower_name || 'Borrower details'}</button> : <span>Unavailable borrower</span>}
                <span className="ml-3 text-xs text-muted-foreground">{row.status.replaceAll('_', ' ')}</span>
              </li>)}</ul>}
          </>}
        </div>
        {total !== null && <nav aria-label="Analytics records pagination" className="flex shrink-0 items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <button type="button" aria-label="Previous page" disabled={!data || page === 1} className="min-h-10 rounded-md px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40" onClick={() => changePage(page - 1)}>Previous</button>
          <span aria-live="polite">Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
          <button type="button" aria-label="Next page" disabled={!data || page * 20 >= total} className="min-h-10 rounded-md px-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40" onClick={() => changePage(page + 1)}>Next</button>
        </nav>}
      </DialogContent>
    </Dialog>
    {book && <BookDetailModal key={book} bookId={book} open variant="read_only" onOpenChange={(open) => { if (!open) setBook(null); }} />}
    <BorrowerDetailsModal borrower={borrower} canOpenProfile onClose={() => setBorrower(null)} />
  </>;
}
