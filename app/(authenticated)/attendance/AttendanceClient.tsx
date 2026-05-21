"use client";

import { use, useTransition, useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { toggleAttendanceByCard, getAttendanceHistory } from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, Calendar as CalendarIcon, ScanLine, LogIn, LogOut, Camera } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { QRScanner } from "@/components/common/QRScanner";
import { createClient } from "@/lib/supabase/client";
import { CompactPagination } from "@/components/ui/compact-pagination";


interface AttendanceRecord {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  profiles?: {
    full_name: string | null;
  };
}

export function AttendanceClient({ 
  systemTodayPromise,
  personalHistoryPromise,
  isStaff = false,
  userId
}: { 
  systemTodayPromise?: Promise<AttendanceRecord[]>,
  personalHistoryPromise: Promise<AttendanceRecord[]>,
  isStaff?: boolean,
  userId: string
}) {
  const initialSystemToday = systemTodayPromise ? use(systemTodayPromise) : [];
  const initialPersonal = use(personalHistoryPromise);

  const [systemRecords, setSystemRecords] = useState(initialSystemToday);
  const [personalRecords, setPersonalRecords] = useState(initialPersonal);
  const [isPending, startTransition] = useTransition();
  const [cardNumber, setCardNumber] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [personalPage, setPersonalPage] = useState(1);
  const PERSONAL_PAGE_SIZE = 10;

  const totalPersonalItems = personalRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalPersonalItems / PERSONAL_PAGE_SIZE));
  const activePersonalPage = Math.min(personalPage, totalPages);

  const paginatedPersonalRecords = useMemo(() => {
    const start = (activePersonalPage - 1) * PERSONAL_PAGE_SIZE;
    return personalRecords.slice(start, start + PERSONAL_PAGE_SIZE);
  }, [personalRecords, activePersonalPage]);


  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber.trim()) return;

    startTransition(async () => {
      const result = await toggleAttendanceByCard({ 
        cardNumber: cardNumber.trim(),
        isManual: true 
      });
      if (result.success) {
        toast.success(result.data.message, {
          id: "attendance-toast",
          description: result.data.status === "IN" ? "Checked in successfully." : "Checked out successfully.",
          icon: result.data.status === "IN" ? <LogIn className="w-4 h-4 text-green-500" /> : <LogOut className="w-4 h-4 text-orange-500" />
        });
        setCardNumber("");
      } else {
        toast.error(result.error, { id: "attendance-toast-error" });
        setCardNumber("");
      }
    });
  };


  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Synchronous lock: prevents race conditions between state updates ---
  const isProcessingRef = useRef(false);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef(0);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Minimum interval between ANY two scans (ms)
  const SCAN_INTERVAL_MS = 3000;

  useEffect(() => {
    if (isStaff && !showScanner) {
      inputRef.current?.focus();
    }
  }, [isStaff, showScanner]);

  // Realtime subscription to refresh attendance logs automatically
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
            const [freshSystem, freshPersonal] = await Promise.all([
              getAttendanceHistory(undefined),
              getAttendanceHistory(userId)
            ]);
            setSystemRecords(freshSystem);
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
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [isStaff, userId]);

  const handleQRScan = useCallback((data: string) => {
    if (isProcessingRef.current) return;

    const cleanData = data.trim();
    if (!cleanData) return;

    const now = Date.now();

    if (lastScannedRef.current === cleanData && now - lastScanTimeRef.current < SCAN_INTERVAL_MS) {
      return;
    }

    if (now - lastScanTimeRef.current < SCAN_INTERVAL_MS) {
      return;
    }

    isProcessingRef.current = true;
    lastScannedRef.current = cleanData;
    lastScanTimeRef.current = now;
    setIsProcessing(true);

    startTransition(async () => {
      try {
        const result = await toggleAttendanceByCard({ 
          cardNumber: cleanData,
          isManual: false 
        });
        if (result.success) {
          toast.success(result.data.message, {
            id: "attendance-qr-toast",
            description: result.data.description,
            icon: result.data.status === "IN" ? <LogIn className="w-4 h-4 text-green-500" /> : <LogOut className="w-4 h-4 text-orange-500" />
          });

          setShowScanner(false);

          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = setTimeout(() => {
            lastScannedRef.current = null;
          }, 5000);

        } else {
          toast.error(result.error, { id: "attendance-qr-toast-error" });
          lastScannedRef.current = null; 
        }
      } finally {
        setIsProcessing(false);
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 500);
      }
    });
  }, []);

  const scannerControls = (
    <div className="flex flex-col md:flex-row flex-1 items-stretch md:items-center gap-3 w-full">
      <form onSubmit={handleScan} className="flex flex-1 items-center gap-3">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="Library Card ID..."
            className="h-9 pl-9 pr-3 bg-background/50"
            disabled={isPending}
            autoComplete="off"
          />
        </div>
        <Button 
          type="submit" 
          size="sm"
          disabled={isPending || isProcessing || !cardNumber.trim()}
          className="h-9 px-4 font-bold shrink-0"
        >
          {isPending || isProcessing ? "..." : "Process"}
        </Button>
      </form>
      <div className="hidden md:block w-px h-6 bg-border/40 mx-1" />
      <div className="flex items-center gap-2">
        <Button
          variant={showScanner ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowScanner(!showScanner)}
          className="h-9 px-4 flex-1 md:flex-none justify-center shrink-0"
          disabled={isPending}
        >
          <Camera className={cn("w-4 h-4 mr-2", showScanner && "animate-pulse")} />
          {showScanner ? "Close Camera" : "Open Camera"}
        </Button>
      </div>
    </div>
  );

  if (isStaff) {
    return (
      <div className="w-full space-y-6">


        <AdminTableShell
          controls={scannerControls}
          className="max-w-none animate-in fade-in-50 duration-300"
        >
          {showScanner && (
            <div className="p-4 border-b border-border/10 bg-muted/5 relative overflow-hidden">
              {isProcessing && (
                <div className="absolute inset-0 z-10 bg-background/20 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-md px-4 py-2 rounded-full border border-border/50 shadow-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Processing...</span>
                  </div>
                </div>
              )}
              <QRScanner 
                onScan={handleQRScan}
                onClose={() => setShowScanner(false)}
                stopOnScan={false}
                className="w-full max-w-md mx-auto aspect-square shadow-2xl border border-border/20"
              />
            </div>
          )}

          <Suspense fallback={<TableLoadingSkeleton />}>
            <AttendanceTable history={systemRecords} isPersonal={false} />
          </Suspense>
        </AdminTableShell>
      </div>
    );
  }

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
              pageSize={PERSONAL_PAGE_SIZE}
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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                {(record.profiles?.full_name || "Student").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{record.profiles?.full_name || "Student"}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {format(new Date(record.check_in_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        )
      });
    } else {
      cols.push({
        header: "Date",
        cell: (record) => (
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            {format(new Date(record.check_in_at), "MMMM dd, yyyy")}
          </div>
        )
      });
    }

    cols.push(
      {
        header: "Check In",
        cell: (record) => (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <LogIn className="w-3.5 h-3.5 text-muted-foreground/50" />
            {format(new Date(record.check_in_at), "hh:mm a")}
          </div>
        )
      },
      {
        header: "Check Out",
        cell: (record) => (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {record.check_out_at ? (
              <>
                <LogOut className="w-3.5 h-3.5 text-muted-foreground/50" />
                {format(new Date(record.check_out_at), "hh:mm a")}
              </>
            ) : (
              <span className="text-green-600 font-bold uppercase tracking-widest text-[9px] animate-pulse">
                Active Session
              </span>
            )}
          </div>
        )
      },
      {
        header: "Status",
        className: "w-[120px]",
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
        description: "There are no attendance records to display.",
        icon: Clock
      }}
      renderMobileRow={(record) => (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isPersonal ? (
              <>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    {(record.profiles?.full_name || "S").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{record.profiles?.full_name || "Student"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">
                      {format(new Date(record.check_in_at), "MMM dd")}
                    </span>
                    <span className="opacity-20 text-[10px]">•</span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <LogIn className="w-2.5 h-2.5" />
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
                    <LogIn className="w-2.5 h-2.5 text-green-500" />
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
