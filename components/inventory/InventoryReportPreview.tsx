"use client";

import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface InventoryReportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Record<string, string | number>[];
  columnHeaders: string[];
  filterSummary: string;
  onExportExcel: () => void;
  isExporting: boolean;
}

function ReportPreviewTable({
  rows,
  columnHeaders,
}: {
  rows: Record<string, string | number>[];
  columnHeaders: string[];
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border/40 rounded-2xl">
        No catalog records match the current filters.
      </div>
    );
  }

  return (
    <table className="w-full text-left border-collapse text-xs">
      <thead>
        <tr className="border-b border-border/40 bg-muted/30">
          {columnHeaders.map((header) => (
            <th
              key={header}
              scope="col"
              className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] text-muted-foreground whitespace-nowrap"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/20">
        {rows.map((row, idx) => (
          <tr key={idx} className="hover:bg-muted/20">
            {columnHeaders.map((header) => (
              <td key={header} className="py-2 px-3 text-foreground align-top max-w-[260px] break-words">
                {row[header] !== undefined && row[header] !== "" ? String(row[header]) : "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function InventoryReportPreview({
  open,
  onOpenChange,
  rows,
  columnHeaders,
  filterSummary,
  onExportExcel,
  isExporting,
}: InventoryReportPreviewProps) {
  return (
    <>
      {open && (
        <div className="hidden print:block space-y-4">
          <div className="border-b pb-2">
            <h1 className="text-lg font-bold">Lumina LMS — Inventory Catalog Report</h1>
            <p className="text-xs text-muted-foreground">
              {filterSummary} · {rows.length} record(s)
            </p>
          </div>
          <ReportPreviewTable rows={rows} columnHeaders={columnHeaders} />
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:max-w-5xl rounded-3xl border border-border/20 bg-background p-6 shadow-2xl flex flex-col max-h-[88vh] z-[10000] print:hidden">
          <DialogHeader className="pb-3 border-b border-border/10">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Inventory Report Preview
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {filterSummary}
                </DialogDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-bold">
                {rows.length} {rows.length === 1 ? "record" : "records"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto rounded-xl border border-border/20 bg-card/40 my-3">
            <ReportPreviewTable rows={rows} columnHeaders={columnHeaders} />
          </div>

          <div className="pt-3 border-t border-border/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onExportExcel}
                disabled={isExporting || rows.length === 0 || columnHeaders.length === 0}
                className="h-9 rounded-xl gap-1.5 text-xs font-bold"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export (.xlsx)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                disabled={rows.length === 0 || columnHeaders.length === 0}
                className="h-9 rounded-xl gap-1.5 text-xs font-bold"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-4 text-xs font-bold">
                Close Preview
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
