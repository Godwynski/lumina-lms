"use client";

import { use, useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { toggleAttendanceByCard, getAttendanceHistory } from "@/lib/actions/attendance";
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
  Sparkles,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { useScanner } from "@/hooks/use-scanner";
import { useScanFeedback } from "@/hooks/use-scan-feedback";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import type { AttendanceRecord } from "@/lib/actions/attendance";

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
  const [cardNumber, setCardNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastScannedValRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef(0);

  const { playScanCue } = useScanFeedback();

  // Pagination states
  const [staffPage, setStaffPage] = useState(1);
  const [personalPage, setPersonalPage] = useState(1);
  const PAGE_SIZE = 10;

  // Process a card scan (manual entry or camera detection)
  const processScan = useCallback(async (scannedValue: string, isManual = false) => {
    const clean = scannedValue.trim();
    if (!clean || isProcessing) return;

    const now = Date.now();
    if (!isManual && lastScannedValRef.current === clean && now - lastScanTimeRef.current < 2500) {
      return;
    }
    lastScannedValRef.current = clean;
    lastScanTimeRef.current = now;

    setIsProcessing(true);
    try {
      const result = await toggleAttendanceByCard({ 
        cardNumber: clean,
        isManual 
      });

      if (result.success) {
        playScanCue('success');
        toast.success("Transaction recorded", {
          id: "attendance-toast",
          description: result.data.message,
          icon: result.data.status === "IN" ? <LogIn className="w-4 h-4 text-green-500" /> : <LogOut className="w-4 h-4 text-orange-500" />
        });
        if (isManual) setCardNumber("");

        // Instantly refresh records so local state updates immediately without waiting for websocket
        const [freshToday, freshAll] = await Promise.all([
          getAttendanceHistory(undefined, { range: 'today' }),
          getAttendanceHistory(undefined, { range: 'all', limit: 300 })
        ]);
        setSystemTodayRecords(freshToday);
        setSystemAllRecords(freshAll);
      } else {
        playScanCue('error');
        toast.error(result.error, { id: "attendance-toast-error" });
      }
    } catch {
      playScanCue('error');
      toast.error("Failed to process attendance transaction.", { id: "attendance-toast-err" });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, playScanCue]);

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
      await processScan(val, false);
    },
    isProcessing,
    scannerId: 'attendance-kiosk-scanner'
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber.trim()) return;
    void processScan(cardNumber.trim(), true);
  };

  // Realtime subscription to refresh attendance logs across tabs automatically
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('attendance-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance' 
      }, async () => {
        try {
          if (isStaff) {
            const [freshToday, freshAll, freshPersonal] = await Promise.all([
              getAttendanceHistory(undefined, { range: 'today' }),
              getAttendanceHistory(undefined, { range: 'all', limit: 300 }),
              getAttendanceHistory(userId)
            ]);
            setSystemTodayRecords(freshToday);
            setSystemAllRecords(freshAll);
            setPersonalRecords(freshPersonal);
          } else {
            const freshPersonal = await getAttendanceHistory(userId);
            setPersonalRecords(freshPersonal);
          }
        } catch (error) {
          console.error("Failed to refresh attendance logs:", error);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isStaff, userId]);

  // Reset staff page when switching tabs or typing search
  useEffect(() => {
    setStaffPage(1);
  }, [activeTab, searchQuery]);

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

  // Focus manual input when not using scanner
  useEffect(() => {
    if (isStaff && !isScannerOpen) {
      inputRef.current?.focus();
    }
  }, [isStaff, isScannerOpen]);

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
    const base = activeTab === 'today' ? systemTodayRecords : systemAllRecords;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter(r => {
      const name = r.profiles?.full_name?.toLowerCase() || '';
      const sid = r.profiles?.student_id?.toLowerCase() || '';
      const notes = r.notes?.toLowerCase() || '';
      return name.includes(q) || sid.includes(q) || notes.includes(q);
    });
  }, [activeTab, systemTodayRecords, systemAllRecords, searchQuery]);

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

  const scannerControls = (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full">
        {/* Left: View Tabs + Search Box */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-muted/40 p-0.5 rounded-xl border border-border/15">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={cn(
                "h-7 px-3 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1.5",
                activeTab === 'today' 
                  ? "bg-background text-foreground shadow-sm font-bold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Today</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none",
                activeTab === 'today' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {systemTodayRecords.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                "h-7 px-3 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1.5",
                activeTab === 'all' 
                  ? "bg-background text-foreground shadow-sm font-bold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>All History</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none",
                activeTab === 'all' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {systemAllRecords.length}
              </span>
            </button>
          </div>

          {/* Quick stats pill */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/20 border border-border/10 text-[10px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <strong className="text-foreground">{activeCount}</strong> active
            </span>
            <span className="text-border/60">•</span>
            <span><strong className="text-foreground">{completedTodayCount}</strong> completed</span>
          </div>

          {/* Search box */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patron or ID..."
              className="h-8 pl-8 pr-2.5 text-xs bg-background/50 rounded-lg border-border/20"
            />
          </div>
        </div>

        {/* Right: Manual Input Form + Scanner Button */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5 flex-1 sm:flex-none">
            <div className="relative flex-1 sm:w-44">
              <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Card ID or Student No..."
                className="h-8 pl-8 pr-2 text-xs bg-background/50 rounded-lg border-border/20"
                disabled={isProcessing}
                autoComplete="off"
              />
            </div>
            <Button 
              type="submit" 
              size="sm"
              disabled={isProcessing || !cardNumber.trim()}
              className="h-8 px-3 font-semibold text-xs rounded-lg shrink-0"
            >
              {isProcessing ? "..." : "Log"}
            </Button>
          </form>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsScannerOpen(true)}
            className="h-8 px-3 text-xs font-semibold rounded-lg shrink-0 gap-1.5 transition-colors border-border/30 hover:bg-muted/40"
            disabled={isProcessing}
          >
            <Camera className="w-3.5 h-3.5 text-primary" />
            <span>Launch Scanner</span>
          </Button>
        </div>
      </div>
    </div>
  );

  if (isStaff) {
    return (
      <div className="w-full space-y-4">
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
          <Dialog 
            open={isScannerOpen} 
            onOpenChange={(open) => {
              setIsScannerOpen(open);
              if (!open) void stopCamera();
            }}
          >
            <DialogContent className="sm:max-w-md p-6 rounded-3xl border border-border/20 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col items-center">
              <DialogHeader className="text-center w-full pb-1">
                <DialogTitle className="text-base font-bold flex items-center justify-center gap-2">
                  <ScanLine className="w-4 h-4 text-primary" />
                  Gate Attendance Scanner
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Scan student library card or digital QR code to log attendance.
                </DialogDescription>
              </DialogHeader>

              <div className="relative aspect-square max-w-[280px] mx-auto w-full overflow-hidden rounded-2xl border border-border/15 bg-muted/20 shadow-inner my-2">
                <div 
                  id={scannerId} 
                  className="h-full w-full [&>video]:object-cover [&>video]:h-full [&>video]:w-full" 
                />
                
                {/* Minimalist reticle overlay */}
                <div className="absolute inset-0 pointer-events-none border-[12px] border-background/20 rounded-2xl" />

                {/* Loading or Processing Overlay */}
                {(isProcessing || isInitializing) && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                    {isInitializing && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">
                        Initializing...
                      </span>
                    )}
                    {isProcessing && !isInitializing && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">
                        Recording...
                      </span>
                    )}
                  </div>
                )}

                {/* Inactive State: Launch Scanner or Retry Camera */}
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
                          Retry Camera
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-3.5 w-3.5" />
                          Launch Scanner
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
                      title="Switch Camera"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </Button>

                    <Button 
                      variant="destructive" 
                      className="h-9 rounded-xl px-4 backdrop-blur-md bg-destructive/90 text-[10px] font-bold uppercase tracking-wider"
                      onClick={() => stopCamera()}
                    >
                      Stop
                    </Button>
                  </div>
                )}

                {/* Camera Issue Warning Banner */}
                {cameraIssue && !cameraOpen && !isInitializing && (
                  <div className="absolute top-4 inset-x-4 z-20">
                    <div className="bg-destructive/10 border border-destructive/20 backdrop-blur-md rounded-xl p-3 text-[10px] text-destructive font-medium text-center shadow-sm">
                      {cameraIssue}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground font-medium text-center mt-2">
                Keep code centered. Camera stays active for continuous scanning.
              </p>
            </DialogContent>
          </Dialog>

          <Suspense fallback={<TableLoadingSkeleton />}>
            <AttendanceTable history={paginatedStaffRecords} isPersonal={false} />
          </Suspense>
        </AdminTableShell>
      </div>
    );
  }

  // Personal View (Student)
  return (
    <div className="w-full">
      <AdminTableShell
        controls={
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-lg border border-border/50">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            All-Time History
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

function TableLoadingSkeleton() {
  return (
    <div className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Syncing Logs...</p>
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
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">
                {(record.profiles?.full_name || "Student").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground text-xs">{record.profiles?.full_name || "Student"}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
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
        className: "w-[140px]",
        cell: (record) => (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {record.check_out_at ? (
              <>
                <LogOut className="w-3.5 h-3.5 text-orange-500/80 shrink-0" />
                <span>{format(new Date(record.check_out_at), "hh:mm a")}</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold uppercase tracking-wider text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Inside
              </span>
            )}
          </div>
        )
      },
      {
        header: "Purpose / Note",
        cell: (record) => (
          <span className="text-xs text-muted-foreground/80 truncate block max-w-xs">
            {record.notes || "—"}
          </span>
        )
      },
      {
        header: "Status",
        className: "w-[100px]",
        cell: (record) => (
          <StatusBadge status={record.check_out_at ? "COMPLETED" : "ACTIVE"} />
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isPersonal ? (
              <>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                    {(record.profiles?.full_name || "S").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{record.profiles?.full_name || "Student"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">
                      {record.profiles?.student_id || format(new Date(record.check_in_at), "MMM dd")}
                    </span>
                    <span className="opacity-20 text-[10px]">•</span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <LogIn className="w-2.5 h-2.5 text-emerald-500" />
                      {format(new Date(record.check_in_at), "hh:mm a")}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="min-w-0">
                <p className="font-bold text-sm">
                  {format(new Date(record.check_in_at), "MMMM dd, yyyy")}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                    <LogIn className="w-2.5 h-2.5 text-emerald-500" />
                    In: {format(new Date(record.check_in_at), "hh:mm a")}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={record.check_out_at ? "COMPLETED" : "ACTIVE"} />
            {record.check_out_at && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                <LogOut className="w-2.5 h-2.5 text-orange-500" />
                Out: {format(new Date(record.check_out_at), "hh:mm a")}
              </div>
            )}
          </div>
        </div>
      )}
    />
  );
}
