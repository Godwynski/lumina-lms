"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FineResolution } from "@/lib/actions/history";

interface FineSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  fineAmount: number;
  isSubmitting?: boolean;
  allowReturnOnly?: boolean;
  onReturnOnly?: () => void;
  onResolve: (resolution: FineResolution, remarks: string) => void;
}

export function FineSettlementDialog({
  open,
  onOpenChange,
  title,
  description,
  fineAmount,
  isSubmitting = false,
  allowReturnOnly = false,
  onReturnOnly,
  onResolve,
}: FineSettlementDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [remarkError, setRemarkError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRemarks("");
      setRemarkError(null);
    }
  }, [open]);

  const handlePaid = () => {
    setRemarkError(null);
    onResolve("PAID", remarks.trim());
  };

  const handleCondoned = () => {
    const trimmed = remarks.trim();
    if (trimmed.length < 5) {
      setRemarkError("Remarks of at least 5 characters are required when condoning a fine.");
      return;
    }
    setRemarkError(null);
    onResolve("CONDONED", trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Field className="space-y-1.5 py-1">
          <div className="flex items-center justify-between">
            <Label>Remarks</Label>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {remarks.length}/500
            </span>
          </div>
          <Textarea
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value);
              if (remarkError) setRemarkError(null);
            }}
            maxLength={500}
            rows={3}
            disabled={isSubmitting}
            aria-invalid={Boolean(remarkError)}
            placeholder="Optional for Paid; required (at least 5 characters) for Condoned"
          />
          {remarkError && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {remarkError}
            </p>
          )}
        </Field>

        <DialogFooter className="flex-wrap gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {allowReturnOnly && onReturnOnly && (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onReturnOnly}
            >
              Return Only (Pay Later)
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={handleCondoned}
          >
            Mark as Condoned
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handlePaid}
          >
            Mark as Paid (₱{Number(fineAmount).toFixed(2)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
