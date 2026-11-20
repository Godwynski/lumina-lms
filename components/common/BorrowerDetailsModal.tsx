"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getBorrowerDetails } from '@/lib/actions/history';
export type BorrowerSummary = { id: string; full_name: string | null; email: string | null; student_id: string | null };
type Details = { phone: string | null; department: string | null; cardNumber: string | null; activeLoans: number; overdueLoans: number; unpaidFines: number };
export function BorrowerDetailsModal({ borrower, onClose, canOpenProfile, onCloseAutoFocus }: {
  borrower: BorrowerSummary | null; onClose: () => void; canOpenProfile: boolean; onCloseAutoFocus?: (event: Event) => void;
}) {
  const [details, setDetails] = useState<{ id: string; data: Details | null } | null>(null);
  const borrowerId = borrower?.id;
  useEffect(() => {
    if (!borrowerId) return;
    let active = true;
    getBorrowerDetails({ userId: borrowerId })
      .then(res => res.success ? res.data : null, () => null)
      .then(data => { if (active) setDetails({ id: borrowerId, data }); });
    return () => { active = false; };
  }, [borrowerId]);
  const d = details && details.id === borrowerId ? details.data : undefined;
  const value = (v: string | null | undefined) => d === undefined ? 'Loading...' : v || 'Not provided';

  return <Dialog open={!!borrower} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader><DialogTitle>{borrower?.full_name || 'Borrower details'}</DialogTitle>
        <DialogDescription>Borrower information from the selected record.</DialogDescription></DialogHeader>
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">School ID</dt><dd>{borrower?.student_id || 'Not provided'}</dd></div>
        <div><dt className="text-muted-foreground">Library card</dt><dd>{value(d?.cardNumber)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-muted-foreground">Email</dt><dd className="break-all">{borrower?.email || 'Not provided'}</dd></div>
        <div><dt className="text-muted-foreground">Phone</dt><dd>{value(d?.phone)}</dd></div>
        <div><dt className="text-muted-foreground">Department</dt><dd>{value(d?.department)}</dd></div>
        {d && <div className="sm:col-span-2"><dt className="text-muted-foreground">Borrowing summary</dt>
          <dd>{d.activeLoans} active, {d.overdueLoans} overdue, ₱{d.unpaidFines.toFixed(2)} unpaid fines</dd></div>}
      </dl>
      {borrower && canOpenProfile && <Link className="text-sm font-medium text-primary underline underline-offset-4" href={`/users/${borrower.id}`}>Open full profile</Link>}
    </DialogContent>
  </Dialog>;
}
