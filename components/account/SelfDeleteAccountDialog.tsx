"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelfDeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONFIRMATION_TEXT = "ARCHIVE MY ACCOUNT";

/**
 * Dialog component for users to self-archive their account.
 * Features a two-step process: warning and confirmation.
 */
export function SelfDeleteAccountDialog({
  isOpen,
  onClose,
}: SelfDeleteAccountDialogProps) {
  const [step, setStep] = useState<"warning" | "confirm">("warning");
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep("warning");
    setConfirmText("");
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleConfirm = async () => {
    if (confirmText !== CONFIRMATION_TEXT) {
      setError(`Please type "${CONFIRMATION_TEXT}" exactly`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/users/self-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "User-initiated self-deletion",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to archive account");
      }

      // Successful archive: redirect to landing page
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto rounded-xl p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-base">
            <Archive className="h-4 w-4" />
            Archive My Account
          </DialogTitle>
          <DialogDescription>
            This action will restrict your account. Please read carefully.
          </DialogDescription>
        </DialogHeader>

        {step === "warning" ? (
          <div className="space-y-4">
            <div className="status-danger rounded-lg p-3.5">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-destructive">This will archive:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1 text-muted-foreground">
                    <li>Your account and profile access</li>
                    <li>Your library card and active sessions</li>
                  </ul>
                  <p className="pt-2 font-medium">
                    Your information will be retained in archives for legal compliance and historical records.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="h-9 rounded-lg flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep("confirm")}
                className="h-9 rounded-lg flex-1 sm:flex-none"
              >
                Continue to Archiving
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                To confirm, please type the following text:
              </p>
              <code className="block rounded border border-border bg-muted p-2 text-sm font-mono text-center select-all">
                {CONFIRMATION_TEXT}
              </code>
            </div>

            <div className="space-y-1.5">
              <Input
                type="text"
                placeholder="Type confirmation text..."
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  setError(null);
                }}
                className={cn(
                  "h-10 w-full rounded-lg border-border text-sm focus:ring-1 focus:ring-destructive",
                  error && "border-destructive focus:ring-destructive"
                )}
                autoFocus
              />
              {error && (
                <p className="text-xs text-destructive font-medium px-1">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("warning");
                  setConfirmText("");
                  setError(null);
                }}
                disabled={isLoading}
                className="h-9 rounded-lg flex-1 sm:flex-none"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={isLoading || confirmText !== CONFIRMATION_TEXT}
                className="h-9 rounded-lg flex-1 sm:flex-none"
              >
                {isLoading ? "Archiving..." : "Archive My Account"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
