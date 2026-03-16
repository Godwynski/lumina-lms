"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WifiOff } from "lucide-react";

interface OfflineActionModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal shown when a user attempts an action that requires internet
 * (renew, checkout, etc.) while offline.
 */
export function OfflineActionModal({ open, onClose }: OfflineActionModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl border-zinc-200 bg-white shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <WifiOff size={28} />
          </div>
        </div>
        <DialogHeader className="items-center">
          <DialogTitle className="text-xl font-black text-zinc-900">
            No Internet Connection
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm mt-2 leading-relaxed">
            You&apos;re offline — this action requires internet.
          </DialogDescription>
        </DialogHeader>
        <Button
          onClick={onClose}
          className="w-full mt-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-bold"
        >
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
