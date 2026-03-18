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
import { AlertCircle, Trash2 } from "lucide-react";

interface SelfDeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SelfDeleteAccountDialog({
  isOpen,
  onClose,
}: SelfDeleteAccountDialogProps) {
  const [step, setStep] = useState<"confirm" | "warning">("warning");
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (confirmText !== "DELETE MY ACCOUNT") {
      setError("Please type the confirmation text exactly");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/users/self-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "User-initiated self-deletion",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      // Account deleted successfully, user will be signed out and redirected
      window.location.href = "/auth/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep("warning");
    setConfirmText("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete My Account
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please read carefully.
          </DialogDescription>
        </DialogHeader>

        {step === "warning" ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 border border-red-200">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-red-800">
                  <p className="font-semibold">This will permanently delete:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>Your account and profile</li>
                    <li>Your personal information</li>
                    <li>Your library card and borrowing history</li>
                    <li>Access to all library services</li>
                  </ul>
                  <p className="pt-2 font-semibold">
                    Your borrowing records will be retained for legal compliance but anonymized.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep("confirm")}
              >
                Continue to Deletion
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-900">
                To confirm, please type the following text:
              </p>
              <code className="block bg-zinc-100 p-2 rounded text-sm font-mono border border-zinc-300">
                DELETE MY ACCOUNT
              </code>
            </div>

            <input
              type="text"
              placeholder="Type confirmation text..."
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
            />

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("warning");
                  setConfirmText("");
                  setError(null);
                }}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={isLoading || confirmText !== "DELETE MY ACCOUNT"}
              >
                {isLoading ? "Deleting..." : "Delete My Account"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
