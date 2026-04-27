"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompactPagination } from "@/components/ui/compact-pagination";

export interface LuminaColumn<T> {
  header: string;
  accessor?: keyof T | ((item: T) => React.ReactNode);
  cell?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  mobileMain?: boolean;
}

interface EmptyState {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface LuminaTableProps<T> {
  data: T[];
  columns: LuminaColumn<T>[];
  onRowClick?: (item: T) => void;
  renderMobileRow?: (item: T) => React.ReactNode;
  isLoading?: boolean;
  rowClassName?: string;
  className?: string;
  
  // Pagination
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  
  // Empty State
  emptyState?: EmptyState;

  // Appearance
  noBorder?: boolean;
}

export function LuminaTable<T extends { id: string | number }>({
  data,
  columns,
  onRowClick,
  renderMobileRow,
  isLoading,
  rowClassName,
  className,
  totalCount,
  page,
  pageSize = 10,
  onPageChange,
  emptyState,
  noBorder,
}: LuminaTableProps<T>) {
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 0;

  const renderCell = (item: T, col: LuminaColumn<T>) => {
    if (col.cell) return col.cell(item);
    if (typeof col.accessor === "function") return col.accessor(item);
    if (col.accessor) return item[col.accessor] as React.ReactNode;
    return null;
  };

  const defaultMobileRow = (item: T) => {
    const mainCol = columns.find(c => c.mobileMain) || columns[0];
    return (
      <div className="flex flex-col gap-1">
        <div className="font-bold">{renderCell(item, mainCol)}</div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {columns.filter(c => c !== mainCol).map((c, i) => (
            <div key={i} className="text-[10px]">
              <span className="text-muted-foreground uppercase block mb-0.5">{c.header}</span>
              <div className="font-medium">{renderCell(item, c)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const mobileRenderer = renderMobileRow || defaultMobileRow;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className={cn(
        "w-full overflow-hidden transition-all duration-200",
        noBorder 
          ? "border-none bg-transparent shadow-none" 
          : "border border-border/40 bg-card/40 rounded-2xl backdrop-blur-sm shadow-sm"
      )}>
        {/* ── Mobile view ── */}
        <div className="md:hidden flex flex-col divide-y divide-border/50">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
              Loading...
            </div>
          ) : data.length > 0 ? (
            data.map((item) => (
              <div
                key={`mobile-${item.id}`}
                className={cn(
                  "p-4 transition-colors hover:bg-muted/40",
                  onRowClick && "cursor-pointer",
                  rowClassName
                )}
                onClick={() => onRowClick?.(item)}
              >
                {mobileRenderer(item)}
              </div>
            ))
          ) : (
            <div className="p-10 flex flex-col items-center justify-center text-center py-20">
              {emptyState?.icon && (
                <div className="mb-4 rounded-2xl bg-muted/20 p-4">
                  <emptyState.icon size={28} className="text-muted-foreground" />
                </div>
              )}
              <h3 className="text-sm font-bold text-foreground mb-1">{emptyState?.title || "No results found"}</h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-[250px] mx-auto">{emptyState?.description || "Try adjusting your search or filters."}</p>
              {emptyState?.action && (
                <Button variant="outline" size="sm" onClick={emptyState.action.onClick} className="h-8 text-[11px] font-bold rounded-xl">
                  {emptyState.action.label}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Desktop table ── */}
        <table className="hidden md:table w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/10 bg-muted/30">
              {columns.map((col, idx) => (
                <th
                  key={`head-${idx}`}
                  className={cn(
                    "px-4 py-3 text-[11px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Refreshing...</span>
                  </div>
                </td>
              </tr>
            ) : data.length > 0 ? (
              data.map((item) => (
                <tr
                  key={`desktop-${item.id}`}
                  className={cn(
                    "transition-colors hover:bg-muted/40 group",
                    onRowClick && "cursor-pointer",
                    rowClassName
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col, idx) => (
                    <td
                      key={`cell-${idx}`}
                      className={cn("px-4 py-3.5", col.className)}
                    >
                      {renderCell(item, col)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="p-10 flex flex-col items-center justify-center text-center py-20">
                    {emptyState?.icon && (
                      <div className="mb-4 rounded-2xl bg-muted/20 p-4">
                        <emptyState.icon size={32} className="text-muted-foreground" />
                      </div>
                    )}
                    <h3 className="text-base font-bold text-foreground mb-1">{emptyState?.title || "No results found"}</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-[300px] mx-auto">{emptyState?.description || "Try adjusting your search or filters."}</p>
                    {emptyState?.action && (
                      <Button variant="outline" size="sm" onClick={emptyState.action.onClick} className="h-9 px-6 text-xs font-bold rounded-xl shadow-sm">
                        {emptyState.action.label}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && onPageChange && page && (
        <div className="pt-2">
          <CompactPagination
            page={page ?? 1}
            totalItems={totalCount ?? 0}
            pageSize={pageSize}
            onPageChange={onPageChange}
            variant="ghost"
          />
        </div>
      )}
    </div>
  );
}
