"use client";

import { use, useTransition, useState, useRef, useEffect, useMemo } from "react";
import { toggleAttendanceByCard } from "@/lib/actions/attendance";
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
import { 
  updateAttendance, 
  deleteAttendance,
  logAttendance
} from "@/lib/actions/attendance";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, MoreVertical, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  // Management State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const activeRecord = history.find(r => !r.check_out_at);



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
      } else {
        toast.error(result.error);
        setCardNumber("");
      }
    });
  };

  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastScannedRef = useRef<string | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep focus on input for scanning
  useEffect(() => {
    if (isStaff && !showScanner && !editingRecord) {
      inputRef.current?.focus();
    }
  }, [isStaff, showScanner, editingRecord]);

  const handleQRScan = (data: string) => {
    if (isProcessing || isPending) return;
    
    const cleanData = data.trim();
    if (!cleanData) return;

    // Prevention of rapid spamming for the same card
    if (lastScannedRef.current === cleanData) {
      return;
    }

    lastScannedRef.current = cleanData;
    setIsProcessing(true);

    startTransition(async () => {
      try {
        const result = await toggleAttendanceByCard({ cardNumber: cleanData });
        if (result.success) {
          toast.success(result.data.message, {
            description: result.data.description,
            icon: result.data.status === "IN" ? <LogIn className="w-4 h-4 text-green-500" /> : <LogOut className="w-4 h-4 text-orange-500" />
          });
          
          // Clear "last scanned" after 5 seconds to allow re-scanning if they forgot or made a mistake
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = setTimeout(() => {
            lastScannedRef.current = null;
          }, 5000);

        } else {
          toast.error(result.error);
          lastScannedRef.current = null; // Allow immediate retry on error
        }
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleSelfToggle = () => {
    startTransition(async () => {
      const result = await logAttendance();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    startTransition(async () => {
      const result = await deleteAttendance(recordToDelete);
      if (result.success) {
        toast.success("Record deleted");
        setIsDeleteDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRecord) return;

    const formData = new FormData(e.currentTarget);
    const check_in_at = formData.get("check_in_at") as string;
    const check_out_at = formData.get("check_out_at") as string;
    const notes = formData.get("notes") as string;

    setIsUpdating(true);
    const result = await updateAttendance({
      id: editingRecord.id,
      updates: {
        check_in_at: new Date(check_in_at).toISOString(),
        check_out_at: check_out_at ? new Date(check_out_at).toISOString() : null,
        notes: notes || null
      }
    });
    setIsUpdating(false);

    if (result.success) {
      toast.success("Attendance updated");
      setEditingRecord(null);
    } else {
      toast.error(result.error);
    }
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
    },
    ...(isStaff ? [{
      header: "",
      className: "w-[50px]",
      cell: (record: AttendanceRecord) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setEditingRecord(record)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Record
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={() => {
                setRecordToDelete(record.id);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }] : [])
  ], [isStaff]);

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
          disabled={isPending || isProcessing || !cardNumber.trim() || showScanner}
          className="h-9 px-4 font-bold"
        >
          {isPending || isProcessing ? "..." : "Process"}
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
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-lg border border-border/5">
          <CalendarIcon className="w-3.5 h-3.5 text-primary" />
          {format(new Date(), "MMMM dd, yyyy")}
        </div>
        {activeRecord ? (
          <div className="flex items-center gap-2">
            <StatusBadge status="ACTIVE" className="h-6 px-3" />
            <span className="text-[10px] font-bold text-green-600 animate-pulse uppercase tracking-wider">You are Timed In</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <StatusBadge status="COMPLETED" className="h-6 px-3" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">You are Timed Out</span>
          </div>
        )}
      </div>

      <Button
        variant={activeRecord ? "outline" : "default"}
        size="sm"
        onClick={handleSelfToggle}
        disabled={isPending}
        className={cn(
          "h-9 px-5 font-bold transition-all shadow-sm",
          !activeRecord && "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isPending ? "..." : activeRecord ? (
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Time Out
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            Time In
          </span>
        )}
      </Button>

    </div>
  );

  return (
    <>
    <AdminTableShell
      controls={isStaff ? scannerControls : selfLogControls}
      className="max-w-5xl"
    >
      {isStaff && showScanner && (
        <div className="p-4 border-b border-border/10 bg-muted/5 relative overflow-hidden">
          {isProcessing && (
            <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center">
              <div className="bg-background/90 px-4 py-2 rounded-full border border-border/50 shadow-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-widest text-foreground">Processing Scan...</span>
              </div>
            </div>
          )}
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

    {/* Delete Confirmation */}
    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Attendance Record</DialogTitle>
          <Alert variant="destructive" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. This will permanently remove the record from the logs.
            </AlertDescription>
          </Alert>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit Dialog */}
    <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Attendance Record</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Adjusting logs for <span className="font-bold text-foreground">{editingRecord?.profiles?.full_name || "Self Check-in"}</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="check_in_at">Check-in Time</Label>
            <Input 
              id="check_in_at" 
              name="check_in_at" 
              type="datetime-local" 
              defaultValue={editingRecord ? format(new Date(editingRecord.check_in_at), "yyyy-MM-dd'T'HH:mm") : ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="check_out_at">Check-out Time (Optional)</Label>
            <Input 
              id="check_out_at" 
              name="check_out_at" 
              type="datetime-local" 
              defaultValue={editingRecord?.check_out_at ? format(new Date(editingRecord.check_out_at), "yyyy-MM-dd'T'HH:mm") : ""}
            />
            <p className="text-[10px] text-muted-foreground">Leave empty for active sessions.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Staff Notes</Label>
            <Input id="notes" name="notes" placeholder="Reason for edit..." />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setEditingRecord(null)}>Cancel</Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
