"use client";
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export type BorrowerSummary = { id: string; full_name: string | null; email: string | null; student_id: string | null };
export function BorrowerDetailsModal({ borrower, onClose, canOpenProfile, onCloseAutoFocus }: {
  borrower: BorrowerSummary | null; onClose: () => void; canOpenProfile: boolean; onCloseAutoFocus?: (event: Event) => void;
}) {
  return <Dialog open={!!borrower} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader><DialogTitle>{borrower?.full_name || 'Borrower details'}</DialogTitle>
        <DialogDescription>Borrower information from the selected record.</DialogDescription></DialogHeader>
      <dl className="space-y-4 text-sm">
        <div><dt className="text-muted-foreground">School ID</dt><dd>{borrower?.student_id || 'Not provided'}</dd></div>
        <div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{borrower?.email || 'Not provided'}</dd></div>
      </dl>
      {borrower && canOpenProfile && <Link className="text-sm font-medium text-primary underline underline-offset-4" href={`/users/${borrower.id}`}>Open full profile</Link>}
    </DialogContent>
  </Dialog>;
}
