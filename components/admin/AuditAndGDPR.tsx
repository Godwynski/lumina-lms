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
          placeholder="Filter by entity type or action..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg"
        />
        <Button
          onClick={fetchAuditLogs}
          variant="outline"
          className="rounded-lg"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
          <p className="text-zinc-600 mt-2">Loading audit logs...</p>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-zinc-600">No audit logs found</p>
        </Card>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="p-3 border-zinc-200/50">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    <p className="font-semibold text-sm text-zinc-900">
                      {log.action.toUpperCase()}
                    </p>
                    <span className="text-xs font-mono text-zinc-500">
                      {log.entity_type}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="text-xs text-zinc-600 mt-1">{log.reason}</p>
                  )}
                </div>
                <p className="text-xs text-zinc-400 whitespace-nowrap ml-2">
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

export function GDPRHardDeleteDialog({
  userId,
  userName,
}: GDPRHardDeleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<any>(null);
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
        className="bg-red-600 hover:bg-red-700 rounded-lg text-white gap-2"
      >
        <Lock className="h-4 w-4" />
        Request GDPR Hard Delete
      </Button>

      <DialogContent className="rounded-xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            GDPR Right to Erasure
          </DialogTitle>
          <DialogDescription>
            This action will anonymize the user profile and remove personal identifiers.
            {userName && ` Target user: ${userName}`}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-semibold mb-2">
                ⚠️ Warning: This action is irreversible
              </p>
              <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
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
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}
              </>
            )}

            {confirming && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-900 mb-3">
                    Final Confirmation Required
                  </p>
                  <p className="text-xs text-yellow-800 mb-3">
                    To proceed with anonymization, type <strong>DELETE</strong> in
                    the field below:
                  </p>
                  <Input
                    placeholder='Type "DELETE" to confirm'
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                    disabled={loading}
                    className="font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-emerald-900 mb-2">
                ✓ User Profile Anonymized
              </p>
              <div className="text-xs text-emerald-800 space-y-1 font-mono">
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
                className="rounded-lg"
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
                className="bg-red-600 hover:bg-red-700 rounded-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
              className="bg-indigo-600 hover:bg-indigo-700 rounded-lg w-full"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
