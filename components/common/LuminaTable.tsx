"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type LucideIcon, Loader2, SearchX } from "lucide-react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { EmptyState as EmptyStateView } from "@/components/ui/empty-state";

export interface LuminaColumn<T> {
  header: React.ReactNode;
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
  variant?: "first-use" | "no-results";
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
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

  // `asButton` is used for the mobile card rows. Desktop <tr> rows keep their
  // row role so table semantics survive.
  const rowKeyboardProps = (item: T, asButton = false) => onRowClick ? {
    tabIndex: 0,
    ...(asButton ? { role: "button" } : {}),
    onKeyDown: (e: React.KeyboardEvent) => {
      // Keys pressed on nested controls (checkboxes, buttons) belong to them.
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRowClick(item);
      }
    },
  } : {};

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
        <div className="font-semibold">{renderCell(item, mainCol)}</div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {columns.filter(c => c !== mainCol).map((c, i) => (
            <div key={i} className="text-xs">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">{c.header}</span>
              <div className="font-medium">{renderCell(item, c)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const mobileRenderer = renderMobileRow || defaultMobileRow;
  const isEmpty = !isLoading && data.length === 0;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className={cn(
        "w-full overflow-hidden transition-all duration-200",
        noBorder 
          ? "border-none bg-transparent shadow-none" 
          : "border border-border/50 bg-card/60 rounded-2xl backdrop-blur-sm shadow-sm"
      )}>
        {isEmpty ? (
          <EmptyStateView
            noCard
            variant={emptyState?.variant ?? "no-results"}
            icon={emptyState?.icon ?? SearchX}
            title={emptyState?.title || "No matches found"}
            description={emptyState?.description || "Try adjusting your search or filters."}
            action={emptyState?.action}
          />
        ) : (
          <>
            {/* ── Mobile view ── */}
            <div className="md:hidden print:hidden flex flex-col divide-y divide-border/50">
              {isLoading ? (
                <div className="p-8 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Refreshing...</span>
                </div>
              ) : (
                data.map((item) => (
                  <div
                    key={`mobile-${item.id}`}
                    className={cn(
                      "p-4 transition-colors hover:bg-muted/40",
                      onRowClick && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                      rowClassName
                    )}
                    onClick={() => onRowClick?.(item)}
                    {...rowKeyboardProps(item, true)}
                  >
                    {mobileRenderer(item)}
                  </div>
                ))
              )}
            </div>

            {/* ── Desktop table ── */}
            <table className="hidden md:table print:table w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/20 bg-muted/30">
                  {columns.map((col, idx) => (
                    <th
                      key={`head-${idx}`}
                      scope="col"
                      className={cn(
                        "px-4 py-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                        col.headerClassName
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/15">
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">Refreshing...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr
                      key={`desktop-${item.id}`}
                      className={cn(
                        "transition-colors hover:bg-muted/40 group",
                        onRowClick && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                        rowClassName
                      )}
                      onClick={() => onRowClick?.(item)}
                      {...rowKeyboardProps(item)}
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
                )}
              </tbody>
            </table>
          </>
        )}
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
