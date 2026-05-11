"use client";

import { use, useTransition, useState, useRef, useEffect, useMemo } from "react";
import { logAttendance, toggleAttendanceByCard } from "@/lib/actions/attendance";
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

interface AttendanceRecord {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  profiles?: {
    full_name: string | null;
  };
}

export function AttendanceClient({ 
  historyPromise,
  isStaff = false
}: { 
  historyPromise: Promise<AttendanceRecord[]>,
  isStaff?: boolean
}) {
  const history = use(historyPromise);
  const [isPending, startTransition] = useTransition();
  const [cardNumber, setCardNumber] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeRecord = history.find(r => !r.check_out_at);

  const handleSelfLog = () => {
    startTransition(async () => {
      const result = await logAttendance();
      if (result.success) {
        toast.success(result.message);
        window.location.reload(); 
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber.trim()) return;

    startTransition(async () => {
      const result = await toggleAttendanceByCard({ cardNumber: cardNumber.trim() });
      if (result.success) {
        toast.success(result.data.message, {
          description: result.data.status === "IN" ? "Checked in successfully." : "Checked out successfully.",
          icon: result.data.status === "IN" ? <LogIn className="w-4 h-4 text-green-500" /> : <LogOut className="w-4 h-4 text-orange-500" />
        });
        setCardNumber("");
        window.location.reload();
      } else {
        toast.error(result.error);
        setCardNumber("");
      }
    });
  };

  const [showScanner, setShowScanner] = useState(false);

  // Keep focus on input for scanning
  useEffect(() => {
    if (isStaff && !showScanner) {
      inputRef.current?.focus();
    }
  }, [isStaff, showScanner]);

  const handleQRScan = (data: string) => {
    startTransition(async () => {
      const result = await toggleAttendanceByCard({ cardNumber: data.trim() });
      if (result.success) {
        toast.success(result.data.message, {
          description: result.data.status === "IN" ? "Checked in successfully." : "Checked out successfully.",
          icon: result.data.status === "IN" ? <LogIn className="w-4 h-4 text-green-500" /> : <LogOut className="w-4 h-4 text-orange-500" />
        });
        setShowScanner(false);
        window.location.reload();
      } else {
        toast.error(result.error);
        // Don't close scanner on error so they can try again or check what went wrong
      }
    });
  };

  const columns = useMemo<LuminaColumn<AttendanceRecord>[]>(() => [
    {
      header: "User",
      cell: (record) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
              {(record.profiles?.full_name || "Self").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{record.profiles?.full_name || "Self Check-in"}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {format(new Date(record.check_in_at), "MMM dd, yyyy")}
            </p>
          </div>
        </div>
      )
    },
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
  ], []);

  const scannerControls = (
    <div className="flex flex-1 items-center gap-3">
      <form onSubmit={handleScan} className="flex flex-1 items-center gap-3">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="Scan Library Card..."
            className="h-9 pl-9 pr-3 bg-background/50"
            disabled={isPending || showScanner}
            autoComplete="off"
          />
        </div>
        <Button 
          type="submit" 
          size="sm"
          disabled={isPending || !cardNumber.trim() || showScanner}
          className="h-9 px-4 font-bold"
        >
          {isPending ? "..." : "Process"}
        </Button>
      </form>
      <div className="w-px h-6 bg-border/40 mx-1" />
      <Button
        variant={showScanner ? "secondary" : "outline"}
        size="sm"
        onClick={() => setShowScanner(!showScanner)}
        className="h-9 px-4"
        disabled={isPending}
      >
        <Camera className={cn("w-4 h-4 mr-2", showScanner && "animate-pulse")} />
        {showScanner ? "Close Camera" : "Open Camera"}
      </Button>
    </div>
  );

  const selfLogControls = (
    <div className="flex flex-1 items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarIcon className="w-3.5 h-3.5" />
          {format(new Date(), "MMMM dd, yyyy")}
        </div>
        {activeRecord && (
          <StatusBadge status="ACTIVE" className="h-5" />
        )}
      </div>
      <Button 
        size="sm" 
        onClick={handleSelfLog} 
        disabled={isPending}
        className={cn(
          "h-9 px-6 font-bold",
          activeRecord && "bg-orange-600 hover:bg-orange-700"
        )}
      >
        {isPending ? "Processing..." : activeRecord ? "Check Out" : "Check In Now"}
      </Button>
    </div>
  );

  return (
    <AdminTableShell
      title="Library Attendance"
      description={isStaff ? "Scan cards to track student entry and exit." : "Confirm your presence in the library."}
      controls={isStaff ? scannerControls : selfLogControls}
      className="max-w-5xl"
    >
      {isStaff && showScanner && (
        <div className="p-4 border-b border-border/10 bg-muted/5">
          <QRScanner 
            onScan={handleQRScan}
            onClose={() => setShowScanner(false)}
            className="w-full max-w-md mx-auto aspect-square shadow-2xl border border-border/20"
          />
        </div>
      )}

      <LuminaTable
        data={history}
        columns={columns}
        isLoading={false}
        noBorder
        emptyState={{
          title: "No logs found",
          description: "There are no attendance records for today yet.",
          icon: Clock
        }}
        renderMobileRow={(record) => (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {(record.profiles?.full_name || "S").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{record.profiles?.full_name || "Self Check-in"}</p>
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
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StatusBadge status={record.check_out_at ? "COMPLETED" : "ACTIVE"} />
              {record.check_out_at && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                  <LogOut className="w-2.5 h-2.5" />
                  {format(new Date(record.check_out_at), "hh:mm a")}
                </div>
              )}
            </div>
          </div>
        )}
      />
    </AdminTableShell>
  );
}
