"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { toast } from "sonner";
import { lookupAndImportISBN } from "@/lib/actions/catalog";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface IsbnLog {
  isbn: string;
  status: "success" | "exists" | "error";
  message: string;
}

interface BatchTaskContextType {
  isISBNProcessing: boolean;
  isbnProgress: { current: number; total: number; currentIsbn: string };
  isbnLogs: IsbnLog[];
  startISBNLookup: (isbnList: string[]) => void;
  clearTask: () => void;
}

const BatchTaskContext = createContext<BatchTaskContextType | undefined>(undefined);

export function useBatchTask() {
  const context = useContext(BatchTaskContext);
  if (!context) {
    throw new Error("useBatchTask must be used within a BatchTaskProvider");
  }
  return context;
}

export function BatchTaskProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [isISBNProcessing, setIsISBNProcessing] = useState(false);
  const [isbnProgress, setIsbnProgress] = useState({ current: 0, total: 0, currentIsbn: "" });
  const [isbnLogs, setIsbnLogs] = useState<IsbnLog[]>([]);
  
  // UI state for floating bar
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  const clearTask = useCallback(() => {
    setIsISBNProcessing(false);
    setIsbnProgress({ current: 0, total: 0, currentIsbn: "" });
    setIsbnLogs([]);
    setShowCompletion(false);
    setIsExpanded(false);
  }, []);

  const startISBNLookup = async (isbnList: string[]) => {
    if (isISBNProcessing) return;

    setIsISBNProcessing(true);
    setShowCompletion(false);
    setIsbnProgress({ current: 0, total: isbnList.length, currentIsbn: isbnList[0] });
    setIsbnLogs([]);
    setIsExpanded(false); // keep it compact initially

    toast.info(`Starting sequential background lookup for ${isbnList.length} ISBNs.`);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const BATCH_SIZE = 3;
    let completedCount = 0;

    for (let i = 0; i < isbnList.length; i += BATCH_SIZE) {
      const batch = isbnList.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (isbn) => {
          try {
            const res = await lookupAndImportISBN(isbn);

            if (res.success) {
              if (res.status === "exists") {
                setIsbnLogs((prev) => [
                  ...prev,
                  {
                    isbn,
                    status: "exists",
                    message: `[RESOLVED] "${res.title}" already in catalog. Stock incremented by 1 copy.`,
                  },
                ]);
              } else {
                setIsbnLogs((prev) => [
                  ...prev,
                  {
                    isbn,
                    status: "success",
                    message: `[IMPORTED] "${res.title}" by ${res.author} successfully cataloged.`,
                  },
                ]);
              }
            } else {
              setIsbnLogs((prev) => [
                ...prev,
                {
                  isbn,
                  status: "error",
                  message: `[FAILED] ISBN ${isbn}: ${res.error || "Metadata lookup empty"}`,
                },
              ]);
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            setIsbnLogs((prev) => [
              ...prev,
              {
                isbn,
                status: "error",
                message: `[ERROR] ISBN ${isbn}: ${errMsg}`,
              },
            ]);
          } finally {
            completedCount++;
            setIsbnProgress((prev) => ({ ...prev, current: completedCount, currentIsbn: isbn }));
          }
        })
      );

      // Throttling to avoid rate limits
      if (i + BATCH_SIZE < isbnList.length) {
        await sleep(500);
      }
    }

    setIsISBNProcessing(false);
    setShowCompletion(true);
    toast.success("ISBN background import sequence completed!");
    router.refresh();
  };

  const isVisible = isISBNProcessing || showCompletion;

  const successCount = isbnLogs.filter(l => l.status === "success").length;
  const existsCount = isbnLogs.filter(l => l.status === "exists").length;
  const errorCount = isbnLogs.filter(l => l.status === "error").length;

  return (
    <BatchTaskContext.Provider
      value={{
        isISBNProcessing,
        isbnProgress,
        isbnLogs,
        startISBNLookup,
        clearTask,
      }}
    >
      {children}
      
      {/* Floating Global Progress Bar */}
      {isVisible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-lg transition-all duration-500 ease-out animate-in slide-in-from-bottom-10 fade-in">
          <div className="bg-background/95 backdrop-blur-xl border border-border/20 shadow-2xl rounded-3xl overflow-hidden ring-1 ring-primary/5">
            {/* Header / Main Bar */}
            <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300",
                  showCompletion ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                )}>
                  {showCompletion ? <CheckCircle2 className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold tracking-tight">
                    {showCompletion ? "Batch Lookup Complete" : "Background ISBN Import"}
                  </h4>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium mt-0.5">
                    {showCompletion ? (
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" /> {successCount} Added</span>
                        <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="h-3 w-3" /> {existsCount} Exists</span>
                        <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> {errorCount} Failed</span>
                      </div>
                    ) : (
                      <>
                        <span>{isbnProgress.current} of {isbnProgress.total}</span>
                        <span className="h-1 w-1 bg-muted-foreground/30 rounded-full" />
                        <span className="truncate max-w-[150px] inline-block align-bottom">{isbnProgress.currentIsbn || "Starting..."}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                {showCompletion && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      clearTask();
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar Line */}
            {!showCompletion && (
              <div className="h-1 w-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary via-indigo-500 to-primary transition-all duration-300 bg-[length:200%_auto] animate-gradient"
                  style={{ width: `${Math.max(2, (isbnProgress.current / (isbnProgress.total || 1)) * 100)}%` }}
                />
              </div>
            )}

            {/* Expanded Content (Logs) */}
            <div 
              className={cn(
                "transition-all duration-300 ease-in-out bg-muted/5 border-t border-border/5",
                isExpanded ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="p-4 flex flex-col h-full max-h-64">
                <div className="flex items-center justify-between mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5"><ListPlus className="h-3.5 w-3.5" /> Event Logs</span>
                  <span>{isbnLogs.length} Events</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar font-mono text-[10px]">
                  {isbnLogs.length === 0 ? (
                    <div className="text-center text-muted-foreground/50 py-4 italic">No logs generated yet...</div>
                  ) : (
                    isbnLogs.map((log, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-xl border border-transparent",
                          log.status === "success" && "bg-emerald-500/5 text-emerald-500 border-emerald-500/10",
                          log.status === "exists" && "bg-amber-500/5 text-amber-500 border-amber-500/10",
                          log.status === "error" && "bg-destructive/5 text-destructive border-destructive/10"
                        )}
                      >
                        {log.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : 
                         log.status === "exists" ? <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : 
                         <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                        <span className="leading-snug break-words">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </BatchTaskContext.Provider>
  );
}
