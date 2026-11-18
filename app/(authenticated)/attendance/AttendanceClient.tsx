"use client";

import { use, useState, useRef, useEffect, useMemo, useCallback, Suspense, type FormEvent, type KeyboardEvent } from "react";
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
  ChevronDown,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
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
import { isWithinManilaDateRange } from "@/lib/date-range";

const ALL_HISTORY_STEP = 300;
const INITIAL_HISTORY_REQUEST = { search: '', from: '', to: '', limit: ALL_HISTORY_STEP };
const EMPTY_HISTORY: AttendanceRecord[] = [];
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
});

function sameHistoryFilters(first: typeof INITIAL_HISTORY_REQUEST, second: typeof INITIAL_HISTORY_REQUEST) {
  return first.search === second.search && first.from === second.from && first.to === second.to;
}

type AttendanceMode = "in" | "out";

const ATTENDANCE_MODES = [
  { value: "in", label: "Check-In", Icon: LogIn },
  { value: "out", label: "Check-Out", Icon: LogOut },
] as const;

function AttendanceModeControl({ label, mode, onChange }: {
  label: string;
  mode: AttendanceMode;
  onChange: (mode: AttendanceMode) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-fit">
      {ATTENDANCE_MODES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={mode === value}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors xl:h-10",
            mode === value ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
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
  const [personalRecords, setPersonalRecords] = useState(initialPersonal);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState("");
  const [historyRequest, setHistoryRequest] = useState(INITIAL_HISTORY_REQUEST);
  const [historyResponse, setHistoryResponse] = useState({
    request: INITIAL_HISTORY_REQUEST, records: initialSystemAll, failed: false,
  });
  const latestHistoryRequest = useRef(INITIAL_HISTORY_REQUEST);
  const historyFetchId = useRef<symbol | null>(null);
  const fetchStaffHistory = useCallback(async (request = latestHistoryRequest.current) => {
    const fetchId = Symbol();
    historyFetchId.current = fetchId;
    const { search, from, to, limit } = request;
    try {
      const records = await getAttendanceHistory(undefined, {
        range: 'all', limit,
        ...(search && { search }),
        ...((from || to) && { dateRange: { from: from || undefined, to: to || undefined } }),
      });
      if (fetchId === historyFetchId.current) setHistoryResponse({ request, records, failed: false });
    } catch {
      if (fetchId === historyFetchId.current) setHistoryResponse((previous) => ({
        request,
        records: sameHistoryFilters(previous.request, request) ? previous.records : [],
        failed: true,
      }));
    }
  }, []);
  const [cardNumber, setCardNumber] = useState("");
  const [mode, setMode] = useState<AttendanceMode>("in");
  const [blockedCheckIns, setBlockedCheckIns] = useState<
    Array<{ userId: string; userName: string; identifiers: string[] }>
  >([]);
  const [alreadyInWarning, setAlreadyInWarning] = useState<{
    userId: string;
    userName: string;
    message: string;
  } | null>(null);
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
        const [freshToday] = await Promise.all([
          getAttendanceHistory(undefined, { range: "today" }),
          fetchStaffHistory(),
        ]);
        setSystemTodayRecords(freshToday);
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
  }, [mode, isIdentifierBlockedForCheckIn, playScanCue, systemTodayRecords, fetchStaffHistory]);

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
          const [freshToday] = await Promise.all([
            getAttendanceHistory(undefined, { range: 'today' }),
            fetchStaffHistory(),
          ]);
          if (cancelled) return;
          setSystemTodayRecords(freshToday);
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
  }, [isStaff, userId, fetchStaffHistory]);

  useEffect(() => {
    if (!isStaff) return;
    latestHistoryRequest.current = historyRequest;
    const timer = historyRequest.search ? setTimeout(() => void fetchStaffHistory(historyRequest), 300) : undefined;
    if (historyRequest !== INITIAL_HISTORY_REQUEST && !historyRequest.search) void fetchStaffHistory(historyRequest);
    return () => {
      historyFetchId.current = null;
      clearTimeout(timer);
    };
  }, [isStaff, historyRequest, fetchStaffHistory]);

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

  const historyMatches = sameHistoryFilters(historyResponse.request, historyRequest);
  const filteredStaffRecords = historyMatches ? historyResponse.records : EMPTY_HISTORY;
  const historyLoading = historyRequest !== historyResponse.request;
  const historyFailed = !historyLoading && historyResponse.failed;
  const historyWindowFull = filteredStaffRecords.length >= historyResponse.request.limit;

  // Paginated staff records
  const totalStaffItems = filteredStaffRecords.length;
  const totalStaffPages = Math.max(1, Math.ceil(totalStaffItems / PAGE_SIZE));
  const activeStaffPage = Math.min(staffPage, totalStaffPages);
  const paginatedStaffRecords = useMemo(() => {
    const start = (activeStaffPage - 1) * PAGE_SIZE;
    return filteredStaffRecords.slice(start, start + PAGE_SIZE);
  }, [filteredStaffRecords, activeStaffPage]);

  // Paginated personal records (for student view)
  const datedPersonalRecords = useMemo(
    () => personalRecords.filter(r => isWithinManilaDateRange(r.check_in_at, fromDate, toDate)),
    [personalRecords, fromDate, toDate]
  );
  const totalPersonalItems = datedPersonalRecords.length;
  const totalPersonalPages = Math.max(1, Math.ceil(totalPersonalItems / PAGE_SIZE));
  const activePersonalPage = Math.min(personalPage, totalPersonalPages);
  const paginatedPersonalRecords = useMemo(() => {
    const start = (activePersonalPage - 1) * PAGE_SIZE;
    return datedPersonalRecords.slice(start, start + PAGE_SIZE);
  }, [datedPersonalRecords, activePersonalPage]);

  const dateRangeControls = (
    <DateRangeFilter
      from={fromDate}
      to={toDate}
      onChange={(from, to) => { setFromDate(from); setToDate(to); setPersonalPage(1); }}
    />
  );

  const scannerControls = (
    <div className="flex w-full min-w-0 flex-col gap-3 px-1 py-1 sm:px-2">
      <div role="group" aria-label="Record attendance" className="flex min-w-0 flex-col gap-2.5 xl:flex-row xl:items-center xl:gap-4">
        <AttendanceModeControl label="Attendance mode" mode={mode} onChange={setMode} />

        <form
          aria-label="Log attendance"
          onSubmit={handleManualSubmit}
          className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center xl:w-auto"
        >
          <div className="relative min-w-0 min-[380px]:col-span-2 sm:col-span-1">
            <label htmlFor="attendance-card-id" className="sr-only">Card ID or Patron ID</label>
            <ScanLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="attendance-card-id"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="Card ID or Patron ID"
              className="h-11 pl-9 xl:h-10"
              readOnly={isProcessing}
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            disabled={isProcessing || !cardNumber.trim() || isManualCheckInBlocked}
            className="h-11 px-3 shadow-none xl:h-10 xl:px-4"
          >
            {isProcessing ? "Recording…" : mode === "in" ? "Record check-in" : "Record check-out"}
          </Button>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="h-11 px-3 shadow-none xl:h-10 xl:px-4" disabled={isProcessing}>
              <Camera aria-hidden="true" />
              Scan with camera
            </Button>
          </DialogTrigger>
        </form>
      </div>

      <p role="status" aria-label="Today’s attendance status" className="text-xs tabular-nums text-muted-foreground">
        <span>{activeCount} open</span>{' · '}<span>{completedTodayCount} closed today</span>
      </p>

      {alreadyInWarning && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs status-warning"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>{alreadyInWarning.message}</strong> — {alreadyInWarning.userName} must check out before checking in again.
            </span>
          </div>
          {mode === "in" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 text-xs xl:h-9"
              onClick={() => setMode("out")}
            >
              Switch to Check-Out
            </Button>
          )}
        </div>
      )}

      <AttendanceHistoryFilters
        search={searchQuery}
        from={historyRequest.from}
        to={historyRequest.to}
        onSearchChange={(value) => {
          setSearchQuery(value);
          const search = value.trim();
          if (search === historyRequest.search) return;
          setStaffPage(1);
          setHistoryRequest((request) => ({ ...request, search, limit: ALL_HISTORY_STEP }));
        }}
        onDateChange={(from, to) => {
          if (from === historyRequest.from && to === historyRequest.to) return;
          setStaffPage(1);
          setHistoryRequest((request) => ({ ...request, from, to, limit: ALL_HISTORY_STEP }));
        }}
      />
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
                  Scan a card, then confirm the attendance action.
                </DialogDescription>
              </DialogHeader>

              <AttendanceModeControl label="Scanner attendance mode" mode={mode} onChange={setMode} />

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
                    className="h-11 flex-1 shadow-none"
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

          {historyFailed && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
              <p role="alert" className="text-sm text-destructive">Couldn&apos;t load attendance records.</p>
              <Button type="button" variant="outline" className="h-11 xl:h-10" onClick={() => setHistoryRequest((request) => ({ ...request }))}>Retry</Button>
            </div>
          )}
          {historyLoading && !historyMatches ? (
            <TableLoadingSkeleton />
          ) : (!historyFailed || totalStaffItems > 0) && (
            <Suspense fallback={<TableLoadingSkeleton />}>
              <AttendanceTable history={paginatedStaffRecords} isPersonal={false} />
            </Suspense>
          )}
          <p role="status" className="sr-only">
            {!historyLoading && !historyFailed ? `${totalStaffItems} matching attendance records loaded` : ''}
          </p>
          {historyWindowFull && !historyFailed && (
            <div className="flex justify-end border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 xl:h-10"
                disabled={historyLoading}
                onClick={() => setHistoryRequest((request) => ({ ...request, limit: request.limit + ALL_HISTORY_STEP }))}
              >
                {historyLoading && historyRequest.limit > historyResponse.request.limit ? 'Loading…' : 'Load older records'}
              </Button>
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
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1 py-0.5">
              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              {fromDate || toDate ? 'Filtered History' : 'All-Time History'}
            </p>
            {dateRangeControls}
          </div>
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

function AttendanceHistoryFilters({ search, from, to, onSearchChange, onDateChange }: {
  search: string;
  from: string;
  to: string;
  onSearchChange: (value: string) => void;
  onDateChange: (from: string, to: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [dateError, setDateError] = useState('');
  const toggle = useRef<HTMLButtonElement>(null);
  const toInput = useRef<HTMLInputElement>(null);
  const start = from ? new Date(`${from}T00:00:00Z`) : null;
  const end = to ? new Date(`${to}T00:00:00Z`) : null;
  const hasRange = Boolean(start || end);
  let label = 'Date range';
  if (start && end) label = dateLabelFormatter.formatRange(start, end);
  else if (start) label = `From ${dateLabelFormatter.format(start)}`;
  else if (end) label = `Through ${dateLabelFormatter.format(end)}`;

  function closeDates() {
    setIsOpen(false);
    toggle.current?.focus();
  }

  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setDateError('Enter a To date on or after the From date.');
      toInput.current?.focus();
      return;
    }
    onDateChange(draftFrom, draftTo);
    closeDates();
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    closeDates();
  }

  return (
    <div
      role="group"
      aria-label="Attendance record filters"
      className="min-w-0 space-y-2 border-t border-border pt-3"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full min-[420px]:min-w-48 min-[420px]:flex-1 sm:max-w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search attendance by patron name or ID"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patron or ID"
            className="h-11 pl-9 xl:h-10"
          />
        </div>
        <Button
          ref={toggle}
          type="button"
          variant="outline"
          aria-controls="attendance-history-dates"
          aria-expanded={isOpen}
          aria-label={hasRange ? `Date range: ${label}` : undefined}
          className={cn('h-11 max-w-full px-3 shadow-none xl:h-10', (hasRange || isOpen) && 'bg-accent text-accent-foreground')}
          onKeyDown={closeOnEscape}
          onClick={() => {
            if (!isOpen) {
              setDraftFrom(from);
              setDraftTo(to);
              setDateError('');
            }
            setIsOpen(!isOpen);
          }}
        >
          <CalendarIcon aria-hidden="true" />
          <span className="min-w-0 truncate" title={hasRange ? label : undefined}>{label}</span>
          <ChevronDown className={cn(isOpen && 'rotate-180')} aria-hidden="true" />
        </Button>
      </div>
      <div id="attendance-history-dates" hidden={!isOpen}>
        <form
          aria-label="Date range"
          onSubmit={applyDates}
          onKeyDown={closeOnEscape}
          className="grid min-w-0 items-end gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap"
        >
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            From
            <Input type="date" value={draftFrom} max="9999-12-31" className="h-11 w-full min-w-0 px-2 sm:w-36 xl:h-10"
              onChange={(event) => { setDraftFrom(event.target.value); setDateError(''); }} />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            To
            <Input ref={toInput} type="date" value={draftTo} max="9999-12-31" className="h-11 w-full min-w-0 px-2 sm:w-36 xl:h-10"
              aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'attendance-history-date-error' : undefined}
              onChange={(event) => { setDraftTo(event.target.value); setDateError(''); }} />
          </label>
          <div className="flex justify-end gap-2 min-[380px]:col-span-2">
            {(hasRange || draftFrom || draftTo) && (
              <Button type="button" variant="ghost" className="h-11 xl:h-10" onClick={() => { onDateChange('', ''); closeDates(); }}>
                Clear dates
              </Button>
            )}
            <Button type="submit" className="h-11 shadow-none xl:h-10" disabled={!hasRange && !draftFrom && !draftTo}>Apply</Button>
          </div>
          {dateError && (
            <p id="attendance-history-date-error" role="alert" className="col-span-full w-full text-xs text-destructive">{dateError}</p>
          )}
        </form>
      </div>
    </div>
  );
}

function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div role="group" aria-label="Date range" className="grid min-w-0 grid-cols-2 items-end gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground sm:flex sm:flex-wrap">
      <label className="grid min-w-0 gap-1">
        From
        <Input type="date" value={from} max={to || undefined} onChange={e => onChange(e.target.value, to)} className="h-11 w-full min-w-0 px-2 sm:w-36 xl:h-10" />
      </label>
      <label className="grid min-w-0 gap-1">
        To
        <Input type="date" value={to} min={from || undefined} onChange={e => onChange(from, e.target.value)} className="h-11 w-full min-w-0 px-2 sm:w-36 xl:h-10" />
      </label>
      {(from || to) && (
        <Button type="button" variant="ghost" size="sm" className="col-span-2 h-11 justify-self-start xl:h-10" onClick={() => onChange('', '')}>
          Clear dates
        </Button>
      )}
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
