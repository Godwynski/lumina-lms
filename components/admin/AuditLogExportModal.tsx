"use client";

import React, { useState } from "react";
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
  Loader2,
  FileCode,
  FileSpreadsheet,
  Calendar,
  Layers,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AuditLogExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: {
    query?: string;
    entityType?: string;
    actionType?: string;
    startDate?: string;
    endDate?: string;
    bookId?: string;
    studentId?: string;
    copyId?: string;
    userId?: string;
  };
}

const AVAILABLE_COLUMNS = [
  { id: "book_title", label: "Book", desc: "Book involved in the record" },
  { id: "book_isbn", label: "ISBN", desc: "Book identifier" },
  { id: "copy_barcode", label: "Copy barcode", desc: "Physical copy involved" },
  { id: "student_name", label: "Student", desc: "Student involved, independently of the staff actor" },
  { id: "student_number", label: "Patron ID", desc: "School patron identifier" },
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

export function AuditLogExportModal({
  isOpen,
  onClose,
  currentFilters,
}: AuditLogExportModalProps) {
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "xlsx">("csv");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    AVAILABLE_COLUMNS.map((c) => c.id)
  );
  const [isExporting, setIsExporting] = useState(false);

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
        ...(currentFilters.bookId && { bookId: currentFilters.bookId }),
        ...(currentFilters.studentId && { studentId: currentFilters.studentId }),
        ...(currentFilters.copyId && { copyId: currentFilters.copyId }),
        ...(currentFilters.userId && { userId: currentFilters.userId }),
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col max-w-xl md:max-w-2xl bg-background/95 backdrop-blur-md rounded-2xl border border-border/40 shadow-2xl p-0 overflow-hidden transition-all duration-300">
        <div className="shrink-0 p-6 pb-4 border-b border-border/20 bg-muted/15">
          <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Export Audit Logs
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configure customizations to download audit logs.
          </DialogDescription>
        </div>

        <div className="flex-1 min-h-0 p-6 overflow-y-auto">
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Format selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  File Output Format
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                  <button
                    type="button"
                    aria-pressed={exportFormat === "csv"}
                    onClick={() => setExportFormat("csv")}
                    className={cn(
                      "flex h-full items-start gap-3 p-3.5 rounded-xl border text-left transition-all",
                      exportFormat === "csv"
                        ? "bg-primary/[0.04] border-primary text-primary"
                        : "bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <FileSpreadsheet className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold">Spreadsheet CSV</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Comma-separated</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-pressed={exportFormat === "json"}
                    onClick={() => setExportFormat("json")}
                    className={cn(
                      "flex h-full items-start gap-3 p-3.5 rounded-xl border text-left transition-all",
                      exportFormat === "json"
                        ? "bg-primary/[0.04] border-primary text-primary"
                        : "bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <FileCode className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold">Developer JSON</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Structured JSON</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-pressed={exportFormat === "xlsx"}
                    onClick={() => setExportFormat("xlsx")}
                    className={cn(
                      "flex h-full items-start gap-3 p-3.5 rounded-xl border text-left transition-all",
                      exportFormat === "xlsx"
                        ? "bg-primary/[0.04] border-primary text-primary"
                        : "bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    <FileSpreadsheet className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold">Excel XLSX</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Excel workbook</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Columns Selector Checklist */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    Customize Columns ({selectedColumns.length} / {AVAILABLE_COLUMNS.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllColumns}
                      className="text-xs font-semibold text-primary hover:underline bg-transparent border-0 p-0"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllColumns}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline bg-transparent border-0 p-0"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4 rounded-2xl bg-muted/10 border border-border/20">
                  {AVAILABLE_COLUMNS.map((col) => {
                    const isSelected = selectedColumns.includes(col.id);
                    return (
                      // A wrapping label names the checkbox and makes the whole row toggle it natively.
                      <label
                        key={col.id}
                        className={cn(
                          "flex items-start gap-2.5 p-2 rounded-xl border border-transparent cursor-pointer transition-colors hover:bg-muted/25 select-none",
                          isSelected ? "bg-muted/15" : "text-muted-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleColumnToggle(col.id)}
                          className="mt-0.5 accent-primary h-3.5 w-3.5 rounded border-border/20 cursor-pointer"
                        />
                        <span className="min-w-0">
                          <span className="text-xs font-bold block">{col.label}</span>
                          <span className="text-[11px] text-muted-foreground leading-tight block truncate">
                            {col.desc}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Filter Indicators */}
              <div className="p-3.5 rounded-2xl bg-muted/15 border border-border/5 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1.5 items-center">
                <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Active Filters:</span>
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
                {(currentFilters.bookId || currentFilters.studentId || currentFilters.copyId || currentFilters.userId) && <span>Selected book, student, copy, and staff filters are included.</span>}
                {!currentFilters.bookId && !currentFilters.studentId && !currentFilters.copyId && !currentFilters.userId && !currentFilters.query && (!currentFilters.entityType || currentFilters.entityType === "all") && (!currentFilters.actionType || currentFilters.actionType === "all") && !currentFilters.startDate && !currentFilters.endDate ? (
                  <span className="italic text-muted-foreground">No active filters (downloading entire logs history)</span>
                ) : null}
              </div>

            </div>
        </div>

        <div className="p-6 border-t border-border/10 bg-muted/10 flex items-center justify-end gap-3.5">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
            className="rounded-xl border border-border/20 text-xs"
          >
            Cancel
          </Button>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
