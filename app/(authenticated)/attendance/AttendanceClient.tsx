"use client";

import { use, useTransition, useState, useRef, useEffect } from "react";
import { logAttendance, toggleAttendanceByCard } from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, CheckCircle2, History, Calendar as CalendarIcon, ScanLine, ArrowRightLeft, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

  // Keep focus on input for scanning
  useEffect(() => {
    if (isStaff) {
      inputRef.current?.focus();
    }
  }, [isStaff]);

  return (
    <div className="space-y-6">
      {isStaff ? (
        <Card className="border-primary/30 bg-primary/5 shadow-xl overflow-hidden relative group">
          <div className="absolute -right-8 -top-8 p-12 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <ScanLine className="w-48 h-48 text-primary" />
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-primary">
              <div className="p-2 rounded-lg bg-primary/10">
                <ScanLine className="w-5 h-5" />
              </div>
              <CardTitle className="text-xl">Library Scanner Kiosk</CardTitle>
            </div>
            <CardDescription className="text-sm font-medium">
              Scan your library card to enter or exit. The system will automatically detect your current status.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleScan} className="flex flex-col sm:flex-row items-center gap-4 max-w-2xl">
              <div className="relative flex-1 w-full">
                <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
                <Input
                  ref={inputRef}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="Scan Library Card Number..."
                  className="h-14 pl-12 pr-4 text-lg font-mono tracking-widest bg-background/80 border-2 focus-visible:ring-primary/20 rounded-2xl shadow-inner transition-all"
                  disabled={isPending}
                  autoComplete="off"
                />
              </div>
              <Button 
                type="submit" 
                size="lg"
                disabled={isPending || !cardNumber.trim()}
                className="h-14 px-8 rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isPending ? "Processing..." : "Process Scan"}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground/60 mt-4 uppercase tracking-[0.2em] font-bold">
              Tip: Point your scanner at the library card barcode and press Enter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Clock className="w-32 h-32 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="text-xl">Library Attendance</CardTitle>
            <CardDescription>
              Confirm your presence in the library.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span>Today: {format(new Date(), "MMMM dd, yyyy")}</span>
                </div>
                {activeRecord && (
                  <p className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Currently Checked In
                  </p>
                )}
              </div>
              <Button 
                size="lg" 
                onClick={handleSelfLog} 
                disabled={isPending}
                className={cn(
                  "rounded-xl px-8 font-bold shadow-lg transition-all",
                  activeRecord && "bg-orange-600 hover:bg-orange-700"
                )}
              >
                {isPending ? (
                  "Processing..."
                ) : activeRecord ? (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Check Out
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Check In Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Attendance Records</h2>
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            Showing last {history.length} logs
          </div>
        </div>

        <div className="grid gap-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed bg-muted/20 text-muted-foreground">
              <Clock className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No attendance records found.</p>
            </div>
          ) : (
            history.map((record) => (
              <div 
                key={record.id}
                className="group flex items-center justify-between p-4 rounded-2xl border bg-card/50 hover:bg-card transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                    record.check_out_at ? "bg-muted/50" : "bg-green-500/10"
                  )}>
                    {record.check_out_at ? (
                      <History className="w-6 h-6 text-muted-foreground/50" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {record.profiles?.full_name || "Self Check-in"}
                      </p>
                      <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                        {format(new Date(record.check_in_at), "MMM dd")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <LogIn className="w-3 h-3" />
                        {format(new Date(record.check_in_at), "hh:mm a")}
                      </div>
                      {record.check_out_at ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          <ArrowRightLeft className="w-3 h-3 text-muted-foreground/30" />
                          <LogOut className="w-3 h-3" />
                          {format(new Date(record.check_out_at), "hh:mm a")}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-green-600 font-black uppercase tracking-wider animate-pulse">
                          Active Session
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm",
                    record.check_out_at 
                      ? "bg-muted/50 text-muted-foreground" 
                      : "bg-green-500/10 text-green-600 border border-green-500/20"
                  )}>
                    {record.check_out_at ? "Completed" : "Active"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
