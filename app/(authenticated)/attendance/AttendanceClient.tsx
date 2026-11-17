"use client";

import { use, useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { recordAttendanceByCard, getAttendanceHistory } from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Clock, 
  Calendar as CalendarIcon, 
  ScanLine, 
  LogIn, 
  LogOut, 
  Camera, 
  Loader2, 
  RefreshCcw, 
  RefreshCw,
  QrCode,
  Search,
  AlertTriangle,
  Check,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { OverflowActionsMenu } from "@/components/common/OverflowActionsMenu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { useScanner } from "@/hooks/use-scanner";
import { useScanFeedback } from "@/hooks/use-scan-feedback";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTrigger,
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import type { AttendanceRecord } from "@/lib/actions/attendance";

const ALL_HISTORY_STEP = 300;

export function buildAttendanceExportRows(records: AttendanceRecord[]) {
  return records.map((record) => {
    const isNoLogOut = record.notes === "No Log Out";
    return {
      Patron: record.profiles?.full_name || "Patron",
      "Patron ID": record.profiles?.student_id || "—",
      Date: format(new Date(record.check_in_at), "yyyy-MM-dd"),
      "Check In": format(new Date(record.check_in_at), "hh:mm a"),
      "Check Out": record.check_out_at
        ? format(new Date(record.check_out_at), "hh:mm a")
        : "Still in library",
      Status: isNoLogOut
        ? "No Log Out"
        : record.check_out_at
          ? "Completed"
          : "Active",
      Notes: record.notes || "",
    };
  });
}

export function AttendanceClient({ 
  systemTodayPromise,
  systemAllPromise,
  personalHistoryPromise,
  isStaff = false,
  userId
}: { 
  systemTodayPromise?: Promise<AttendanceRecord[]>,
  systemAllPromise?: Promise<AttendanceRecord[]>,
  personalHistoryPromise: Promise<AttendanceRecord[]>,
  isStaff?: boolean,
  userId: string
}) {
  const initialSystemToday = systemTodayPromise ? use(systemTodayPromise) : [];
  const initialSystemAll = systemAllPromise ? use(systemAllPromise) : [];
  const initialPersonal = use(personalHistoryPromise);

  const [systemTodayRecords, setSystemTodayRecords] = useState(initialSystemToday);
  const [systemAllRecords, setSystemAllRecords] = useState(initialSystemAll);
  const [personalRecords, setPersonalRecords] = useState(initialPersonal);

  const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState("");

  // "All History" is loaded in steps. Searching it queries the server so older
  // records beyond the loaded window can still be found.
  const [allLimit, setAllLimit] = useState(ALL_HISTORY_STEP);
  const allLimitRef = useRef(ALL_HISTORY_STEP);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [allSearchResults, setAllSearchResults] = useState<AttendanceRecord[] | null>(null);
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const searchRequestRef = useRef(0);
  const [cardNumber, setCardNumber] = useState("");
  const [mode, setMode] = useState<"in" | "out">("in");
  const [blockedCheckIns, setBlockedCheckIns] = useState<
    Array<{ userId: string; userName: string; identifiers: string[] }>
  >([]);
  const [alreadyInWarning, setAlreadyInWarning] = useState<{
    userId: string;
    userName: string;
    message: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [lastResult, setLastResult] = useState('');
  const scannerSession = useRef(0);

  const [pendingScan, setPendingScan] = useState<string | null>(null);
  const pendingScanRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  const { playScanCue } = useScanFeedback();

  // Pagination states
  const [staffPage, setStaffPage] = useState(1);
  const [personalPage, setPersonalPage] = useState(1);
  const PAGE_SIZE = 10;

  const isIdentifierBlockedForCheckIn = useCallback(
    (raw: string) => {
      const norm = raw.trim().toLowerCase();
      if (!norm) return false;
      return blockedCheckIns.some((entry) => entry.identifiers.includes(norm));
    },
    [blockedCheckIns]
  );

  const isManualCheckInBlocked = mode === "in" && isIdentifierBlockedForCheckIn(cardNumber);
  const isPendingScanCheckInBlocked =
    mode === "in" && pendingScan !== null && isIdentifierBlockedForCheckIn(pendingScan);

  // Clear ALREADY_IN block automatically if today's logs show the patron checked out
  useEffect(() => {
    if (blockedCheckIns.length === 0 || systemTodayRecords.length === 0) return;
    const checkedOutUserIds = new Set<string>();
    for (const entry of blockedCheckIns) {
      const hasOpen = systemTodayRecords.some(
        (r) => r.user_id === entry.userId && r.check_out_at === null
      );
      const hasClosed = systemTodayRecords.some(
        (r) => r.user_id === entry.userId && r.check_out_at !== null
      );
      if (!hasOpen && hasClosed) {
        checkedOutUserIds.add(entry.userId);
      }
    }
    if (checkedOutUserIds.size > 0) {
      setBlockedCheckIns((prev) => prev.filter((e) => !checkedOutUserIds.has(e.userId)));
      setAlreadyInWarning((prev) => (prev && checkedOutUserIds.has(prev.userId) ? null : prev));
    }
  }, [systemTodayRecords, blockedCheckIns]);

  // Process a card scan (manual entry or camera detection)
  const processScan = useCallback(async (scannedValue: string, isManual = false, activeMode: "in" | "out" = mode) => {
    const session = scannerSession.current;
    const clean = scannedValue.trim();
    if (!clean || processingRef.current) return;
    if (activeMode === "in" && isIdentifierBlockedForCheckIn(clean)) return;

    processingRef.current = true;
    const wasPending = pendingScanRef.current === clean;
    if (!isManual) {
      pendingScanRef.current = null;
      setPendingScan(null);
    }

    setIsProcessing(true);
    try {
      const result = await recordAttendanceByCard({
        cardNumber: clean,
        mode: activeMode,
        isManual,
      });

      if (result.success) {
        const { status, outcome, message, description, userName, userId: targetUserId, recordedAt } = result.data;
        const normClean = clean.toLowerCase();

        if (status === "ALREADY_IN") {
          playScanCue("error");
          const matchingRecord = systemTodayRecords.find((r) => r.user_id === targetUserId);
          const extraId = matchingRecord?.profiles?.student_id?.trim().toLowerCase();
          const newIdentifiers = Array.from(new Set([normClean, ...(extraId ? [extraId] : [])]));

          setBlockedCheckIns((prev) => {
            const existing = prev.find((e) => e.userId === targetUserId);
            if (existing) {
              return prev.map((e) =>
                e.userId === targetUserId
                  ? { ...e, identifiers: Array.from(new Set([...e.identifiers, ...newIdentifiers])) }
                  : e
              );
            }
            return [...prev, { userId: targetUserId, userName, identifiers: newIdentifiers }];
          });
          setAlreadyInWarning({ userId: targetUserId, userName, message });
          if (!isManual && wasPending) {
            pendingScanRef.current = clean;
            setPendingScan(clean);
          }
          if (!isManual && session === scannerSession.current) {
            setLastResult(message);
          }
          toast.error(message, { id: "attendance-toast-error", description });
          return;
        }

        if (status === "NOT_CHECKED_IN") {
          playScanCue("error");
          if (!isManual && session === scannerSession.current) {
            setLastResult(message);
          }
          toast.error(message, { id: "attendance-toast-error", description });
          return;
        }

        playScanCue("success");
        if (status === "OUT") {
          setBlockedCheckIns((prev) =>
            prev.filter((e) => e.userId !== targetUserId && !e.identifiers.includes(normClean))
          );
          setAlreadyInWarning((prev) => (prev && prev.userId === targetUserId ? null : prev));
        } else if (status === "IN") {
          setAlreadyInWarning((prev) => (prev && prev.userId === targetUserId ? null : prev));
        }

        if (!isManual && session === scannerSession.current && recordedAt) {
          const time = new Date(recordedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Manila",
          });
          setLastResult(`${userName} · ${description.replace(/ successfully|\.$/g, "")} · ${time}`);
        }
        if (isManual) {
          toast.success(outcome === "UPDATED" ? "Check-in updated" : "Transaction recorded", {
            id: "attendance-toast",
            description: message,
            icon: status === "IN" ? <LogIn className="w-4 h-4 text-green-500" /> : <LogOut className="w-4 h-4 text-orange-500" />,
          });
          setCardNumber("");
        }

        // Instantly refresh records so local state updates immediately without waiting for websocket
        const [freshToday, freshAll] = await Promise.all([
          getAttendanceHistory(undefined, { range: "today" }),
          getAttendanceHistory(undefined, { range: "all", limit: allLimitRef.current }),
        ]);
        setSystemTodayRecords(freshToday);
        setSystemAllRecords(freshAll);
      } else {
        playScanCue("error");
        if (!isManual && session === scannerSession.current) setLastResult(result.error);
        toast.error(result.error, { id: "attendance-toast-error" });
      }
    } catch {
      playScanCue("error");
      if (!isManual && session === scannerSession.current) setLastResult("Could not verify this scan. Check the attendance log before retrying.");
      toast.error("Failed to process attendance transaction.", { id: "attendance-toast-err" });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [mode, isIdentifierBlockedForCheckIn, playScanCue, systemTodayRecords]);

  // Unified camera scanner using useScanner
  const {
    cameraOpen,
    startScanner,
    stopCamera,
    isInitializing,
    cameraIssue,
    switchCamera,
    hasMultipleCameras,
    scannerId,
  } = useScanner({
    onScan: async (val) => {
      const value = val.trim();
      if (!value || pendingScanRef.current || processingRef.current) return;
      pendingScanRef.current = value;
      setPendingScan(value);
      setLastResult('');
    },
    isProcessing: isProcessing || pendingScan !== null,
    scannerId: 'attendance-kiosk-scanner'
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber.trim() || isManualCheckInBlocked) return;
    void processScan(cardNumber.trim(), true, mode);
  };

  // Realtime subscription to refresh attendance logs across tabs automatically
  useEffect(() => {
    const supabase = createClient();
    const channelName = `attendance-updates-${Math.random().toString(36).slice(2, 7)}`;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let pending = false;

    const executeRefresh = async () => {
      if (cancelled) return;
      if (inFlight) {
        pending = true;
        return;
      }
      inFlight = true;
      try {
        if (isStaff) {
          const [freshToday, freshAll] = await Promise.all([
            getAttendanceHistory(undefined, { range: 'today' }),
            getAttendanceHistory(undefined, { range: 'all', limit: allLimitRef.current }),
          ]);
          if (cancelled) return;
          setSystemTodayRecords(freshToday);
          setSystemAllRecords(freshAll);
        } else {
          const freshPersonal = await getAttendanceHistory(userId);
          if (cancelled) return;
          setPersonalRecords(freshPersonal);
        }
      } catch (error) {
        console.error("Failed to refresh attendance logs:", error);
      } finally {
        inFlight = false;
        if (pending && !cancelled) {
          pending = false;
          void executeRefresh();
        }
      }
    };

    const refreshLogs = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void executeRefresh();
      }, 300);
    };

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance' 
      }, refreshLogs)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'profiles' 
      }, refreshLogs)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [isStaff, userId]);

  // Reset staff page when switching tabs or typing search
  useEffect(() => {
    setStaffPage(1);
  }, [activeTab, searchQuery]);

  // Server-side search for All History (debounced; older responses ignored).
  useEffect(() => {
    const q = searchQuery.trim();
    const requestId = ++searchRequestRef.current;
    if (!isStaff || activeTab !== 'all' || !q) {
      setAllSearchResults(null);
      setIsSearchingAll(false);
      return;
    }
    setIsSearchingAll(true);
    const timer = setTimeout(async () => {
      try {
        const results = await getAttendanceHistory(undefined, { range: 'all', limit: allLimit, search: q });
        if (requestId === searchRequestRef.current) setAllSearchResults(results);
      } catch {
        if (requestId === searchRequestRef.current) {
          toast.error("Couldn't search attendance history.", { id: "attendance-search-error" });
        }
      } finally {
        if (requestId === searchRequestRef.current) setIsSearchingAll(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isStaff, activeTab, searchQuery, allLimit]);

  const loadOlderHistory = async () => {
    const nextLimit = allLimitRef.current + ALL_HISTORY_STEP;
    setIsLoadingOlder(true);
    try {
      const records = await getAttendanceHistory(undefined, { range: 'all', limit: nextLimit });
      allLimitRef.current = nextLimit;
      setAllLimit(nextLimit);
      setSystemAllRecords(records);
    } catch {
      toast.error("Couldn't load older records. Please try again.");
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Auto-start scanner when modal opens; teardown camera when modal closes
  useEffect(() => {
    if (isScannerOpen) {
      const timer = setTimeout(() => {
        void startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      void stopCamera();
    }
  }, [isScannerOpen, startScanner, stopCamera]);

  // Compute active & completed stats for today
  const activeCount = useMemo(() => 
    systemTodayRecords.filter(r => !r.check_out_at).length, 
    [systemTodayRecords]
  );
  const completedTodayCount = useMemo(() => 
    systemTodayRecords.filter(r => !!r.check_out_at).length, 
    [systemTodayRecords]
  );

  // Filter staff records by tab & search query
  const filteredStaffRecords = useMemo(() => {
    if (activeTab === 'all' && searchQuery.trim() && allSearchResults) return allSearchResults;
    const base = activeTab === 'today' ? systemTodayRecords : systemAllRecords;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter(r => {
      const name = r.profiles?.full_name?.toLowerCase() || '';
      const sid = r.profiles?.student_id?.toLowerCase() || '';
      return name.includes(q) || sid.includes(q);
    });
  }, [activeTab, systemTodayRecords, systemAllRecords, searchQuery, allSearchResults]);

  const isAllSearch = activeTab === 'all' && searchQuery.trim().length > 0;
  const allWindowFull = isAllSearch
    ? (allSearchResults?.length ?? 0) >= allLimit
    : systemAllRecords.length >= allLimit;

  // Paginated staff records
  const totalStaffItems = filteredStaffRecords.length;
  const totalStaffPages = Math.max(1, Math.ceil(totalStaffItems / PAGE_SIZE));
  const activeStaffPage = Math.min(staffPage, totalStaffPages);
  const paginatedStaffRecords = useMemo(() => {
    const start = (activeStaffPage - 1) * PAGE_SIZE;
    return filteredStaffRecords.slice(start, start + PAGE_SIZE);
  }, [filteredStaffRecords, activeStaffPage]);

  // Paginated personal records (for student view)
  const totalPersonalItems = personalRecords.length;
  const totalPersonalPages = Math.max(1, Math.ceil(totalPersonalItems / PAGE_SIZE));
  const activePersonalPage = Math.min(personalPage, totalPersonalPages);
  const paginatedPersonalRecords = useMemo(() => {
    const start = (activePersonalPage - 1) * PAGE_SIZE;
    return personalRecords.slice(start, start + PAGE_SIZE);
  }, [personalRecords, activePersonalPage]);

  const handleExport = async () => {
    if (filteredStaffRecords.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = buildAttendanceExportRows(filteredStaffRecords);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Logs");
      XLSX.writeFile(workbook, "lumina_attendance_logs.xlsx");
      toast.success(`Exported ${rows.length} attendance record(s).`);
    } catch {
      toast.error("Failed to export attendance logs.");
    } finally {
      setIsExporting(false);
    }
  };

  const scannerControls = (
    <div className="flex flex-col gap-3 w-full">
      {/* Band 1: Gate Desk Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 rounded-2xl border border-border/25 bg-muted/20 p-2 sm:p-2.5">
        <div
          role="group"
          aria-label="Attendance mode"
          className="grid grid-cols-2 sm:inline-flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border/20 w-full sm:w-auto sm:self-start lg:self-auto"
        >
          <button
            type="button"
            onClick={() => setMode("in")}
            aria-pressed={mode === "in"}
            className={cn(
              "h-11 sm:h-7 px-3 sm:px-2.5 text-xs font-bold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 border",
              mode === "in"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm dark:bg-emerald-600 dark:border-emerald-500"
                : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/60"
            )}
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>Check-In</span>
            {mode === "in" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded font-extrabold">
                <Check className="w-2.5 h-2.5" aria-hidden="true" />
                Active
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMode("out")}
            aria-pressed={mode === "out"}
            className={cn(
              "h-11 sm:h-7 px-3 sm:px-2.5 text-xs font-bold rounded-lg transition-all inline-flex items-center justify-center gap-1.5 border",
              mode === "out"
                ? "bg-orange-600 text-white border-orange-600 shadow-sm dark:bg-orange-600 dark:border-orange-500"
                : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/60"
            )}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Check-Out</span>
            {mode === "out" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded font-extrabold">
                <Check className="w-2.5 h-2.5" aria-hidden="true" />
                Active
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:flex-1 lg:justify-end">
          <form aria-label="Log attendance" onSubmit={handleManualSubmit} className="flex items-center gap-1.5 w-full sm:w-auto flex-1 sm:flex-none">
            <div className="relative flex-1 min-w-0 sm:w-52">
              <label htmlFor="attendance-card-id" className="sr-only">Card ID or Patron ID</label>
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                id="attendance-card-id"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Card ID or Patron ID..."
                className="h-11 sm:h-9 pl-8 pr-3 text-xs bg-background rounded-lg border-border/40"
                readOnly={isProcessing}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={isProcessing || !cardNumber.trim() || isManualCheckInBlocked}
              className={cn(
                "h-11 sm:h-9 px-4 sm:px-3.5 font-semibold text-xs rounded-lg shrink-0",
                mode === "in"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-orange-600 hover:bg-orange-700 text-white"
              )}
            >
              {isProcessing ? "Recording…" : mode === "in" ? "Check-In" : "Check-Out"}
            </Button>
          </form>

          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-11 sm:h-9 w-full sm:w-auto justify-center px-3.5 text-xs font-semibold rounded-lg shrink-0 gap-1.5 transition-colors border-border/40 bg-background hover:bg-muted/40"
              disabled={isProcessing}
            >
              <Camera className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-primary" />
              <span>Start camera</span>
            </Button>
          </DialogTrigger>
        </div>
      </div>

      {/* Band 2: Log Tabs, Live Status & Search/Export */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap sm:items-center justify-between gap-2.5 w-full min-w-0">
        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
          <div className="inline-flex items-center bg-muted/40 p-0.5 rounded-xl border border-border/15 flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              aria-pressed={activeTab === 'today'}
              className={cn(
                "flex-1 sm:flex-none justify-center h-11 sm:h-8 px-3 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1.5",
                activeTab === 'today' 
                  ? "bg-background text-foreground shadow-sm font-bold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Today</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none",
                activeTab === 'today' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {systemTodayRecords.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              aria-pressed={activeTab === 'all'}
              className={cn(
                "flex-1 sm:flex-none justify-center h-11 sm:h-8 px-3 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1.5",
                activeTab === 'all' 
                  ? "bg-background text-foreground shadow-sm font-bold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>All History</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none",
                activeTab === 'all' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {systemAllRecords.length}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2.5 h-9 rounded-xl bg-muted/20 border border-border/15 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <strong className="text-foreground">{activeCount}</strong> active
            </span>
            <span className="text-border/60">•</span>
            <span><strong className="text-foreground">{completedTodayCount}</strong> completed</span>
          </div>

          <OverflowActionsMenu
            label="Attendance log actions"
            className="sm:hidden"
            actions={[
              {
                id: "export-attendance",
                label: isExporting ? "Exporting..." : "Export (.xlsx)",
                icon: Download,
                disabled: isExporting || filteredStaffRecords.length === 0,
                onSelect: () => void handleExport(),
              },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-2 sm:hidden px-1 text-[11px] font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <strong className="text-foreground">{activeCount}</strong> active today
          </span>
          <span><strong className="text-foreground">{completedTodayCount}</strong> completed</span>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 sm:flex-initial sm:justify-end">
          <div className="relative flex-1 min-w-0 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search attendance by patron name or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patron or ID..."
              className="h-11 sm:h-9 pl-8 pr-3 text-xs bg-background/50 rounded-xl border-border/25"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex h-9 px-3.5 text-xs font-semibold rounded-xl shrink-0 gap-1.5 border-border/30 hover:bg-muted/40"
            disabled={isExporting || filteredStaffRecords.length === 0}
            onClick={() => void handleExport()}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? "Exporting..." : "Export (.xlsx)"}</span>
          </Button>
        </div>
      </div>

      {alreadyInWarning && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>
              <strong>{alreadyInWarning.message}</strong> — {alreadyInWarning.userName} must check out before checking in again.
            </span>
          </div>
          {mode === "in" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20"
              onClick={() => setMode("out")}
            >
              Switch to Check-Out
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (isStaff) {
    return (
      <Dialog open={isScannerOpen} onOpenChange={(open) => {
        setIsScannerOpen(open);
        if (!open) {
          scannerSession.current++;
          setLastResult('');
          pendingScanRef.current = null;
          setPendingScan(null);
          void stopCamera();
        }
      }}>
        <AdminTableShell
          controls={scannerControls}
          pagination={
            totalStaffItems > 0 ? (
              <CompactPagination
                page={activeStaffPage}
                totalItems={totalStaffItems}
                pageSize={PAGE_SIZE}
                onPageChange={setStaffPage}
                variant="ghost"
              />
            ) : null
          }
          className="max-w-none animate-in fade-in-50 duration-300"
        >
            <DialogContent className="sm:max-w-md p-6 rounded-3xl border border-border/20 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col items-center">
              <DialogHeader className="text-center w-full pb-1">
                <DialogTitle className="text-base font-bold flex items-center justify-center gap-2">
                  <ScanLine className="w-4 h-4 text-primary" />
                  Gate Attendance Scanner
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Active mode: {mode === "in" ? "Check-In" : "Check-Out"}. Read a card, then confirm below.
                </DialogDescription>
              </DialogHeader>

              <div
                role="group"
                aria-label="Scanner attendance mode"
                className="inline-flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/20"
              >
                <button
                  type="button"
                  onClick={() => setMode("in")}
                  aria-pressed={mode === "in"}
                  className={cn(
                    "h-7 px-2.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 border",
                    mode === "in"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm dark:bg-emerald-600 dark:border-emerald-500"
                      : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  <span>Check-In</span>
                  {mode === "in" && (
                    <span className="text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded font-extrabold">
                      Active
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("out")}
                  aria-pressed={mode === "out"}
                  className={cn(
                    "h-7 px-2.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 border",
                    mode === "out"
                      ? "bg-orange-600 text-white border-orange-600 shadow-sm dark:bg-orange-600 dark:border-orange-500"
                      : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Check-Out</span>
                  {mode === "out" && (
                    <span className="text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded font-extrabold">
                      Active
                    </span>
                  )}
                </button>
              </div>

              <div className="relative aspect-square max-w-[280px] mx-auto w-full overflow-hidden rounded-2xl border border-border/15 bg-muted/20 shadow-inner my-2">
                <div 
                  id={scannerId} 
                  className="h-full w-full [&>video]:object-cover [&>video]:h-full [&>video]:w-full" 
                />
                
                {/* Minimalist reticle overlay */}
                <div className="absolute inset-0 pointer-events-none border-[12px] border-background/20 rounded-2xl" />

                {/* Loading or Processing Overlay */}
                {(isProcessing || isInitializing) && (
                  <div role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                    {isInitializing && (
                      <span className="text-[11px] font-bold uppercase tracking-widest text-primary animate-pulse">
                        Initializing...
                      </span>
                    )}
                    {isProcessing && !isInitializing && (
                      <span className="text-[11px] font-bold uppercase tracking-widest text-primary animate-pulse">
                        Recording...
                      </span>
                    )}
                  </div>
                )}

                {/* Inactive State: Start camera or Retry camera */}
                {!cameraOpen && !isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-200">
                    <QrCode className="h-10 w-10 text-muted-foreground/40 mb-4" />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 rounded-xl border-border/40 font-semibold text-xs tracking-wide"
                      onClick={() => startScanner()}
                      disabled={isInitializing}
                    >
                      {cameraIssue ? (
                        <>
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          Retry camera
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-3.5 w-3.5" />
                          Start camera
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Active State: Camera Controls Overlay */}
                {cameraOpen && (
                  <div className="absolute bottom-4 inset-x-4 flex justify-between items-center z-20">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className={cn(
                        "h-9 w-9 rounded-xl backdrop-blur-md bg-background/60 border border-white/10",
                        !hasMultipleCameras && "invisible"
                      )}
                      onClick={switchCamera}
                      aria-label="Switch camera"
                      title="Switch Camera"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </Button>

                    <Button 
                      variant="destructive" 
                      className="h-9 rounded-xl px-4 backdrop-blur-md bg-destructive/90 text-[11px] font-bold uppercase tracking-wider"
                      onClick={() => stopCamera()}
                    >
                      Stop camera
                    </Button>
                  </div>
                )}

                {/* Camera Issue Warning Banner */}
                {cameraIssue && !cameraOpen && !isInitializing && (
                  <div className="absolute top-4 inset-x-4 z-20">
                    <div role="alert" className="bg-destructive/10 border border-destructive/20 backdrop-blur-md rounded-xl p-3 text-[11px] text-destructive font-medium text-center shadow-sm">
                      {cameraIssue}
                    </div>
                  </div>
                )}
              </div>

              {pendingScan && <div className="w-full space-y-3 rounded-xl border border-border p-3">
                <p className="text-center text-sm">Card ready: <span className="font-mono break-all">{pendingScan}</span></p>
                {isPendingScanCheckInBlocked && alreadyInWarning && (
                  <p role="alert" className="text-center text-xs font-medium text-amber-700 dark:text-amber-300">
                    {alreadyInWarning.message} — switch to Check-Out to log out.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={isProcessing} onClick={() => { pendingScanRef.current = null; setPendingScan(null); }}>Discard</Button>
                  <Button
                    type="button"
                    className={cn(
                      "flex-1",
                      mode === "in"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-orange-600 hover:bg-orange-700 text-white"
                    )}
                    disabled={isProcessing || isPendingScanCheckInBlocked}
                    onClick={() => void processScan(pendingScan, false, mode)}
                  >
                    {mode === "in" ? "Register Check-In" : "Register Check-Out"}
                  </Button>
                </div>
              </div>}
              <div role="status" aria-live="polite" className="text-center space-y-1">
                {lastResult && <p className="font-semibold text-foreground">{lastResult}</p>}
                <p className="text-sm text-muted-foreground">
                  {pendingScan ? 'Awaiting librarian confirmation' : cameraOpen && !isProcessing ? 'Ready for next card' : cameraIssue ? 'Close the scanner to enter a card manually.' : ''}
                </p>
              </div>
            </DialogContent>

          <p role="status" className="sr-only">
            {searchQuery.trim() && !isSearchingAll ? `${totalStaffItems} matching attendance records` : ""}
          </p>
          <Suspense fallback={<TableLoadingSkeleton />}>
            <AttendanceTable history={paginatedStaffRecords} isPersonal={false} />
          </Suspense>

          {activeTab === 'all' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-border/10 text-[11px] text-muted-foreground" aria-live="polite">
              <span>
                {isSearchingAll
                  ? "Searching all history..."
                  : isAllSearch
                    ? `Search covers the latest ${allLimit.toLocaleString()} matching records.`
                    : `Showing the latest ${systemAllRecords.length.toLocaleString()} records.`}
              </span>
              {allWindowFull && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  disabled={isLoadingOlder}
                  onClick={() => void loadOlderHistory()}
                >
                  {isLoadingOlder ? "Loading..." : "Load older records"}
                </Button>
              )}
            </div>
          )}
        </AdminTableShell>
      </Dialog>
    );
  }

  // Personal View (Student)
  return (
    <div className="w-full">
      <AdminTableShell
        controls={
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1 py-0.5">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            All-Time History
          </p>
        }
        pagination={
          totalPersonalItems > 0 ? (
            <CompactPagination
              page={activePersonalPage}
              totalItems={totalPersonalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPersonalPage}
              variant="ghost"
            />
          ) : null
        }
        className="max-w-none animate-in fade-in-50 duration-300"
      >
        <Suspense fallback={<TableLoadingSkeleton />}>
          <AttendanceTable history={paginatedPersonalRecords} isPersonal={true} />
        </Suspense>
      </AdminTableShell>
    </div>
  );
}

function TableLoadingSkeleton() {
  return (
    <div className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p role="status" className="text-xs font-bold uppercase tracking-widest">Syncing logs…</p>
    </div>
  );
}

function AttendanceTable({ 
  history, 
  isPersonal = false
}: { 
  history: AttendanceRecord[],
  isPersonal?: boolean
}) {
  const columns = useMemo<LuminaColumn<AttendanceRecord>[]>(() => {
    const cols: LuminaColumn<AttendanceRecord>[] = [];
    
    if (!isPersonal) {
      cols.push({
        header: "User",
        cell: (record) => (
          <div className="flex items-center gap-3">
            <Avatar aria-hidden="true" className="h-8 w-8">
              <AvatarFallback className="bg-muted text-muted-foreground text-[11px] font-bold">
                {(record.profiles?.full_name || "Student").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground text-xs">{record.profiles?.full_name || "Student"}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                {record.profiles?.student_id ? record.profiles.student_id : format(new Date(record.check_in_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        )
      });
    }

    cols.push({
      header: "Date",
      className: "w-[130px]",
      cell: (record) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <span>{format(new Date(record.check_in_at), "MMM dd, yyyy")}</span>
        </div>
      )
    });

    cols.push(
      {
        header: "Check In",
        className: "w-[120px]",
        cell: (record) => (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <LogIn className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
            <span>{format(new Date(record.check_in_at), "hh:mm a")}</span>
          </div>
        )
      },
      {
        header: "Check Out",
        className: "w-[210px]",
        cell: (record) => (
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium">
            {record.check_out_at ? (
              <>
                <LogOut className="w-3.5 h-3.5 text-orange-500/80 shrink-0" />
                <span>{format(new Date(record.check_out_at), "hh:mm a")}</span>
                {record.notes === "No Log Out" && <NoLogOutBadge />}
              </>
            ) : (
              <StillInLibraryBadge />
            )}
          </div>
        )
      }
    );

    return cols;
  }, [isPersonal]);

  return (
    <LuminaTable
      data={history}
      columns={columns}
      isLoading={false}
      noBorder
      emptyState={{
        title: "No logs found",
        description: "There are no attendance records matching this view.",
        icon: Clock
      }}
      renderMobileRow={(record) => (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {!isPersonal ? (
              <>
                <Avatar aria-hidden="true" className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                    {(record.profiles?.full_name || "S").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{record.profiles?.full_name || "Student"}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {record.profiles?.student_id || format(new Date(record.check_in_at), "MMM dd")}
                    </span>
                    <span className="text-muted-foreground/40 text-xs" aria-hidden="true">•</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <LogIn className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>In: {format(new Date(record.check_in_at), "hh:mm a")}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">
                  {format(new Date(record.check_in_at), "MMMM dd, yyyy")}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium whitespace-nowrap">
                    <LogIn className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>In: {format(new Date(record.check_in_at), "hh:mm a")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {record.check_out_at ? (
              <>
                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium whitespace-nowrap">
                  <LogOut className="w-3 h-3 text-orange-600 shrink-0" aria-hidden="true" />
                  <span>Out: {format(new Date(record.check_out_at), "hh:mm a")}</span>
                </div>
                {record.notes === "No Log Out" && <NoLogOutBadge />}
              </>
            ) : (
              <StillInLibraryBadge />
            )}
          </div>
        </div>
      )}
    />
  );
}

function NoLogOutBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider text-[11px] bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
      No Log Out
    </span>
  );
}

function StillInLibraryBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Still in library
    </span>
  );
}
