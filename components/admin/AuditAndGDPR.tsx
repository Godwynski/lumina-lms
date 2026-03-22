"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, Shield, Loader2, Clock } from "lucide-react";

interface AuditLog {
  id: string;
  admin_id: string;
  entity_type: string;
  entity_id?: string;
  action: string;
  reason?: string;
  created_at: string;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/audit-logs");
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      const data = await response.json();
      const nextLogs = Array.isArray(data)
        ? data
        : Array.isArray(data?.logs)
          ? data.logs
          : [];
      setLogs(nextLogs);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    if (!normalizedFilter) return true;

    const entityType = (log.entity_type ?? "").toLowerCase();
    const action = (log.action ?? "").toLowerCase();

    return (
      entityType.includes(normalizedFilter) ||
      action.includes(normalizedFilter)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Filter by entity or action"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-md"
        />
        <Button
          onClick={fetchAuditLogs}
          variant="outline"
          className="h-9 rounded-md px-3 text-xs"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card className="border-border bg-card p-6 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-border bg-card p-6 text-center">
          <Clock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No logs found.</p>
        </Card>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="border-border bg-card p-2.5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">
                      {log.action.toUpperCase()}
                    </p>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {log.entity_type}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{log.reason}</p>
                  )}
                </div>
                <p className="ml-2 whitespace-nowrap text-[11px] text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface GDPRHardDeleteProps {
  userId?: string;
  userName?: string;
}

type GdprDeleteResult = {
  user_id: string;
  deleted_at: string;
  retained_borrow_count: number;
};

export function GDPRHardDeleteDialog({
  userId,
  userName,
}: GDPRHardDeleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<GdprDeleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setReason("");
    setConfirmation("");
    setResult(null);
    setError(null);
    setConfirming(false);
  };

  const handleSubmit = async () => {
    if (!userId) {
      setError("No user selected");
      return;
    }

    // Require explicit confirmation
    if (confirmation !== "DELETE") {
      setError('Please type "DELETE" to confirm');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/gdpr-hard-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          reason: reason || "User requested deletion",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete user profile");
      }

      const data = await response.json();
      setResult(data.result);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="h-8 rounded-md gap-1.5 px-3 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        <Lock className="h-3.5 w-3.5" />
        Request hard delete
      </Button>

      <DialogContent className="max-w-md rounded-lg p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            GDPR Right to Erasure
          </DialogTitle>
          <DialogDescription className="text-xs">
            This action will anonymize the user profile and remove personal identifiers.
            {userName && ` Target user: ${userName}`}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="status-danger rounded-md p-3">
              <p className="mb-2 text-xs font-semibold">
                ⚠️ Warning: This action is irreversible
              </p>
              <ul className="list-inside list-disc space-y-1 text-[11px]">
                <li>User profile will be permanently anonymized</li>
                <li>Personal data (name, email, phone) will be removed</li>
                <li>Transaction history will be preserved for audit purposes</li>
                <li>User will not be able to log in</li>
              </ul>
            </div>

            {!confirming && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reason">Deletion Reason (Optional)</Label>
                    <Input
                      id="reason"
                      placeholder="e.g., User requested deletion upon graduation"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={loading}
                      className="h-9"
                    />
                  </div>

                {error && (
                  <div className="status-danger rounded-md p-2 text-xs">
                    {error}
                  </div>
                )}
              </>
            )}

            {confirming && (
              <div className="space-y-4">
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-yellow-900">
                    Final Confirmation Required
                  </p>
                  <p className="mb-2 text-[11px] text-yellow-800">
                    To proceed with anonymization, type <strong>DELETE</strong> in
                    the field below:
                  </p>
                  <Input
                    placeholder='Type "DELETE" to confirm'
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                    disabled={loading}
                    className="h-9 rounded-md border-border font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="status-success rounded-md p-3">
              <p className="mb-2 text-xs font-semibold">
                ✓ User Profile Anonymized
              </p>
              <div className="space-y-1 font-mono text-[11px]">
                <p>
                  <span className="font-bold">User ID:</span> {result.user_id}
                </p>
                <p>
                  <span className="font-bold">Deleted At:</span> {result.deleted_at}
                </p>
                <p>
                  <span className="font-bold">Retained Records:</span>{" "}
                  {result.retained_borrow_count} borrow records
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!result && (
            <>
              <Button
                onClick={() => {
                  if (confirming) {
                    setConfirming(false);
                  } else {
                    setOpen(false);
                    resetForm();
                  }
                }}
                variant="outline"
                disabled={loading}
                className="h-8 rounded-md px-3 text-xs"
              >
                {confirming ? "Back" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  if (confirming) {
                    handleSubmit();
                  } else {
                    setConfirming(true);
                  }
                }}
                disabled={loading}
                className="h-8 rounded-md bg-destructive px-3 text-xs text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : confirming ? (
                  "Proceed with Anonymization"
                ) : (
                  "Continue"
                )}
              </Button>
            </>
          )}
          {result && (
              <Button
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="h-8 w-full rounded-md px-3 text-xs"
              >
                Close
              </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
