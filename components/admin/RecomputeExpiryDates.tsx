"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface RecomputeData {
  success: boolean;
  dryRun: boolean;
  validityYears: number;
  cardsAffected: number;
  totalCards: number;
  updates: Array<{
    cardId: string;
    userId: string;
    oldExpiry: string;
    newExpiry: string;
  }>;
}

export function RecomputeExpiryDates() {
  const [loading, setLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<RecomputeData | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<RecomputeData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDryRun = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/recompute-card-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });

      if (!response.ok) throw new Error("Failed to run dry run");

      const data: RecomputeData = await response.json();
      setDryRunResult(data);
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!dryRunResult) return;

    setExecuting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/recompute-card-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });

      if (!response.ok) throw new Error("Failed to execute recompute");

      const data: RecomputeData = await response.json();
      setExecutionResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              Recompute Card Expiry Dates
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Update all library card expiration dates based on the current card_validity_years policy.
              This retroactively recalculates expiry dates from the issue date.
            </p>
          </div>
          <Button
            onClick={handleDryRun}
            disabled={loading}
            className="rounded-lg bg-primary text-primary-foreground gap-2 hover:bg-primary/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Preview Changes
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle>Recompute Card Expiry Dates</DialogTitle>
            <DialogDescription>
              {executionResult
                ? "Recomputation completed successfully"
                : "Review the changes before executing"}
            </DialogDescription>
          </DialogHeader>

          {!executionResult && dryRunResult && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  <p className="font-semibold">Dry Run Summary</p>
                  <p className="mt-1">
                    This will affect {dryRunResult.cardsAffected} of{" "}
                    {dryRunResult.totalCards} active library cards.
                  </p>
                  <p className="text-xs mt-2">
                    Validity period: {dryRunResult.validityYears} years
                  </p>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Sample Changes (first {Math.min(dryRunResult.updates.length, 10)}):
                </p>
                <div className="space-y-1 text-xs">
                  {dryRunResult.updates.slice(0, 5).map((update) => (
                    <div key={update.cardId} className="text-foreground">
                      <p className="font-mono">Card: {update.cardId.slice(0, 8)}...</p>
                      <p className="text-muted-foreground">
                        {new Date(update.oldExpiry).toLocaleDateString()} →{" "}
                        {new Date(update.newExpiry).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {executionResult && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-700 dark:text-emerald-400">
                  <p className="font-semibold">✓ Completed Successfully</p>
                  <p className="mt-1">
                    Updated {executionResult.cardsAffected} library cards.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!executionResult && (
              <>
                <Button
                  onClick={() => setDialogOpen(false)}
                  variant="outline"
                  disabled={executing}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={executing}
                  className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {executing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Executing...
                    </>
                  ) : (
                    "Execute Changes"
                  )}
                </Button>
              </>
            )}
            {executionResult && (
              <Button
                onClick={() => setDialogOpen(false)}
                className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
