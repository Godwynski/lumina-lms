"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Database, 
  Trash2, 
  AlertTriangle, 
  Terminal, 
  ArrowLeft, 
  Copy, 
  RotateCcw, 
  Play, 
  Flame, 
  ShieldAlert, 
  BookOpen,
  History,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { m } from "framer-motion";

type ActionType = 
  | "seed" 
  | "clear" 
  | "seed-catalog" 
  | "clear-catalog" 
  | "seed-logs-borrows" 
  | "clear-logs-borrows";

const ACTIONS_CONFIG = {
  "seed-catalog": {
    title: "Seed Catalog Only",
    description: "Clears and populates categories, books, and book copies. All copies will start as AVAILABLE status. No borrowing records are created.",
    type: "seed" as const,
    buttonText: "Seed Catalog Only",
    confirmText: "Seed Catalog Only: This will clear all catalog items (categories, books, copies) and dependent transactional data first, then seed fresh catalog books and copies in AVAILABLE status.",
    theme: "indigo"
  },
  "clear-catalog": {
    title: "Wipe Catalog Only",
    description: "Deletes all library categories, books, and copies. Also wipes borrowing history due to database foreign keys.",
    type: "clear" as const,
    buttonText: "Wipe Catalog Only",
    confirmText: "Wipe Catalog Only: This will delete all categories, books, and copies. Note that this also wipes all borrowing history, renewals, fines, and reservations.",
    theme: "rose"
  },
  "seed-logs-borrows": {
    title: "Seed Logs & History",
    description: "Clears and seeds borrowing records (active and returned), renewals, reservations, violations, fines, attendance logs, and audit logs. Requires Catalog.",
    type: "seed" as const,
    buttonText: "Seed Logs & Borrows",
    confirmText: "Seed Logs & History: This clears existing operational logs first, then seeds active/returned borrows, renewals, reservations, violations, fines, attendance, reports, and audit logs.",
    theme: "indigo"
  },
  "clear-logs-borrows": {
    title: "Wipe Logs & History",
    description: "Wipes borrowing records, renewals, fines, violations, attendance logs, and audit logs. Resets all book copies to AVAILABLE.",
    type: "clear" as const,
    buttonText: "Wipe History Only",
    confirmText: "Wipe Logs & History Only: This will delete all borrowing records, renewals, fines, violations, attendance records, notifications, reports, and audit logs, and reset all catalog copy statuses to AVAILABLE.",
    theme: "rose"
  },
  "seed": {
    title: "Complete System Seed",
    description: "Triggers a full database wipe, then seeds everything: catalog, library cards, borrowing records, renewals, reservations, attendance logs, and announcements.",
    type: "seed" as const,
    buttonText: "Trigger Full Seed",
    confirmText: "Complete System Seed: This runs a full database and file purge, then seeds categories, books, copies, library cards, borrowing history, attendance, fines, violations, reports, and announcements.",
    theme: "violet"
  },
  "clear": {
    title: "Complete System Purge",
    description: "Wipes all transactional data, catalog items, and files in storage buckets (avatars, book covers, library cards). Preserves only user profiles (avatars reset to NULL).",
    type: "clear" as const,
    buttonText: "Wipe Everything",
    confirmText: "Complete System Purge: This will delete all tables, reset user profiles avatar_urls to NULL, and completely clear the storage buckets (avatars, book-covers, library-cards). This cannot be undone.",
    theme: "rose"
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
} as const;

export default function SheeshPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"IDLE" | "RUNNING" | "SUCCESS" | "FAILED">("IDLE");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleActionClick = (type: ActionType) => {
    setActionType(type);
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    if (!actionType) return;
    
    const config = ACTIONS_CONFIG[actionType];
    setShowConfirmModal(false);
    setIsRunning(true);
    setStatus("RUNNING");
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 Initiating action: ${config.title}...`]);
    
    try {
      const response = await fetch("/api/sheesh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.logs && Array.isArray(data.logs)) {
          setLogs((prev) => [...prev, ...data.logs, `[${new Date().toLocaleTimeString()}] 🎉 ${config.title} completed successfully!`]);
        } else {
          setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 ${config.title} completed successfully!`]);
        }
        setStatus("SUCCESS");
        toast.success(`${config.title} completed successfully!`);
      } else {
        const errMsg = data.error || "An unknown error occurred.";
        setLogs((prev) => [...prev, `❌ Error: ${errMsg}`]);
        setStatus("FAILED");
        toast.error(`Execution failed: ${errMsg}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Failed to contact API endpoint";
      setLogs((prev) => [...prev, `❌ Network Error: ${errMsg}`]);
      setStatus("FAILED");
      toast.error(`Network error: ${errMsg}`);
    } finally {
      setIsRunning(false);
      setActionType(null);
    }
  };

  const copyToClipboard = () => {
    if (logs.length === 0) return;
    navigator.clipboard.writeText(logs.join("\n"));
    toast.success("Logs copied to clipboard!");
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-muted/40 overflow-x-hidden font-sans pb-16">
      {/* Radial Grid Background */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] opacity-30 [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>
      
      {/* Background Soft Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/[0.02] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-6">
        
        {/* Navigation Header */}
        <header className="flex justify-between items-center mb-12 pb-5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <Logo size={20} className="rotate-3 shrink-0" />
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-sm font-black tracking-tight uppercase">Lumina</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none mt-0.5">Dev Control Room</span>
            </div>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs font-semibold rounded-xl h-9">
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit to Dashboard
            </Button>
          </Link>
        </header>

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-wider mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sandbox Environment
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            Sandbox Control Center
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Manage system database state, seed test datasets, or wipe tables across catalog and transactional domains. Bypasses authentication for dev workflow velocity.
          </p>
        </div>

        {/* Warning Callout */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.02] p-4 flex items-start gap-3.5 mb-10 max-w-4xl mx-auto shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Dev Safety Notice</h4>
            <p className="text-xs text-amber-700/85 leading-relaxed mt-1">
              Actions executed from this control panel affect the active database deployment in real-time. Auth user accounts are preserved, but all transactional entities, logs, and library catalog records will be modified or removed.
            </p>
          </div>
        </div>

        {/* Action Columns (3-column logical grouping) */}
        <m.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-3 gap-6 mb-10"
        >
          
          {/* Card 1: Catalog Assets */}
          <m.div 
            variants={itemVariants}
            className="group relative flex flex-col justify-between rounded-xl border border-border/20 bg-card/30 p-6 backdrop-blur-sm shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:bg-card/50"
          >
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm tracking-tight">Catalog Assets</h3>
                  <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mt-0.5">Books & Inventory</p>
                </div>
              </div>
              
              <p className="text-muted-foreground text-xs leading-relaxed mb-4">
                Manages core library assets. Seeding imports categories, books, and book copies. Wiping clears all catalog items and dependent historical data.
              </p>

              <div className="space-y-1.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50">Affected Datasets</div>
                <div className="flex flex-wrap gap-1">
                  {["categories", "books", "book_copies"].map((d) => (
                    <span key={d} className="text-[9px] font-mono font-bold bg-muted/65 text-muted-foreground px-2 py-0.5 rounded border border-border/5">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Button 
                onClick={() => handleActionClick("seed-catalog")}
                disabled={isRunning}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs h-9 rounded-xl shadow-none"
              >
                {isRunning && actionType === "seed-catalog" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1.5" />
                    Seed
                  </>
                )}
              </Button>
              <Button 
                onClick={() => handleActionClick("clear-catalog")}
                disabled={isRunning}
                variant="outline"
                className="w-full border-rose-500/15 hover:bg-rose-500/5 hover:border-rose-500/30 text-rose-600 font-semibold text-xs h-9 rounded-xl transition-all"
              >
                {isRunning && actionType === "clear-catalog" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3 h-3 mr-1.5" />
                    Wipe
                  </>
                )}
              </Button>
            </div>
          </m.div>

          {/* Card 2: Circulation & Logs */}
          <m.div 
            variants={itemVariants}
            className="group relative flex flex-col justify-between rounded-xl border border-border/20 bg-card/30 p-6 backdrop-blur-sm shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:bg-card/50"
          >
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm tracking-tight">Circulation Ledger</h3>
                  <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mt-0.5">Logs & History</p>
                </div>
              </div>
              
              <p className="text-muted-foreground text-xs leading-relaxed mb-4">
                Manages transaction logs. Seeding adds simulated checkouts, active borrows, holds, violations, attendance, and security audit logs.
              </p>

              <div className="space-y-1.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50">Affected Datasets</div>
                <div className="flex flex-wrap gap-1">
                  {["borrows", "reservations", "violations", "attendance", "audit"].map((d) => (
                    <span key={d} className="text-[9px] font-mono font-bold bg-muted/65 text-muted-foreground px-2 py-0.5 rounded border border-border/5">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Button 
                onClick={() => handleActionClick("seed-logs-borrows")}
                disabled={isRunning}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs h-9 rounded-xl shadow-none"
              >
                {isRunning && actionType === "seed-logs-borrows" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1.5" />
                    Seed
                  </>
                )}
              </Button>
              <Button 
                onClick={() => handleActionClick("clear-logs-borrows")}
                disabled={isRunning}
                variant="outline"
                className="w-full border-rose-500/15 hover:bg-rose-500/5 hover:border-rose-500/30 text-rose-600 font-semibold text-xs h-9 rounded-xl transition-all"
              >
                {isRunning && actionType === "clear-logs-borrows" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3 h-3 mr-1.5" />
                    Wipe
                  </>
                )}
              </Button>
            </div>
          </m.div>

          {/* Card 3: Complete Orchestration */}
          <m.div 
            variants={itemVariants}
            className="group relative flex flex-col justify-between rounded-xl border border-border/20 bg-card/30 p-6 backdrop-blur-sm shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:bg-card/50"
          >
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm tracking-tight">Full System Orchestration</h3>
                  <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mt-0.5">Database & Media</p>
                </div>
              </div>
              
              <p className="text-muted-foreground text-xs leading-relaxed mb-4">
                Executes database-wide sweeps. Complete Seed wipes and repopulates everything. Complete Purge resets all data and files, preserving only user profiles.
              </p>

              <div className="space-y-1.5">
                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50">Affected Datasets</div>
                <div className="flex flex-wrap gap-1">
                  {["all_tables", "storage_buckets", "media_files"].map((d) => (
                    <span key={d} className="text-[9px] font-mono font-bold bg-muted/65 text-muted-foreground px-2 py-0.5 rounded border border-border/5">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Button 
                onClick={() => handleActionClick("seed")}
                disabled={isRunning}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-xs h-9 rounded-xl shadow-none"
              >
                {isRunning && actionType === "seed" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3 mr-1.5" />
                    Seed All
                  </>
                )}
              </Button>
              <Button 
                onClick={() => handleActionClick("clear")}
                disabled={isRunning}
                variant="outline"
                className="w-full border-rose-500/20 bg-rose-500/[0.02] hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-600 font-bold text-xs h-9 rounded-xl transition-all"
              >
                {isRunning && actionType === "clear" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Flame className="w-3 h-3 mr-1.5" />
                    Purge All
                  </>
                )}
              </Button>
            </div>
          </m.div>

        </m.div>

        {/* Console Logger Window */}
        <div className="rounded-xl border border-border/40 bg-zinc-950 shadow-md overflow-hidden max-w-4xl mx-auto animate-in fade-in duration-300">
          
          {/* Console Header */}
          <div className="flex justify-between items-center px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-zinc-400">System Logs Terminal</span>
              
              {/* Status Badge */}
              <span className={`text-[8px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded-md font-bold ${
                status === "IDLE" ? "bg-zinc-800 text-zinc-400 border border-zinc-700" :
                status === "RUNNING" ? "bg-indigo-950/85 text-indigo-300 border border-indigo-900/60 animate-pulse" :
                status === "SUCCESS" ? "bg-emerald-950/80 text-emerald-300 border border-emerald-900/60" :
                "bg-rose-950/80 text-rose-300 border border-rose-900/60"
              }`}>
                {status}
              </span>
            </div>
            
            <div className="flex gap-1.5">
              {logs.length > 0 && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={copyToClipboard}
                    className="h-6 text-[9px] text-zinc-400 hover:text-white px-2 hover:bg-zinc-800 font-semibold"
                  >
                    <Copy className="w-2.5 h-2.5 mr-1" />
                    Copy
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setLogs([]); setStatus("IDLE"); }}
                    className="h-6 text-[9px] text-zinc-400 hover:text-white px-2 hover:bg-zinc-800 font-semibold"
                  >
                    <RotateCcw className="w-2.5 h-2.5 mr-1" />
                    Reset
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Console Content */}
          <div 
            ref={logContainerRef}
            className="p-4 min-h-[180px] max-h-[300px] overflow-y-auto font-mono text-[10px] leading-relaxed text-zinc-300 bg-zinc-950 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
          >
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 pt-10 pb-8">
                <Play className="w-5 h-5 mb-2 opacity-20 animate-pulse" />
                <p className="text-[9px] font-bold uppercase tracking-wider">Terminal Ready</p>
                <p className="text-[9px] text-zinc-600 mt-1">Execute any database routine above to stream stdout logs.</p>
              </div>
            ) : (
              logs.map((log, index) => {
                const isError = log.includes("❌") || log.includes("⚠️") || log.includes("Error");
                const isSuccess = log.includes("✅") || log.includes("✨") || log.includes("🎉");
                const isSystem = log.includes("🚀") || log.includes("🧹") || log.includes("🌱");

                let colorClass = "text-zinc-300";
                if (isError) colorClass = "text-rose-400";
                else if (isSuccess) colorClass = "text-emerald-400";
                else if (isSystem) colorClass = "text-indigo-400";

                return (
                  <div key={index} className={`${colorClass} whitespace-pre-wrap break-all`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
          
          {/* Modal Container */}
          <div className="relative w-full max-w-md rounded-xl border border-border/40 bg-background p-6 shadow-lg z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5 text-amber-600 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-foreground">Confirm Sandbox Action</h3>
            </div>
            
            <p className="text-muted-foreground text-xs leading-relaxed mb-5">
              {ACTIONS_CONFIG[actionType].confirmText}
              <br /><br />
              <span className="text-rose-600 font-bold">This operation is destructive and cannot be undone. Are you sure you wish to proceed?</span>
            </p>
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="ghost" 
                onClick={() => setShowConfirmModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs h-8 px-3 rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                onClick={executeAction}
                className={ACTIONS_CONFIG[actionType].type === "seed" 
                  ? "bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-xs h-8 px-3.5 rounded-lg shadow-none"
                  : "bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-8 px-3.5 rounded-lg shadow-none"
                }
              >
                Confirm and Execute
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
