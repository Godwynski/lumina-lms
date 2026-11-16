'use client';

import { User, Bookmark, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface BorrowingBlock {
  overdueCount: number;
  receivableTotal: number;
}

export function hasBorrowingBlock(block?: BorrowingBlock | null): boolean {
  if (!block) return false;
  return block.overdueCount > 0 || block.receivableTotal > 0;
}

export interface ActiveStudent {
  cardNumber: string;
  fullName: string;
  studentId: string;
  status: string;
  userId?: string;
  block?: BorrowingBlock;
}

export interface MemberPreviewProps {
  student: ActiveStudent;
  overrideReason?: string | null;
}

/**
 * Reusable preview card displaying verified member/student identity in circulation workflows.
 */
export function MemberPreview({ student, overrideReason }: MemberPreviewProps) {
  const isBlocked = hasBorrowingBlock(student.block);
  const isOverridden = isBlocked && Boolean(overrideReason);

  const cardTone = !isBlocked
    ? 'bg-primary/5 border-primary/10'
    : isOverridden
      ? 'bg-amber-500/5 border-amber-500/30'
      : 'bg-destructive/5 border-destructive/30';

  return (
    <div className="mb-8 space-y-3">
      <div className={`p-4 rounded-2xl border flex items-center gap-4 ${cardTone}`}>
        <Avatar className="h-10 w-10 border border-primary/20 bg-background">
          <AvatarFallback>
            <User className="h-5 w-5 text-primary/60" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold break-words">{student.fullName}</p>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
              {student.status}
            </span>
            {isBlocked && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  isOverridden
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-destructive/15 text-destructive'
                }`}
              >
                {isOverridden ? 'Override active' : 'Blocked'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Bookmark className="h-3 w-3" />
            {student.studentId}
          </p>
        </div>
        {!isBlocked ? (
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
        ) : isOverridden ? (
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
        )}
      </div>

      {isBlocked && student.block && (
        <div
          role="region"
          aria-label="Borrowing restrictions"
          className={`rounded-2xl border p-4 space-y-2 ${
            isOverridden
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-destructive/30 bg-destructive/5'
          }`}
        >
          <div className="flex items-center gap-2">
            {isOverridden ? (
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            )}
            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                isOverridden ? 'text-amber-800 dark:text-amber-200' : 'text-destructive'
              }`}
            >
              {isOverridden ? 'Borrowing Block Overridden' : 'Borrowing Restricted'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-background/80 border border-border/20 px-3 py-2 flex items-center justify-between">
              <span className="text-muted-foreground">Overdue books</span>
              <span className="font-bold tabular-nums text-foreground">{student.block.overdueCount}</span>
            </div>
            <div className="rounded-xl bg-background/80 border border-border/20 px-3 py-2 flex items-center justify-between">
              <span className="text-muted-foreground">Receivable fines</span>
              <span className="font-bold tabular-nums text-foreground">
                ₱{student.block.receivableTotal.toFixed(2)}
              </span>
            </div>
          </div>
          {isOverridden && (
            <p className="text-xs text-muted-foreground pt-1 break-words">
              <span className="font-semibold text-foreground">Override reason:</span> {overrideReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
