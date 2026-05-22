"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileSpreadsheet,
  X,
  Calendar,
  Layers,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AuditLogExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  currentFilters: {
    query?: string;
    entityType?: string;
    actionType?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface ParsedAuditLog {
  created_at?: string | null;
  admin_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  reason?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  details?: unknown;
}

const AVAILABLE_COLUMNS = [
  { id: "created_at", label: "Timestamp", desc: "Date and time of the event" },
  { id: "full_name", label: "Admin Name", desc: "Full name of performing admin" },
  { id: "email", label: "Admin Email", desc: "Email of performing admin" },
  { id: "entity_type", label: "Entity Type", desc: "Target model (e.g. book, profile)" },
  { id: "entity_id", label: "Entity ID", desc: "Unique UUID of target model" },
  { id: "action", label: "Action Type", desc: "Action performed (create, update, etc.)" },
  { id: "reason", label: "Reason", desc: "Reason entered by the administrator" },
  { id: "old_value", label: "Old Value State", desc: "State details before mutation" },
  { id: "new_value", label: "New Value State", desc: "State details after mutation" },
  { id: "details", label: "Meta Details", desc: "Additional raw JSON metadata" },
];

function parseAnyDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Try to handle numbers or numeric strings
  const num = Number(val);
  if (!isNaN(num)) {
    // Is it a Unix timestamp in milliseconds? (e.g. 1779321600000)
    if (num >= 100000000000) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d;
    }
    // Is it a Unix timestamp in seconds? (e.g. 1779321600)
    if (num >= 100000000 && num < 100000000000) {
      const d = new Date(num * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    // Is it an Excel serial date? (e.g. 46161.58082175926)
    // Excel date serial numbers are positive numbers representing days since 1899-12-30.
    // We restrict range to [10000, 2000000] to avoid treating small numbers/years as serial dates.
    if (num >= 10000 && num < 2000000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 86400000;
      const d = new Date(excelEpoch.getTime() + num * msPerDay);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Try parsing as standard date string
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export function AuditLogExportImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  currentFilters,
}: AuditLogExportImportModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");

  // Export States
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "xlsx">("csv");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    AVAILABLE_COLUMNS.map((c) => c.id)
  );
  const [isExporting, setIsExporting] = useState(false);

  // Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedLogs, setParsedLogs] = useState<ParsedAuditLog[]>([]);
  const [parsedMeta, setParsedMeta] = useState<{
    total: number;
    validCount: number;
    invalidCount: number;
    dateRange: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessResult, setImportSuccessResult] = useState<{
    count: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map((c) => c.id));
  };

  const handleClearAllColumns = () => {
    setSelectedColumns([]);
  };

  const handleExportSubmit = async () => {
    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    setIsExporting(true);
    try {
      const exportParams = new URLSearchParams({
        format: exportFormat,
        columns: selectedColumns.join(","),
        ...(currentFilters.query && { query: currentFilters.query }),
        ...(currentFilters.entityType &&
          currentFilters.entityType !== "all" && {
            entityType: currentFilters.entityType,
          }),
        ...(currentFilters.actionType &&
          currentFilters.actionType !== "all" && {
            actionType: currentFilters.actionType,
          }),
        ...(currentFilters.startDate && { startDate: currentFilters.startDate }),
        ...(currentFilters.endDate && { endDate: currentFilters.endDate }),
      });

      // We trigger browser download using a direct window open or anchor click
      const downloadUrl = `/api/admin/audit-logs/export?${exportParams.toString()}`;
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.target = "_blank";
      link.download = `audit_logs_${format(new Date(), "yyyyMMdd_HHmm")}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exporting customized ${exportFormat.toUpperCase()} logs...`);
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch {
      toast.error("Failed to compile customized export");
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImportFile(file);
  };

  const processImportFile = (file: File) => {
    setImportFile(file);
    setIsParsing(true);
    setImportSuccessResult(null);

    const fileType = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let logsArray: ParsedAuditLog[] = [];

        if (fileType === "json") {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);
          logsArray = Array.isArray(parsed) ? parsed : [parsed];
        } else if (fileType === "csv" || fileType === "xlsx") {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

          // Map CSV headers to standard DB schema fields
          logsArray = rawRows.map((row) => {
            const cleanRow: Record<string, unknown> = {};
            Object.keys(row).forEach((key) => {
              const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
              cleanRow[cleanKey] = row[key];
            });

            // Parse embedded JSON strings for values
            const parseJsonSafe = (val: unknown) => {
              if (!val) return null;
              if (typeof val === "object") return val;
              try {
                return JSON.parse(String(val));
              } catch {
                return val;
              }
            };

            const rawDate = cleanRow.timestamp || cleanRow.created_at || cleanRow.time || null;
            const parsedDate = parseAnyDate(rawDate);
            return {
              created_at: parsedDate ? parsedDate.toISOString() : null,
              admin_id: (cleanRow.admin_id || null) as string | null,
              entity_type: (cleanRow.entity || cleanRow.entity_type || null) as string | null,
              entity_id: (cleanRow.entity_id || null) as string | null,
              action: (cleanRow.action || null) as string | null,
              reason: (cleanRow.reason || null) as string | null,
              old_value: parseJsonSafe(cleanRow.old_value || cleanRow.old_state),
              new_value: parseJsonSafe(cleanRow.new_value || cleanRow.new_state),
              details: parseJsonSafe(cleanRow.details || cleanRow.metadata || {}),
            };
          });
        } else {
          toast.error("Unsupported file format. Please upload JSON, CSV, or XLSX.");
          setIsParsing(false);
          setImportFile(null);
          return;
        }

        if (logsArray.length === 0) {
          toast.error("The file is empty.");
          setIsParsing(false);
          setImportFile(null);
          return;
        }

        // Validate items
        let validCount = 0;
        let invalidCount = 0;
        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        logsArray.forEach((log) => {
          // required: entity_type and action
          const hasRequired = log.entity_type && log.action;
          if (hasRequired) {
            validCount++;
          } else {
            invalidCount++;
          }

          if (log.created_at) {
            const d = new Date(String(log.created_at));
            if (!isNaN(d.getTime())) {
              if (!minDate || d < minDate) minDate = d;
              if (!maxDate || d > maxDate) maxDate = d;
            }
          }
        });

        let dateRangeStr = "N/A";
        if (minDate && maxDate) {
          dateRangeStr = `${format(minDate, "yyyy-MM-dd")} to ${format(
            maxDate,
            "yyyy-MM-dd"
          )}`;
        }

        setParsedLogs(logsArray);
        setParsedMeta({
          total: logsArray.length,
          validCount,
          invalidCount,
          dateRange: dateRangeStr,
        });

        if (invalidCount > 0) {
          toast.warning(
            `Parsed file. Warning: ${invalidCount} rows are missing required entity/action columns.`
          );
        } else {
          toast.success(`Successfully parsed ${validCount} audit records.`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`File parsing error: ${message}`);
        setImportFile(null);
      } finally {
        setIsParsing(false);
      }
    };

    if (fileType === "json") {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleStartImport = async () => {
    if (parsedLogs.length === 0 || !parsedMeta) return;

    if (parsedMeta.validCount === 0) {
      toast.error("No valid records found to import.");
      return;
    }

    setIsImporting(true);
    try {
      // Filter out invalid records before posting
      const validRecords = parsedLogs.filter(
        (log) => log.entity_type && log.action
      );

      const res = await fetch("/api/admin/audit-logs/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ logs: validRecords }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Batch import failed");
      }

      setImportSuccessResult({ count: data.count });
      toast.success(`Restoration complete! ${data.count} audit logs inserted.`);
      
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to commit audit logs restoration";
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImportFile(file);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setParsedLogs([]);
    setParsedMeta(null);
    setImportSuccessResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl md:max-w-2xl bg-background/95 backdrop-blur-md rounded-3xl border border-border/20 shadow-2xl p-0 overflow-hidden transition-all duration-300">
        
        {/* Header Section */}
        <div className="p-6 pb-4 border-b border-border/10 bg-muted/10">
          <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Audit Log Operations
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configure customizations to download logs, or import audit backup files.
          </DialogDescription>

          {/* Custom Switcher Tabs */}
          <div className="flex gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border/5 mt-4">
            <button
              onClick={() => {
                setActiveTab("export");
                resetImport();
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-3 rounded-xl transition-all",
                activeTab === "export"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground/75 hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <Download className="h-3.5 w-3.5" />
              Custom Export Settings
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-3 rounded-xl transition-all",
                activeTab === "import"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground/75 hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              Restoration & Import
            </button>
          </div>
        </div>

        {/* Tab Content Panel */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === "export" ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Format selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  File Output Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat("csv")}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all",
                      exportFormat === "csv"
                        ? "bg-primary/[0.04] border-primary text-primary"
                        : "bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <FileSpreadsheet className="h-5 w-5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Spreadsheet CSV</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Compatible with Excel, Numbers</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat("json")}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all",
                      exportFormat === "json"
                        ? "bg-primary/[0.04] border-primary text-primary"
                        : "bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <FileCode className="h-5 w-5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Developer JSON</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Structured database format</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat("xlsx")}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1",
                      exportFormat === "xlsx"
                        ? "bg-primary/[0.04] border-primary text-primary"
                        : "bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <FileSpreadsheet className="h-5 w-5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Excel XLSX</div>
                      <div className="text-[10px] opacity-70 mt-0.5">Native MS Excel format</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Columns Selector Checklist */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Settings className="h-3.5 w-3.5" />
                    Customize Columns ({selectedColumns.length} / {AVAILABLE_COLUMNS.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllColumns}
                      className="text-[10px] font-bold text-primary hover:underline bg-transparent border-0 p-0"
                    >
                      Select All
                    </button>
                    <span className="text-[10px] text-muted-foreground/30">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllColumns}
                      className="text-[10px] font-bold text-muted-foreground/60 hover:text-foreground hover:underline bg-transparent border-0 p-0"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4 rounded-3xl bg-muted/10 border border-border/10 max-h-[220px] overflow-y-auto">
                  {AVAILABLE_COLUMNS.map((col) => {
                    const isSelected = selectedColumns.includes(col.id);
                    return (
                      <div
                        key={col.id}
                        onClick={() => handleColumnToggle(col.id)}
                        className={cn(
                          "flex items-start gap-2.5 p-2 rounded-xl border border-transparent cursor-pointer transition-all hover:bg-muted/25 select-none",
                          isSelected ? "bg-muted/10" : "opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="mt-0.5 accent-primary h-3.5 w-3.5 rounded border-border/20 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold block">{col.label}</span>
                          <span className="text-[9px] text-muted-foreground leading-tight block truncate">
                            {col.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Filter Indicators */}
              <div className="p-3.5 rounded-2xl bg-muted/15 border border-border/5 text-[11px] text-muted-foreground/80 flex flex-wrap gap-x-4 gap-y-1.5 items-center">
                <span className="font-bold text-[9px] uppercase tracking-wider text-muted-foreground/50">Active Filters:</span>
                {currentFilters.query ? (
                  <span className="flex items-center gap-1">Search: &quot;{currentFilters.query}&quot;</span>
                ) : null}
                {currentFilters.entityType && currentFilters.entityType !== "all" ? (
                  <span className="flex items-center gap-1">Entity: <span className="capitalize">{currentFilters.entityType}</span></span>
                ) : null}
                {currentFilters.actionType && currentFilters.actionType !== "all" ? (
                  <span className="flex items-center gap-1">Action: <span className="capitalize">{currentFilters.actionType}</span></span>
                ) : null}
                {currentFilters.startDate || currentFilters.endDate ? (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 inline text-muted-foreground/50" />
                    {currentFilters.startDate || "..."} to {currentFilters.endDate || "..."}
                  </span>
                ) : null}
                {!currentFilters.query && (!currentFilters.entityType || currentFilters.entityType === "all") && (!currentFilters.actionType || currentFilters.actionType === "all") && !currentFilters.startDate && !currentFilters.endDate ? (
                  <span className="italic text-muted-foreground/45">No active filters (downloading entire logs history)</span>
                ) : null}
              </div>

            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Disclaimer */}
              <div className="flex gap-3 p-4 rounded-2xl border border-red-500/10 bg-red-500/[0.02] text-red-500/90 text-xs">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
                <div className="space-y-1">
                  <div className="font-bold text-red-600">Restoration Warning</div>
                  <p className="leading-relaxed opacity-85">
                    Audit logs are security-critical records. Importing or restoring records will insert them back into the active database log trail. All changes are logged, and this action itself will trigger an audit record identifying your account.
                  </p>
                </div>
              </div>

              {/* Upload drag drop zone */}
              {!importFile && !importSuccessResult ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/20 bg-muted/5 hover:bg-muted/15 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-primary/45 group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json,.csv,.xlsx"
                    className="hidden"
                  />
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center transition-all group-hover:scale-105 duration-300">
                    <Upload className="h-5 w-5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="mt-3 text-xs font-bold">Drag & Drop Log Backup</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1 max-w-[280px]">
                    Supports JSON (native exports), CSV, or Excel XLSX files containing audit logs.
                  </div>
                  <Button variant="link" size="sm" className="mt-3 h-8 text-[11px] font-bold text-primary">
                    Browse Files
                  </Button>
                </div>
              ) : null}

              {/* Parsing Loader */}
              {isParsing && (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-muted/5 border border-border/10 rounded-3xl">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <span className="text-xs font-bold mt-2.5">Reading audit logs file...</span>
                </div>
              )}

              {/* Parsed Meta Information Preview */}
              {parsedMeta && !isParsing && !importSuccessResult && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between p-3.5 bg-muted/10 border border-border/10 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                        {parsedMeta.validCount}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{importFile?.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Time range: {parsedMeta.dateRange}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={resetImport}
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Dry Run Summary statistics grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/5 border border-border/5 rounded-2xl p-3 text-center">
                      <div className="text-xs font-black text-foreground">{parsedMeta.total}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 mt-0.5">
                        Total Rows
                      </div>
                    </div>
                    <div className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-2xl p-3 text-center">
                      <div className="text-xs font-black text-emerald-600">{parsedMeta.validCount}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-500/60 mt-0.5">
                        Valid Records
                      </div>
                    </div>
                    <div className={cn(
                      "rounded-2xl p-3 text-center border",
                      parsedMeta.invalidCount > 0 
                        ? "bg-amber-500/[0.02] border-amber-500/10" 
                        : "bg-muted/5 border-border/5"
                    )}>
                      <div className={cn("text-xs font-black", parsedMeta.invalidCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
                        {parsedMeta.invalidCount}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 mt-0.5">
                        Skipped Rows
                      </div>
                    </div>
                  </div>

                  {/* MINI Data Preview Table */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      First Records Preview
                    </span>
                    <div className="border border-border/10 rounded-2xl overflow-hidden text-xs max-h-[140px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/20 border-b border-border/10 text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                            <th className="p-2 pl-3">Action</th>
                            <th className="p-2">Entity</th>
                            <th className="p-2">Reason</th>
                            <th className="p-2 pr-3">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/5">
                          {parsedLogs.slice(0, 3).map((log, idx) => (
                            <tr key={idx} className="hover:bg-muted/5 transition-colors">
                              <td className="p-2 pl-3 font-semibold text-primary capitalize">{log.action || "-"}</td>
                              <td className="p-2 capitalize">{log.entity_type || "-"}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[150px]">{log.reason || <span className="opacity-30">None</span>}</td>
                              <td className="p-2 pr-3 text-muted-foreground/60 text-[10px]">
                                {log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm") : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Import Success Screen */}
              {importSuccessResult && (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-3xl animate-in zoom-in-95 duration-200">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-bold text-emerald-700 mt-4">Restoration Complete!</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                    Successfully inserted {importSuccessResult.count} valid audit logs into the database trail.
                  </p>
                  <Button variant="outline" size="sm" onClick={resetImport} className="mt-4 rounded-xl border border-border/20 text-xs">
                    Import Another File
                  </Button>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border/10 bg-muted/10 flex items-center justify-end gap-3.5">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isExporting || isImporting}
            className="rounded-xl border border-border/20 text-xs"
          >
            Cancel
          </Button>

          {activeTab === "export" ? (
            <Button
              onClick={handleExportSubmit}
              disabled={isExporting || selectedColumns.length === 0}
              className="rounded-xl font-bold text-xs"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Download Backup File
                </>
              )}
            </Button>
          ) : (
            parsedMeta && !importSuccessResult && (
              <Button
                variant="destructive"
                onClick={handleStartImport}
                disabled={isImporting || parsedMeta.validCount === 0}
                className="rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Restoring logs...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-2" />
                    Commit Restoration
                  </>
                )}
              </Button>
            )
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
