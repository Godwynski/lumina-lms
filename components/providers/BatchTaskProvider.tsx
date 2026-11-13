"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, startTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Clock, X, ChevronUp, ChevronDown, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/PreferencesProvider";

interface ImportItem {
  id: string;
  isbn: string | null;
  book_id: string | null;
  status: "queued" | "processing" | "retry" | "complete" | "review" | "failed";
  metadata_status: "pending" | "complete" | "missing";
  cover_status: "pending" | "complete" | "missing";
  title: string | null;
  attempts: number;
  error: string | null;
  next_attempt_at: string | null;
}
interface ImportJob { id: string; label: string; created_at: string; items: ImportItem[] }
interface IsbnLog { isbn: string; status: "success" | "exists" | "error" | "pending"; message: string }
interface BatchTaskContextType {
  isISBNProcessing: boolean;
  isbnProgress: { current: number; total: number; currentIsbn: string };
  isbnLogs: IsbnLog[];
  startISBNLookup: (isbnList: string[]) => Promise<void>;
  refreshJobs: (jobId?: string) => Promise<void>;
  clearTask: () => void;
}
const BatchTaskContext = createContext<BatchTaskContextType | undefined>(undefined);
const dismissedKey = "catalog-import-dismissed-job";
const isActive = (item: ImportItem) => ["queued", "processing", "retry"].includes(item.status);
const needsReview = (item: ImportItem) => item.status === "review" || (item.status === "complete" && (item.metadata_status !== "complete" || item.cover_status !== "complete"));
const activeJob = (job: ImportJob) => job.items.some(isActive);
const itemLabel = (item: ImportItem) => item.isbn || item.title || "No ISBN";

async function request(url: string, body?: object) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not update the import queue. Please try again.");
  return result;
}

export function useBatchTask() {
  const context = useContext(BatchTaskContext);
  if (!context) throw new Error("useBatchTask must be used within a BatchTaskProvider");
  return context;
}

export function BatchTaskProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(Date.now);
  const router = useRouter();
  const { role, profile } = usePreferences();
  const canManageImports = (role === "super_admin" || role === "librarian")
    && (profile?.status == null || profile.status.toUpperCase() === "ACTIVE");
  const accessEpoch = useRef(0);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const submitting = useRef(false);
  const previousJobs = useRef<ImportJob[]>([]);

  const wakeWorker = useCallback(async () => {
    if (!canManageImports) return;
    const epoch = accessEpoch.current;
    try {
      await request("/api/catalog/import-jobs/process", {});
    } catch (error) {
      if (epoch !== accessEpoch.current) return;
      setQueueError(error instanceof Error ? error.message : "Could not wake the import worker. The job remains saved.");
    }
  }, [canManageImports]);

  const refreshJobs = useCallback(async (jobId?: string) => {
    if (!canManageImports) return;
    const epoch = accessEpoch.current;
    try {
      const result = await request("/api/catalog/import-jobs");
      if (epoch !== accessEpoch.current) return;
      const next: ImportJob[] = result.jobs;
      const finished = next.filter(job => !activeJob(job) && previousJobs.current.some(previous => previous.id === job.id && activeJob(previous)));
      if (finished.length) {
        startTransition(() => router.refresh());
        const warning = finished.some(job => job.items.some(item => item.status === "failed" || needsReview(item)));
        if (warning) toast.warning("Catalog import finished with items needing attention. Review metadata and covers.");
        else toast.success("Catalog import complete. Metadata and covers are ready.");
      }
      const newActiveJob = next.find(candidate => activeJob(candidate) && !previousJobs.current.some(previous => previous.id === candidate.id));
      if (!jobId && newActiveJob) setSelectedId(newActiveJob.id);
      previousJobs.current = next;
      setJobs(next);
      setQueueError("");
      if (jobId) { setSelectedId(jobId); void wakeWorker(); }
    } catch (error) {
      if (epoch !== accessEpoch.current) return;
      setQueueError(error instanceof Error ? error.message : "Could not load import jobs. Please try again.");
    }
  }, [router, wakeWorker, canManageImports]);

  useEffect(() => {
    if (!canManageImports) {
      previousJobs.current = [];
      submitting.current = false;
      setJobs([]);
      setQueueError("");
      setSelectedId(null);
      setDismissedId(null);
      setIsSubmitting(false);
      setIsExpanded(false);
      return;
    }
    try { setDismissedId(localStorage.getItem(dismissedKey)); } catch { /* Storage may be disabled. */ }
    void refreshJobs();
    return () => { accessEpoch.current += 1; };
  }, [refreshJobs, canManageImports]);

  const hasActiveJobs = canManageImports && jobs.some(activeJob);
  const hasReadyItems = canManageImports && jobs.some(job => job.items.some(item => item.status === "queued" || item.status === "retry" && new Date(item.next_attempt_at || 0).getTime() <= now));
  useEffect(() => {
    if (!hasActiveJobs) return;
    void wakeWorker();
    const timer = setInterval(() => { setNow(Date.now()); void refreshJobs(); }, 3000);
    const resume = () => { void refreshJobs(); void wakeWorker(); };
    window.addEventListener("focus", resume);
    return () => { clearInterval(timer); window.removeEventListener("focus", resume); };
  }, [hasActiveJobs, hasReadyItems, refreshJobs, wakeWorker]);

  const job = canManageImports ? (jobs.find(candidate => candidate.id === selectedId && (candidate.id !== dismissedId || activeJob(candidate)))
    || jobs.find(activeJob)
    || (jobs[0]?.id !== dismissedId ? jobs[0] : undefined)) : undefined;
  const items = job?.items || [];
  const processing = !!job && activeJob(job);
  const activeItems = items.filter(isActive);
  const waiting = activeItems.length > 0 && activeItems.every(item => item.status === "retry" && new Date(item.next_attempt_at || 0).getTime() > now);
  const nextRetry = waiting ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(Math.min(...activeItems.map(item => new Date(item.next_attempt_at!).getTime()))) : null;
  const completeCount = items.filter(item => item.status === "complete" && !needsReview(item)).length;
  const reviewCount = items.filter(needsReview).length;
  const failedCount = items.filter(item => item.status === "failed").length;
  const currentItem = items.find(isActive);
  const isbnProgress = { current: items.filter(item => !isActive(item)).length, total: items.length, currentIsbn: currentItem ? itemLabel(currentItem) : "" };
  const isbnLogs: IsbnLog[] = items.map(item => ({
    isbn: itemLabel(item),
    status: isActive(item) ? "pending" : item.status === "failed" ? "error" : needsReview(item) ? "exists" : "success",
    message: `${itemLabel(item)}${item.isbn && item.title ? ` — ${item.title}` : ""}: ${item.status}. Metadata: ${item.metadata_status}. Cover: ${item.cover_status}.${item.error ? ` ${item.error}` : ""}${item.status === "retry" && item.next_attempt_at ? ` Retry after ${new Date(item.next_attempt_at).toLocaleString()}.` : ""}`,
  }));

  const clearTask = useCallback(() => {
    if (!job || processing) return;
    try { localStorage.setItem(dismissedKey, job.id); } catch { /* Dismissal still works in this tab. */ }
    setDismissedId(job.id);
    setSelectedId(null);
    setIsExpanded(false);
  }, [job, processing]);

  const submitJob = async (body: { isbns: string[]; requestId: string } | { retryJobId: string }) => {
    if (!canManageImports || submitting.current) return;
    const epoch = accessEpoch.current;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      const result = await request("/api/catalog/import-jobs", body);
      if (epoch !== accessEpoch.current) return;
      setSelectedId(result.jobId);
      setDismissedId(null);
      setIsExpanded(false);
      await refreshJobs(result.jobId);
      if (epoch !== accessEpoch.current) return;
      toast.info("Import saved to the queue. You can close this tab while it runs.");
    } catch (error) {
      if (epoch !== accessEpoch.current) return;
      toast.error(error instanceof Error ? error.message : "Could not queue the import. Please try again.");
    } finally {
      if (epoch === accessEpoch.current) { submitting.current = false; setIsSubmitting(false); }
    }
  };
  const startISBNLookup = async (isbns: string[]) => {
    if (!canManageImports) return;
    if (!isbns.length || isbns.length > 500) { toast.error("Enter between 1 and 500 ISBN entries per import."); return; }
    await submitJob({ isbns, requestId: crypto.randomUUID() });
  };
  const warning = reviewCount + failedCount > 0;

  return (
    <BatchTaskContext.Provider value={{ isISBNProcessing: canManageImports && (isSubmitting || hasActiveJobs), isbnProgress, isbnLogs, startISBNLookup, refreshJobs, clearTask }}>
      {children}
      {job && (
        <aside aria-label="Catalog import progress" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-lg">
          <div className="bg-background/95 backdrop-blur-xl border border-border/20 shadow-2xl rounded-3xl overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-3">
              <button type="button" aria-label={isExpanded ? "Collapse import details" : "Expand import details"} aria-expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3 text-left min-w-0 flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shrink-0", processing ? "bg-primary/10 text-primary" : warning ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
                  {waiting ? <Clock className="h-5 w-5" /> : processing ? <Loader2 className="h-5 w-5 animate-spin" /> : warning ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{waiting ? "Waiting for provider" : processing ? "Catalog import in progress" : warning ? "Catalog import needs attention" : "Catalog import complete"}</span>
                  <span role="status" className="block text-xs text-muted-foreground mt-0.5">{waiting ? `Next retry: ${nextRetry} · Manila time` : processing ? `${isbnProgress.current} of ${isbnProgress.total} finished` : `${completeCount} complete · ${reviewCount} need review · ${failedCount} failed`}</span>
                </span>
                {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronUp className="h-4 w-4 shrink-0" />}
              </button>
              {!processing && <button type="button" aria-label="Dismiss completed import" onClick={clearTask} className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"><X className="h-4 w-4" /></button>}
            </div>
            {processing && <div role="progressbar" aria-label="Import items finished" aria-valuenow={isbnProgress.current} aria-valuemin={0} aria-valuemax={isbnProgress.total} className="h-1 w-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${Math.max(2, isbnProgress.current / (isbnProgress.total || 1) * 100)}%` }} /></div>}
            {isExpanded && <div className="p-4 border-t border-border/10 space-y-3">
              <p className="text-xs text-muted-foreground">Saved imports continue on the server when this tab closes. Missing metadata or covers need review.</p>
              {jobs.length > 1 && <label className="block text-xs text-muted-foreground">Recent imports<select aria-label="Recent imports" value={job.id} onChange={event => { setSelectedId(event.target.value); setDismissedId(null); }} className="block mt-1 w-full bg-background border border-border rounded-lg p-2 text-foreground">{jobs.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.label} — {new Date(candidate.created_at).toLocaleString()}</option>)}</select></label>}
              {queueError && <p role="alert" className="text-xs text-destructive">{queueError} <button type="button" className="underline" onClick={() => { void refreshJobs(); void wakeWorker(); }}>Reconnect</button></p>}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ListPlus className="h-3.5 w-3.5" /> {items.length} items</div>
              <ul className="max-h-52 overflow-y-auto space-y-2 text-xs">
                {isbnLogs.map((log, index) => <li key={items[index].id} className={cn("p-2 rounded-xl break-words", log.status === "success" ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" : log.status === "exists" ? "bg-amber-500/5 text-amber-700 dark:text-amber-400" : log.status === "error" ? "bg-destructive/5 text-destructive" : "bg-muted/40 text-muted-foreground")}>{log.message}</li>)}
              </ul>
              {warning && <button type="button" disabled={isSubmitting || processing} onClick={() => void submitJob({ retryJobId: job.id })} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary">{isSubmitting ? "Queuing retry..." : "Retry failed items"}</button>}
            </div>}
          </div>
        </aside>
      )}
    </BatchTaskContext.Provider>
  );
}
