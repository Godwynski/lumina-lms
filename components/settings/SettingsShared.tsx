"use client";

import * as React from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { LucideIcon, Loader2, HelpCircle, Download, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldGroup } from "@/components/common/FieldGroup";
import {
  getMinArchiveCutoffDate,
  getSchoolYearCutoffOptions,
  parseArchiveCutoffDate,
} from "@/lib/archive";
export { FieldGroup };

export const Section = memo(({ 
  title, 
  icon: Icon, 
  children, 
  danger, 
  hideHeaderOnMobile 
}: { 
  title?: string; 
  icon?: LucideIcon; 
  children: React.ReactNode; 
  danger?: boolean; 
  hideHeaderOnMobile?: boolean 
}) => {
  return (
    <div className={cn("space-y-4", hideHeaderOnMobile && "md:mt-4")}>
      {title && Icon && (
        <div className={cn(
          "flex items-center gap-2 border-b border-border/40 pb-3",
          hideHeaderOnMobile && "hidden md:flex"
        )}>
          <Icon size={16} className={cn(danger ? "text-red-500" : "text-muted-foreground/60")} />
          <h2 className={cn("text-sm font-medium", danger ? "text-red-600" : "text-foreground")}>{title}</h2>
        </div>
      )}
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-400">{children}</div>
    </div>
  );
});
Section.displayName = "Section";


export function AnnualResetTool() {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm("This will suspend all student accounts. Proceed?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/annual-reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Reset complete.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium">Batch Account Reset</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors grid size-6 place-items-center" aria-label="Batch reset info">
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                Temporarily freezes student accounts at the end of the academic year until their enrollment is renewed for the next school term.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            Suspends all student accounts for the new academic year.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={handleReset} 
              disabled={isResetting}
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs font-medium"
            >
              {isResetting ? "Resetting..." : "Execute Reset"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Start the end-of-year student account freeze.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

interface ArchivePreviewCounts {
  before: string;
  borrowingCount: number;
  attendanceCount: number;
  totalCount: number;
}

export function ArchiveLogsTool() {
  const minCutoff = useMemo(() => getMinArchiveCutoffDate(), []);
  const schoolYearOptions = useMemo(() => getSchoolYearCutoffOptions(), []);

  const [cutoffDate, setCutoffDate] = useState("");
  const [counts, setCounts] = useState<ArchivePreviewCounts | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [backupDownloadedFor, setBackupDownloadedFor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parsedCutoff = useMemo(
    () => (cutoffDate ? parseArchiveCutoffDate(cutoffDate) : null),
    [cutoffDate]
  );

  const fetchPreviewCounts = React.useCallback(async (before: string, signal?: AbortSignal) => {
    setIsLoadingCounts(true);
    setPreviewError(null);
    try {
      const res = await fetch(
        `/api/admin/archive?before=${encodeURIComponent(before)}&preview=true`,
        { signal }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load eligible counts");
      }
      if (!signal?.aborted) {
        setCounts({
          before: data.before ?? before,
          borrowingCount: Number(data.borrowingCount ?? 0),
          attendanceCount: Number(data.attendanceCount ?? 0),
          totalCount: Number(data.totalCount ?? 0),
        });
      }
    } catch (err) {
      if (signal?.aborted) return;
      setCounts(null);
      setPreviewError(err instanceof Error ? err.message : "Failed to load eligible counts");
    } finally {
      if (!signal?.aborted) {
        setIsLoadingCounts(false);
      }
    }
  }, []);

  useEffect(() => {
    setBackupDownloadedFor(null);
    setCounts(null);

    if (!cutoffDate) {
      setPreviewError(null);
      return;
    }

    if (!parsedCutoff || !parsedCutoff.ok) {
      setPreviewError(parsedCutoff ? parsedCutoff.error : "Invalid cutoff date.");
      return;
    }

    const controller = new AbortController();
    void fetchPreviewCounts(parsedCutoff.before, controller.signal);
    return () => controller.abort();
  }, [cutoffDate, parsedCutoff, fetchPreviewCounts]);

  const handleDownloadBackup = async () => {
    if (!parsedCutoff || !parsedCutoff.ok) return;

    setIsDownloading(true);
    try {
      const res = await fetch(
        `/api/admin/archive?before=${encodeURIComponent(parsedCutoff.before)}`
      );
      if (!res.ok) {
        let message = "Backup download failed";
        try {
          const errData = await res.json();
          if (errData?.error) message = errData.error;
        } catch {
          // ignore non-JSON error body
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lumina-archive-before-${parsedCutoff.before}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setBackupDownloadedFor(parsedCutoff.before);
      toast.success("Backup downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!parsedCutoff || !parsedCutoff.ok || backupDownloadedFor !== parsedCutoff.before) {
      return;
    }

    setIsArchiving(true);
    try {
      const res = await fetch("/api/admin/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before: parsedCutoff.before }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Archive failed");
      }

      const borrowingCount = Number(data.borrowingCount ?? 0);
      const attendanceCount = Number(data.attendanceCount ?? 0);
      toast.success(
        `Archived ${borrowingCount} borrowing record(s) and ${attendanceCount} attendance log(s).`
      );
      setConfirmOpen(false);
      setBackupDownloadedFor(null);
      await fetchPreviewCounts(parsedCutoff.before);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setIsArchiving(false);
    }
  };

  const validBefore = parsedCutoff?.ok ? parsedCutoff.before : null;
  const isDateValid = validBefore !== null;
  const canDownload = isDateValid && !isLoadingCounts && !isDownloading && !isArchiving;
  const canArchive =
    isDateValid &&
    counts !== null &&
    counts.totalCount > 0 &&
    backupDownloadedFor === validBefore &&
    !isDownloading &&
    !isArchiving;

  return (
    <TooltipProvider>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium">Archive Old Records</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors grid size-6 place-items-center"
                  aria-label="Archive old records info"
                >
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                Exports completed borrowing and attendance records older than 1 year to Excel, then moves them to archive tables. Open loans, lost books, and unsettled fines are preserved.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            Export and archive completed records strictly before a school-year cutoff (at least 1 year old).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {schoolYearOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={cutoffDate === opt.value ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-lg text-[11px]"
              onClick={() => setCutoffDate(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="archive-cutoff-date" className="block text-xs font-medium text-foreground">
              Cutoff date
            </label>
            <Input
              id="archive-cutoff-date"
              type="date"
              aria-label="Archive cutoff date"
              max={minCutoff}
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
              className="h-9 w-full sm:w-[200px] rounded-xl text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canDownload}
              onClick={handleDownloadBackup}
              className="h-9 rounded-xl text-xs font-medium gap-1.5"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>{isDownloading ? "Downloading..." : "Download backup"}</span>
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!canArchive}
              onClick={() => setConfirmOpen(true)}
              className="h-9 rounded-xl text-xs font-medium gap-1.5"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archive</span>
            </Button>
          </div>
        </div>

        {previewError && (
          <p role="alert" className="text-xs text-destructive">
            {previewError}
          </p>
        )}

        {isLoadingCounts && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Counting eligible records...</span>
          </p>
        )}

        {!isLoadingCounts && counts && (
          <div className="rounded-xl border border-border/50 bg-background/60 p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">
              Eligible records before {counts.before}: {counts.totalCount}
            </p>
            <p className="text-muted-foreground">
              {counts.borrowingCount} borrowing record(s) · {counts.attendanceCount} attendance log(s)
            </p>
            {counts.totalCount === 0 ? (
              <p className="text-muted-foreground">No eligible records found before this cutoff.</p>
            ) : backupDownloadedFor === counts.before ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                Backup downloaded. Archive is now enabled.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Download backup before archiving.
              </p>
            )}
          </div>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Record Archive</DialogTitle>
              <DialogDescription>
                {counts
                  ? `Move ${counts.borrowingCount} borrowing record(s) and ${counts.attendanceCount} attendance log(s) strictly before ${counts.before} into the archive tables? Active loans, lost items, and unsettled fines will be preserved.`
                  : "Confirm archiving eligible historical records."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isArchiving}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isArchiving}
                onClick={handleConfirmArchive}
              >
                {isArchiving ? "Archiving..." : "Confirm Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export function RunMaintenanceTool() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRun = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/notifications/maintenance", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.errors?.length) {
        toast.error(`Dispatch completed with errors: ${data.errors.join(" ")}`);
      } else {
        toast.success(`Dispatch complete: ${data.remindersSent} reminders and ${data.overdueTagged} overdue notices processed.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium text-foreground">Email Dispatch</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors grid size-6 place-items-center" aria-label="Email dispatch info">
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                Immediately triggers the automated background check for due-soon and overdue books, sending email notifications to affected students.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            Triggers overdue checks and sends notification emails.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={handleRun} 
              disabled={isProcessing}
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs font-medium"
            >
              {isProcessing ? "Processing..." : "Run Task"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Scan borrowing records and send pending overdue notifications.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export function TestEmailTool() {
  const [isSending, setIsSending] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [emailType, setEmailType] = useState("test");

  const handleTest = async () => {
    if (!targetEmail.trim()) {
      toast.error("Please enter an email address first.");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/test-email", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim(), type: emailType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Test email sent! Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed", {
        duration: 8000,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-foreground">Email Configuration Test</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors grid size-6 place-items-center" aria-label="Email test info">
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                Send a real test email to verify your SMTP mail server settings and layout formatting.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            Send a diagnostic email to verify SMTP connectivity, credentials, and message delivery.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Input 
            type="email"
            placeholder="Recipient email address" 
            aria-label="Recipient email address"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            className="h-9 text-xs sm:max-w-[250px] rounded-xl"
          />
          <Select value={emailType} onValueChange={setEmailType}>
            <SelectTrigger aria-label="Email Type" className="h-9 w-full sm:w-[190px] text-xs rounded-xl">
              <SelectValue placeholder="Email Type" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="test" className="text-xs">Diagnostic System Test</SelectItem>
              <SelectItem value="overdue" className="text-xs">Overdue Notice Template</SelectItem>
              <SelectItem value="due_soon" className="text-xs">Due Soon Notice Template</SelectItem>
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleTest} 
                disabled={isSending || !targetEmail.trim()}
                variant="secondary"
                size="sm"
                className="h-9 rounded-xl text-xs font-semibold shrink-0"
              >
                {isSending ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : "Send Test Email"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Dispatch the selected template to the recipient email.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
