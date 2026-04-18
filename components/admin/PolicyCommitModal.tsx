'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, AlertCircle, ArrowRight } from "lucide-react";
import { useState } from "react";

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  changedKeys: string[];
  initialValues: Record<string, string>;
  formData: Record<string, string>;
  loading: boolean;
}

export function PolicyCommitModal({
  isOpen,
  onClose,
  onConfirm,
  changedKeys,
  initialValues,
  formData,
  loading
}: CommitModalProps) {
  const [reason, setReason] = useState("");

  const formatKey = (key: string) => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] border-border bg-background rounded-3xl p-8 gap-8">
        <DialogHeader>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Check className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Review System Updates</DialogTitle>
          <p className="text-sm text-muted-foreground">
            You are about to modify {changedKeys.length} core policy {changedKeys.length === 1 ? 'rule' : 'rules'}.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-[200px] overflow-y-auto pr-2 space-y-3">
            {changedKeys.map(key => (
              <div key={key} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50 text-xs">
                <span className="font-semibold text-foreground/80">{formatKey(key)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground line-through">{initialValues[key] || "Null"}</span>
                  <ArrowRight className="h-3 w-3 text-primary" />
                  <span className="font-bold text-primary">{formData[key]}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
              Reason for Change (Optional)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Seasonal adjustment for finals week..."
              className="min-h-[80px] rounded-2xl border-border/50 bg-muted/20 text-xs focus:bg-background transition-all"
            />
            <div className="flex items-center gap-2 px-1 text-[10px] text-amber-600 font-medium">
              <AlertCircle className="h-3 w-3" />
              <span>This change will be logged in the system audit trail.</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 sm:justify-start">
          <Button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="rounded-xl px-6 h-11 text-xs font-bold uppercase tracking-wider flex-1"
          >
            {loading ? "Committing..." : "Finalize & Apply"}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-6 h-11 text-xs font-bold uppercase tracking-wider"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
