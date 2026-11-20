"use client";

import { use, useState, useRef, useEffect, useMemo, useCallback, Suspense, type FormEvent, type KeyboardEvent } from "react";
import { recordAttendanceByCard, getAttendanceHistory } from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  AlertTriangle,
  CircleCheck,
  ListFilter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { TableSortSelect } from "@/components/common/TableSort";
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
import type { AttendanceRecord, AttendanceSort } from "@/lib/actions/attendance";
import { isWithinManilaDateRange } from "@/lib/date-range";
import toolbarStyles from "./AttendanceToolbar.module.css";

const ALL_HISTORY_STEP = 300;
type PersonalSort = Exclude<AttendanceSort, `patron-${string}`>;
const DEFAULT_SORT = 'checkin-desc';
const INITIAL_HISTORY_REQUEST = { search: '', from: '', to: '', limit: ALL_HISTORY_STEP, sort: DEFAULT_SORT as AttendanceSort };
const personalSortOptions: { value: PersonalSort; label: string }[] = [
  { value: 'checkin-desc', label: 'Check-in (newest)' },
  { value: 'checkin-asc', label: 'Check-in (oldest)' },
  { value: 'checkout-desc', label: 'Check-out (newest)' },
  { value: 'checkout-asc', label: 'Check-out (oldest)' },
];
const staffSortOptions: { value: AttendanceSort; label: string }[] = [
  ...personalSortOptions,
  { value: 'patron-asc', label: 'Patron (A–Z)' },
  { value: 'patron-desc', label: 'Patron (Z–A)' },
];
const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
});
const logDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: '2-digit', timeZone: 'Asia/Manila',
});
const logTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
});

function sameHistoryQuery(first: typeof INITIAL_HISTORY_REQUEST, second: typeof INITIAL_HISTORY_REQUEST) {
  return first.search === second.search && first.from === second.from && first.to === second.to && first.sort === second.sort;
}

type AttendanceMode = "in" | "out";

const ATTENDANCE_MODES = [
  { value: "in", label: "Check-In", Icon: LogIn },
  { value: "out", label: "Check-Out", Icon: LogOut },
] as const;

const FEEDBACK_SUCCESS_MS = 4000;

function AttendanceModeControl({ label, mode, onChange, className }: {
  label: string;
  className?: string;
  mode: AttendanceMode;
  onChange: (mode: AttendanceMode) => void;
}) {
  return (
    <div role="group" aria-label={label} className={cn("grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-fit", className)}>
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
  const [personalSort, setPersonalSort] = useState<PersonalSort>(DEFAULT_SORT);

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
    const { search, from, to, limit, sort } = request;
    try {
      const records = await getAttendanceHistory(undefined, {
        range: 'all', limit,
        ...(search && { search }),
        ...((from || to) && { dateRange: { from: from || undefined, to: to || undefined } }),
        ...(sort !== DEFAULT_SORT && { sort }),
      });
      if (fetchId === historyFetchId.current) setHistoryResponse({ request, records, failed: false });
    } catch {
      if (fetchId === historyFetchId.current) setHistoryResponse((previous) => ({
        request,
        records: sameHistoryQuery(previous.request, request) ? previous.records : [],
        failed: true,
      }));
    }
  }, []);
  const [cardNumber, setCardNumber] = useState("");
  const [mode, setMode] = useState<AttendanceMode>("in");
  const [openPanel, setOpenPanel] = useState<'manual' | 'filters' | null>(null);
  const manualEntryOpen = openPanel === 'manual';
  const [manualFeedback, setManualFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const cardInput = useRef<HTMLInputElement>(null);
  const focusCardAfterModeChange = useRef(false);
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
    // Manual entry and the open scanner each show the outcome inline; a toast is
    // only a fallback for a scan whose dialog has since closed.
    const showsInline = () => isManual || session === scannerSession.current;
    const clean = scannedValue.trim();
    if (!clean || processingRef.current) return;
    if (activeMode === "in" && isIdentifierBlockedForCheckIn(clean)) return;

    processingRef.current = true;
    const wasPending = pendingScanRef.current === clean;
    setManualFeedback(null);
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
          return;
        }

        if (status === "NOT_CHECKED_IN") {
          playScanCue("error");
          if (isManual) setManualFeedback({ kind: 'error', message });
          if (!isManual && session === scannerSession.current) {
            setLastResult(message);
          }
          if (!showsInline()) toast.error(message, { id: "attendance-toast-error", description });
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
          setManualFeedback({ kind: 'success', message: outcome === "UPDATED" ? `Check-in updated · ${message}` : message });
          setCardNumber("");
        }

        // Instantly refresh records so local state updates immediately without waiting for websocket
        const [freshToday] = await Promise.allSettled([
          getAttendanceHistory(undefined, { range: "today" }),
          fetchStaffHistory(),
        ]);
        if (freshToday.status === 'fulfilled') setSystemTodayRecords(freshToday.value);
      } else {
        playScanCue("error");
        if (isManual) setManualFeedback({ kind: 'error', message: result.error });
        if (!isManual && session === scannerSession.current) setLastResult(result.error);
        if (!showsInline()) toast.error(result.error, { id: "attendance-toast-error" });
      }
    } catch {
      playScanCue("error");
      if (isManual) setManualFeedback({ kind: 'error', message: 'Could not verify this entry. Check the attendance log before retrying.' });
      if (!isManual && session === scannerSession.current) setLastResult("Could not verify this scan. Check the attendance log before retrying.");
      if (!showsInline()) toast.error("Failed to process attendance transaction.", { id: "attendance-toast-err" });
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

  useEffect(() => {
    if (manualEntryOpen) cardInput.current?.focus();
  }, [manualEntryOpen]);

  // Success messages fade on their own; errors stay until edited or dismissed.
  useEffect(() => {
    if (manualFeedback?.kind !== 'success') return;
    const timer = setTimeout(() => setManualFeedback(null), FEEDBACK_SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [manualFeedback]);

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

  const trimmedSearch = searchQuery.trim();
  const appliedSearch = historyRequest.search;
  useEffect(() => {
    if (!isStaff || trimmedSearch === appliedSearch) return;
    const timer = setTimeout(() => {
      setStaffPage(1);
      setHistoryRequest((request) => ({ ...request, search: trimmedSearch, limit: ALL_HISTORY_STEP }));
    }, 300);
    return () => clearTimeout(timer);
  }, [isStaff, trimmedSearch, appliedSearch]);

  useEffect(() => {
    if (!isStaff) return;
    latestHistoryRequest.current = historyRequest;
    if (historyRequest !== INITIAL_HISTORY_REQUEST) void fetchStaffHistory(historyRequest);
    return () => { historyFetchId.current = null; };
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

  const historyLoading = historyRequest !== historyResponse.request;
  const filteredStaffRecords = historyResponse.records;
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
  const datedPersonalRecords = useMemo(() => {
    const records = personalRecords.filter(r => isWithinManilaDateRange(r.check_in_at, fromDate, toDate));
    if (personalSort === DEFAULT_SORT) return records;
    const field = personalSort.startsWith('checkout') ? 'check_out_at' : 'check_in_at';
    const direction = personalSort.endsWith('asc') ? 1 : -1;
    return records.sort((first, second) => {
      const firstTime = first[field];
      const secondTime = second[field];
      if (!firstTime && secondTime) return 1;
      if (firstTime && !secondTime) return -1;
      const timestampOrder = firstTime && secondTime ? direction * (Date.parse(firstTime) - Date.parse(secondTime)) : 0;
      return timestampOrder || second.id.localeCompare(first.id);
    });
  }, [personalRecords, fromDate, toDate, personalSort]);
  const totalPersonalItems = datedPersonalRecords.length;
  const totalPersonalPages = Math.max(1, Math.ceil(totalPersonalItems / PAGE_SIZE));
  const activePersonalPage = Math.min(personalPage, totalPersonalPages);
  const paginatedPersonalRecords = useMemo(() => {
    const start = (activePersonalPage - 1) * PAGE_SIZE;
    return datedPersonalRecords.slice(start, start + PAGE_SIZE);
  }, [datedPersonalRecords, activePersonalPage]);

  const applyStaffSort = (sort: AttendanceSort) => {
    setStaffPage(1);
    setHistoryRequest((request) => ({ ...request, search: trimmedSearch, sort, limit: ALL_HISTORY_STEP }));
  };

  const applyPersonalSort = (sort: PersonalSort) => {
    setPersonalPage(1);
    setPersonalSort(sort);
  };

  const dateRangeControls = (
    <DateRangeFilter
      from={fromDate}
      to={toDate}
      onChange={(from, to) => { setFromDate(from); setToDate(to); setPersonalPage(1); }}
    />
  );

  const scannerControls = (
    <div role="group" aria-label="Attendance controls" className={toolbarStyles.toolbar}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" aria-label="Scan QR" title="Scan QR"
          className={cn("app-toolbar-control", toolbarStyles.scanButton)} disabled={isProcessing}>
          <Camera aria-hidden="true" />
          <span className={toolbarStyles.wideLabel}>Scan QR</span>
        </Button>
      </DialogTrigger>

      <Button
        type="button"
        variant="outline"
        aria-label="Enter ID"
        title="Enter ID"
        aria-controls="attendance-manual-entry"
        aria-expanded={manualEntryOpen}
        onClick={() => setOpenPanel(manualEntryOpen ? null : 'manual')}
        className={cn("app-toolbar-control size-11 px-0", toolbarStyles.manualToggle, manualEntryOpen && "bg-accent text-accent-foreground")}
      >
        <ScanLine aria-hidden="true" />
      </Button>

      <form
        id="attendance-manual-entry"
        aria-label="Log attendance"
        onSubmit={handleManualSubmit}
        className={cn(
          "w-full min-w-0 flex-col gap-2",
          toolbarStyles.manualForm,
          manualEntryOpen ? "flex" : "hidden",
        )}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="attendance-card-id" className="sr-only">Card or patron ID</label>
          <Input
            ref={cardInput}
            id="attendance-card-id"
            value={cardNumber}
            onChange={(e) => {
              setCardNumber(e.target.value);
              setManualFeedback(null);
            }}
            placeholder="Card or patron ID"
            className="app-toolbar-control"
            readOnly={isProcessing}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <div className="flex shrink-0">
          <Button
            type="submit"
            disabled={isProcessing || !cardNumber.trim() || isManualCheckInBlocked}
            className="h-11 min-w-24 flex-1 rounded-r-none px-3 shadow-none focus-visible:z-10"
          >
            {isProcessing ? "Recording…" : mode === "in" ? "Check in" : "Check out"}
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                aria-label="Change attendance action"
                disabled={isProcessing}
                className="h-11 min-w-11 rounded-l-none border-l border-primary-foreground/25 px-3 shadow-none focus-visible:z-10"
              >
                <span className={toolbarStyles.compactLabel}>Change</span>
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(event) => {
              if (!focusCardAfterModeChange.current) return;
              focusCardAfterModeChange.current = false;
              event.preventDefault();
              cardInput.current?.focus();
            }}>
              <DropdownMenuRadioGroup value={mode} onValueChange={(value) => {
                focusCardAfterModeChange.current = true;
                setMode(value === "out" ? "out" : "in");
                setManualFeedback(null);
              }}>
                <DropdownMenuRadioItem value="in" className="min-h-11">Check in</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="out" className="min-h-11">Check out</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </form>
      {manualFeedback && (
        <p
          role={manualFeedback.kind === 'success' ? 'status' : 'alert'}
          className={cn(
            "col-span-full flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            manualFeedback.kind === 'success' ? "status-success" : "border-destructive/25 bg-destructive/5 text-destructive",
          )}
        >
          {manualFeedback.kind === 'success'
            ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 flex-1 break-words">{manualFeedback.message}</span>
          {manualFeedback.kind === 'error' && (
            <button
              type="button"
              aria-label="Dismiss message"
              className="-my-1 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => setManualFeedback(null)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </p>
      )}
      {alreadyInWarning && (
        <div
          role="alert"
          className="status-warning col-span-full flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              <strong>{alreadyInWarning.message}</strong> {alreadyInWarning.userName} must check out before checking in again.
            </span>
          </div>
          {mode === "in" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 text-xs"
              onClick={() => {
                setMode("out");
                setOpenPanel('manual');
                cardInput.current?.focus();
              }}
            >
              Switch to Check-Out
            </Button>
          )}
        </div>
      )}
      <AttendanceHistoryFilters
        isOpen={openPanel === 'filters'}
        onOpenChange={(open) => setOpenPanel(open ? 'filters' : null)}
        search={searchQuery}
        from={historyRequest.from}
        to={historyRequest.to}
        sort={historyRequest.sort}
        onSearchChange={(value) => {
          setSearchQuery(value);
          if (!value.trim() && appliedSearch) {
            setStaffPage(1);
            setHistoryRequest((request) => ({ ...request, search: '', limit: ALL_HISTORY_STEP }));
          }
        }}
        onSortChange={applyStaffSort}
        onDateChange={(from, to) => {
          if (from === historyRequest.from && to === historyRequest.to) return;
          setStaffPage(1);
          setHistoryRequest((request) => ({ ...request, search: trimmedSearch, from, to, limit: ALL_HISTORY_STEP }));
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
                itemLabel="records"
              />
            ) : null
          }
          className={cn("max-w-none animate-in fade-in-50 duration-300", toolbarStyles.logsLayout)}
        >
            <DialogContent
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6"
            >
              <DialogHeader className="text-center w-full pb-1">
                <DialogTitle className="text-base font-bold flex items-center justify-center gap-2">
                  <ScanLine className="w-4 h-4 text-primary" />
                  Gate Attendance Scanner
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Scan a card, then confirm the attendance action.
                </DialogDescription>
              </DialogHeader>

              <AttendanceModeControl label="Scanner attendance mode" mode={mode} onChange={setMode} className="mx-auto" />

              <div className="relative aspect-square max-w-[280px] mx-auto w-full overflow-hidden rounded-xl border border-border bg-muted/30">
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
                      className="h-11"
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
                        "size-11 bg-background",
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
                      className="h-11 px-4"
                      onClick={() => stopCamera()}
                    >
                      Stop camera
                    </Button>
                  </div>
                )}

              </div>
              {cameraIssue && !cameraOpen && !isInitializing && (
                <p role="alert" className="sr-only">{cameraIssue}</p>
              )}

              {pendingScan && <div className="w-full space-y-3 rounded-xl border border-border p-3">
                <p className="text-center text-sm">Card ready: <span className="font-mono break-all">{pendingScan}</span></p>
                {isPendingScanCheckInBlocked && alreadyInWarning && (
                  <p role="alert" className="text-center text-xs font-medium text-amber-700 dark:text-amber-300">
                    {alreadyInWarning.message} — switch to Check-Out to log out.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="h-11" disabled={isProcessing} onClick={() => { pendingScanRef.current = null; setPendingScan(null); }}>Discard</Button>
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
              <div role="status" className="space-y-1 text-center empty:hidden">
                {lastResult && <p className="font-semibold text-foreground">{lastResult}</p>}
                {pendingScan && <p className="text-sm text-muted-foreground">Awaiting librarian confirmation</p>}
                {cameraOpen && !pendingScan && !isProcessing && <p className="text-sm text-muted-foreground">Ready for next card</p>}
              </div>
            </DialogContent>

          {historyFailed && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
              <p role="alert" className="text-sm text-destructive">Couldn&apos;t load attendance records.</p>
              <Button type="button" variant="outline" className="h-11 xl:h-10" onClick={() => setHistoryRequest((request) => ({ ...request }))}>Retry</Button>
            </div>
          )}
          <div aria-busy={historyLoading || undefined}>
            {historyLoading && !totalStaffItems ? (
              <TableLoadingSkeleton />
            ) : (!historyFailed || totalStaffItems > 0) && (
              <Suspense fallback={<TableLoadingSkeleton />}>
                <AttendanceTable history={paginatedStaffRecords} sort={historyRequest.sort} onSortChange={applyStaffSort} />
              </Suspense>
            )}
          </div>
          <p role="status" className="sr-only">
            {historyLoading ? 'Loading attendance records…' : !historyFailed ? `${totalStaffItems} matching attendance records loaded` : ''}
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
                {historyLoading && historyRequest.limit > historyResponse.request.limit
                  ? 'Loading…'
                  : historyRequest.sort === DEFAULT_SORT ? 'Load older records' : 'Load more records'}
              </Button>
            </div>
          )}
        </AdminTableShell>
      </Dialog>
    );
  }

  // Personal View (Student)
  return (
    <AdminTableShell
      controls={
        <div className="app-toolbar-row">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1 py-0.5">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            {fromDate || toDate ? 'Filtered History' : 'All-Time History'}
          </p>
          {dateRangeControls}
          <TableSortSelect className="md:hidden" value={personalSort} options={personalSortOptions}
            onChange={(value) => applyPersonalSort(value as PersonalSort)} />
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
            itemLabel="records"
          />
        ) : null
      }
      className="max-w-none animate-in fade-in-50 duration-300"
    >
      <Suspense fallback={<TableLoadingSkeleton />}>
        <AttendanceTable history={paginatedPersonalRecords} sort={personalSort}
          onSortChange={(value) => applyPersonalSort(value as PersonalSort)} isPersonal />
      </Suspense>
    </AdminTableShell>
  );
}

function AttendanceHistoryFilters({ isOpen, onOpenChange, search, from, to, sort, onSearchChange, onDateChange, onSortChange }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  from: string;
  to: string;
  sort: AttendanceSort;
  onSearchChange: (value: string) => void;
  onDateChange: (from: string, to: string) => void;
  onSortChange: (sort: AttendanceSort) => void;
}) {
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
    onOpenChange(false);
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
    <>
      <div className={cn("relative min-w-0", toolbarStyles.searchControl)}>
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          aria-label="Search attendance by patron name or ID"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search logs"
          className="app-toolbar-control pl-7 pr-1"
        />
      </div>
      <Button
        ref={toggle}
        type="button"
        variant="outline"
        aria-controls="attendance-history-dates"
        aria-expanded={isOpen}
        aria-label={hasRange ? `Date range: ${label}` : 'Date range'}
        title={hasRange ? label : 'Attendance filters'}
        className={cn('app-toolbar-control relative', toolbarStyles.filterButton, (hasRange || isOpen) && 'bg-accent text-accent-foreground')}
        onKeyDown={closeOnEscape}
        onClick={() => {
          if (!isOpen) {
            setDraftFrom(from);
            setDraftTo(to);
            setDateError('');
          }
          onOpenChange(!isOpen);
        }}
      >
        <ListFilter className={toolbarStyles.compactLabel} aria-hidden="true" />
        <CalendarIcon className={toolbarStyles.wideLabel} aria-hidden="true" />
        <span className={toolbarStyles.wideLabel}>Date range</span>
        {hasRange && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />}
      </Button>
      <div id="attendance-history-dates" hidden={!isOpen} className="col-span-full space-y-3 rounded-lg border border-border bg-card p-3"
        onKeyDown={closeOnEscape}>
        <div className={toolbarStyles.logSort}>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Sort by</span>
          <TableSortSelect className="w-full sm:w-auto" value={sort} options={staffSortOptions}
            onChange={(value) => onSortChange(value as AttendanceSort)} />
        </div>
        <form
          aria-label="Date range"
          onSubmit={applyDates}
          className="flex min-w-0 flex-wrap items-end gap-2"
        >
          {hasRange && <p className="basis-full text-xs font-medium text-muted-foreground">{label}</p>}
          <label className="grid min-w-0 flex-1 basis-36 gap-1 text-xs font-medium text-muted-foreground sm:max-w-40">
            From
            <Input type="date" value={draftFrom} max="9999-12-31" className="h-11 w-full min-w-0 px-2"
              onChange={(event) => { setDraftFrom(event.target.value); setDateError(''); }} />
          </label>
          <label className="grid min-w-0 flex-1 basis-36 gap-1 text-xs font-medium text-muted-foreground sm:max-w-40">
            To
            <Input ref={toInput} type="date" value={draftTo} max="9999-12-31" className="h-11 w-full min-w-0 px-2"
              aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'attendance-history-date-error' : undefined}
              onChange={(event) => { setDraftTo(event.target.value); setDateError(''); }} />
          </label>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {(hasRange || draftFrom || draftTo) && (
              <Button type="button" variant="ghost" className="h-11" onClick={() => { onDateChange('', ''); closeDates(); }}>
                Clear dates
              </Button>
            )}
            <Button type="submit" className="h-11 shadow-none" disabled={!hasRange && !draftFrom && !draftTo}>Apply</Button>
          </div>
          {dateError && (
            <p id="attendance-history-date-error" role="alert" className="w-full text-xs text-destructive">{dateError}</p>
          )}
        </form>
      </div>
    </>
  );
}

function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div role="group" aria-label="Date range" className="grid min-w-0 grid-cols-2 items-end gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground sm:flex sm:flex-wrap">
      <label className="grid min-w-0 gap-1">
        From
        <Input type="date" value={from} max={to || undefined} onChange={e => onChange(e.target.value, to)} className="app-toolbar-control w-full min-w-0 px-2 sm:w-36" />
      </label>
      <label className="grid min-w-0 gap-1">
        To
        <Input type="date" value={to} min={from || undefined} onChange={e => onChange(from, e.target.value)} className="app-toolbar-control w-full min-w-0 px-2 sm:w-36" />
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
  sort,
  onSortChange,
  isPersonal = false
}: { 
  history: AttendanceRecord[],
  sort: AttendanceSort,
  onSortChange: (sort: AttendanceSort) => void,
  isPersonal?: boolean
}) {
  const columns = useMemo<LuminaColumn<AttendanceRecord>[]>(() => {
    const cols: LuminaColumn<AttendanceRecord>[] = [];
    const columnSort = (field: 'patron' | 'checkin' | 'checkout') => {
      const direction = sort === `${field}-asc` ? 'asc' : sort === `${field}-desc` ? 'desc' : undefined;
      const next = direction === 'asc' || (!direction && field !== 'patron') ? 'desc' : 'asc';
      return { direction, onToggle: () => onSortChange(`${field}-${next}`) } as const;
    };
    
    if (!isPersonal) {
      cols.push({
        header: "User",
        sort: columnSort('patron'),
        cell: (record) => (
          <div className="flex items-center gap-3">
            <Avatar aria-hidden="true" className="h-8 w-8">
              <AvatarFallback className="bg-muted text-muted-foreground text-[11px] font-bold">
                {(record.profiles?.full_name || "Student").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="break-words text-xs font-semibold">{record.profiles?.full_name || "Student"}</p>
              {record.profiles?.student_id && (
                <p className="break-words text-xs text-muted-foreground">{record.profiles.student_id}</p>
              )}
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
          <CalendarIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <time dateTime={record.check_in_at}>{logDateFormatter.format(new Date(record.check_in_at))}</time>
        </div>
      )
    });

    cols.push(
      {
        header: "Check In",
        sort: columnSort('checkin'),
        className: "w-[120px]",
        cell: (record) => (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <LogIn className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <time dateTime={record.check_in_at}>{logTimeFormatter.format(new Date(record.check_in_at))}</time>
          </div>
        )
      },
      {
        header: "Check Out",
        sort: columnSort('checkout'),
        className: "w-[210px]",
        cell: (record) => (
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium">
            {record.check_out_at ? (
              <>
                <LogOut className="size-3.5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                <time dateTime={record.check_out_at}>{logTimeFormatter.format(new Date(record.check_out_at))}</time>
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
  }, [isPersonal, sort, onSortChange]);

  return (
    <LuminaTable
      data={history}
      columns={columns}
      isLoading={false}
      noBorder
      layoutClasses={isPersonal ? undefined : { compact: toolbarStyles.compactLogs, table: toolbarStyles.logTable }}
      emptyState={{
        title: "No logs found",
        description: "There are no attendance records matching this view.",
        icon: Clock
      }}
      renderMobileRow={(record) => (
        <article className="space-y-3 text-sm">
          <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            {!isPersonal && (
              <div className="min-w-0">
                <p className="break-words font-semibold">{record.profiles?.full_name || "Student"}</p>
                {record.profiles?.student_id && <p className="break-words text-xs text-muted-foreground">{record.profiles.student_id}</p>}
              </div>
            )}
            <time dateTime={record.check_in_at} className={isPersonal ? "font-semibold" : "text-xs text-muted-foreground"}>
              {logDateFormatter.format(new Date(record.check_in_at))}
            </time>
          </header>
          <dl className="grid grid-cols-2 gap-2">
            <div className="min-w-0 space-y-1">
              <dt className="text-xs text-muted-foreground">Check in</dt>
              <dd className="font-medium tabular-nums">
                <time dateTime={record.check_in_at}>{logTimeFormatter.format(new Date(record.check_in_at))}</time>
              </dd>
            </div>
            <div className="min-w-0 space-y-1">
              <dt className="text-xs text-muted-foreground">Check out</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium tabular-nums">
                {record.check_out_at ? (
                  <>
                    <time dateTime={record.check_out_at}>{logTimeFormatter.format(new Date(record.check_out_at))}</time>
                    {record.notes === "No Log Out" && <NoLogOutBadge />}
                  </>
                ) : <StillInLibraryBadge />}
              </dd>
            </div>
          </dl>
        </article>
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
