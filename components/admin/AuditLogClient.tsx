"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuditSubjectFilter, AuditSubjectChip } from "./AuditSubjectFilter";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, 
  Download, 
  Filter, 
  ChevronRight,
  SlidersHorizontal,
  X
} from "lucide-react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { AdminTableShell } from "./AdminTableShell";
import { OverflowActionsMenu } from "@/components/common/OverflowActionsMenu";
import { SortableTableHeader, TableSortSelect } from "@/components/common/TableSort";

const timestampSortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const AuditLogExportImportModal = dynamic(
  () => import("./AuditLogExportImportModal").then((mod) => mod.AuditLogExportImportModal),
  { ssr: false }
);

// Always shown in library time (Asia/Manila), whatever the viewer's browser zone is.
const manilaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function formatManilaTimestamp(iso: string) {
  const parts = Object.fromEntries(
    manilaFormatter.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

// --- Types & Interfaces ---

interface FetcherError extends Error {
  info?: unknown;
  status?: number;
}

type AuditLogDetailItem = Record<string, unknown> | string | number;

interface AuditLogDetails {
  added?: AuditLogDetailItem[];
  removed?: AuditLogDetailItem[];
  [key: string]: unknown;
}

interface AuditLog {
  id: string;
  admin_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  reason: string | null;
  details: AuditLogDetails | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  subject_book_id?: string | null;
  subject_student_id?: string | null;
  subject_copy_id?: string | null;
  book_title?: string | null;
  student_name?: string | null;
  student_number?: string | null;
  copy_barcode?: string | null;
  copy_accession?: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
}

export interface EntityOption {
  value: string;
  label: string;
  description: string;
  tooltip: string;
}

export interface EntityGroup {
  name: string;
  items: EntityOption[];
}

export const ENTITY_GROUPS: EntityGroup[] = [
  {
    name: "General",
    items: [
      {
        value: "all",
        label: "All Entities",
        description: "View logs across all system modules",
        tooltip: "Active: Display audit events from all modules across the database."
      }
    ]
  },
  {
    name: "Catalog & Inventory",
    items: [
      {
        value: "book",
        label: "Books",
        description: "Titles, authors, ISBNs, and catalog data",
        tooltip: "Active: Acquisitions, metadata edits, and book archiving."
      },
      {
        value: "book_copy",
        label: "Book Copies",
        description: "Physical barcodes and copy accessions",
        tooltip: "Active: Individual inventory copies, barcodes, and condition updates."
      },
      {
        value: "category",
        label: "Categories",
        description: "Dewey Decimal classifications and genres",
        tooltip: "Active: Academic subjects, genre taxonomy, and category management."
      }
    ]
  },
  {
    name: "Circulation & Patrons",
    items: [
      {
        value: "borrowing_record",
        label: "Borrowing Records",
        description: "Front-desk checkouts and return logs",
        tooltip: "Active: Circulation desk checkouts, returns, and loan tracking."
      },
      {
        value: "reservation",
        label: "Reservations",
        description: "Hold requests, queue positions, and expirations",
        tooltip: "Active: Book reservations, waiting queues, and hold pickups."
      },
      {
        value: "library_card",
        label: "Library Cards",
        description: "Digital patron cards and status updates",
        tooltip: "Active: Issuing, activating, and renewing digital student library cards."
      },
      {
        value: "profile",
        label: "User Profiles",
        description: "Patron & staff accounts, roles, and status",
        tooltip: "Active: Account creation, role assignments, and onboarding."
      }
    ]
  },
  {
    name: "Administration & System",
    items: [
      {
        value: "policy",
        label: "System Policies",
        description: "Circulation limits and loan duration rules",
        tooltip: "Active: System settings, borrow limits, and grace period policies."
      },
      {
        value: "system",
        label: "System Operations",
        description: "Annual resets, maintenance & transfers",
        tooltip: "Active: Academic year transitions, ownership transfers, and system jobs."
      }
    ]
  }
];

export interface ActionOption {
  value: string;
  label: string;
  description: string;
  tooltip: string;
}

export const ACTION_OPTIONS: ActionOption[] = [
  {
    value: "all",
    label: "All Actions",
    description: "View all recorded activity types",
    tooltip: "Active: Show every mutation, circulation, and administrative event."
  },
  {
    value: "create",
    label: "Create / Acquisition",
    description: "New books, copies, or categories added",
    tooltip: "Active: New acquisitions, catalog additions, and created records."
  },
  {
    value: "update",
    label: "Update / Edit",
    description: "Modifications to records or policies",
    tooltip: "Active: Configuration updates, profile changes, and metadata edits."
  },
  {
    value: "archive",
    label: "Archive / Deactivate",
    description: "Soft deletes, archives, or deactivations",
    tooltip: "Active: Deactivated accounts, archived categories, and soft removals."
  },
  {
    value: "checkout",
    label: "Circulation Checkout",
    description: "Front-desk book checkouts to patrons",
    tooltip: "Active: Desk checkouts and barcode scans for patrons."
  },
  {
    value: "return",
    label: "Book Return",
    description: "Books returned and reshelved",
    tooltip: "Active: Books checked in and returned to library inventory."
  },
  {
    value: "issuance",
    label: "Card Issuance",
    description: "Digital library cards generated or activated",
    tooltip: "Active: Activation and issuance of patron library cards."
  },
  {
    value: "login",
    label: "Auth & Identity",
    description: "Sign-ins, onboarding, and role updates",
    tooltip: "Active: Account logins, onboarding completions, and role transfers."
  }
];

const IGNORED_KEYS = ['id', 'created_at', 'updated_at', 'deleted_at', 'metadata'];

// --- Helper Functions ---

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.') as FetcherError;
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
};

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  
  if (Array.isArray(v)) {
    if (v.length === 0) return 'Empty';
    return `${v.length} items`;
  }

  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    
    // Try to find a human-friendly identifier
    const label = obj.full_name || obj.name || obj.title || obj.label || obj.email || obj.display_name;
    if (label && typeof label === 'string') return label;

    // Filter out internal/ignored keys
    const entries = Object.entries(obj).filter(([k]) => !IGNORED_KEYS.includes(k));
    
    if (entries.length === 0) return 'Object Data';
    
    // Show a summary of first 2 meaningful fields
    return entries
      .slice(0, 2)
      .map(([k, val]) => {
        const displayVal = typeof val === 'object' ? (Array.isArray(val) ? 'List' : 'Data') : String(val);
        return `${k.replace(/_/g, ' ')}: ${displayVal}`;
      })
      .join(', ') + (entries.length > 2 ? '...' : '');
  }
  
  return String(v);
};

const parseLogDetails = (details: unknown): AuditLogDetails | null => {
  if (!details) return null;
  if (typeof details === 'object') return details as AuditLogDetails;
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      return typeof parsed === 'object' && parsed !== null ? (parsed as AuditLogDetails) : null;
    } catch {
      return null;
    }
  }
  return null;
};

// --- Subcomponents ---

/**
 * Renders a visual diff between old and new state objects.
 */
function DataDiff({ oldVal, newVal }: { oldVal: Record<string, unknown> | null; newVal: Record<string, unknown> | null }) {
  if (!oldVal && !newVal) return null;
  
  // Creation state
  if (!oldVal && newVal) {
    const fields = Object.entries(newVal).filter(([k]) => !IGNORED_KEYS.includes(k));
    if (fields.length === 0) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-4 bg-primary/[0.03] rounded-2xl border border-primary/10">
        {fields.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{k.replace(/_/g, ' ')}</span>
            <span className="text-xs font-bold text-primary truncate">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  
  // Deletion state
  if (oldVal && !newVal) {
    const fields = Object.entries(oldVal).filter(([k]) => !IGNORED_KEYS.includes(k));
    if (fields.length === 0) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-4 bg-muted/20 rounded-2xl border border-border/5">
        {fields.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 min-w-0 line-through decoration-muted-foreground/30">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{k.replace(/_/g, ' ')}</span>
            <span className="text-xs font-medium text-muted-foreground truncate">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Update state
  if (!oldVal || !newVal) return null;

  const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  const changes = Array.from(keys).filter(k => {
    if (IGNORED_KEYS.includes(k)) return false;
    return JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k]);
  });

  if (changes.length === 0) return null;

  return (
    <div className="space-y-1 bg-muted/10 rounded-lg p-3 border border-border/10 overflow-x-auto">
      {changes.map(k => (
        <div key={k} className="flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] py-1 border-b border-border/5 last:border-0 font-mono">
          <span className="font-bold text-muted-foreground w-32 shrink-0 truncate">
            {k}
          </span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="line-through text-muted-foreground truncate max-w-[200px]">
              {formatValue(oldVal[k])}
            </span>
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
            <span className="text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded break-all shadow-xs border border-primary/5">
              {formatValue(newVal[k])}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Component ---

export function AuditLogClient({ userRole = "super_admin" }: { userRole?: string } = {}) {
  const canImport = userRole === "super_admin";
  const urlFilters = useSearchParams();
  const updateFilters = useCallback((changes: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value && (key === "query" || value !== "all")) params.set(key, value); else params.delete(key);
    }
    if (!("page" in changes)) params.delete("page");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, []);
  const page = Math.max(1, Math.floor(Number(urlFilters.get("page"))) || 1);
  const setPage = (value: number) => updateFilters({ page: value === 1 ? "" : String(value) });
  const sort = urlFilters.get("sort") === "oldest" ? "oldest" : "newest";
  const [search, setSearch] = useState(urlFilters.get("query") || "");
  const debouncedSearch = urlFilters.get("query") || "";
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setSort = (value: string) => {
    clearTimeout(searchTimer.current);
    updateFilters({ sort: value === "oldest" ? value : "", query: search });
  };
  const setDebouncedSearch = useCallback((query: string) => updateFilters({ query }), [updateFilters]);
  const entityType = urlFilters.get("entityType") || "all";
  const setEntityType = (entityType: string) => updateFilters({ entityType });
  const actionType = urlFilters.get("actionType") || "all";
  const setActionType = (actionType: string) => updateFilters({ actionType });
  const startDate = urlFilters.get("startDate") || "";
  const setStartDate = (startDate: string) => updateFilters({ startDate });
  const endDate = urlFilters.get("endDate") || "";
  const setEndDate = (endDate: string) => updateFilters({ endDate });
  const bookId = urlFilters.get("bookId") || "";
  const studentId = urlFilters.get("studentId") || "";
  const copyId = urlFilters.get("copyId") || "";
  const userId = urlFilters.get("userId") || "";
  const [detailBookId, setDetailBookId] = useState<string | null>(null);

  const handleStartDateChange = (val: string) => {
    if (val && endDate && val > endDate) {
      toast.error("Start date cannot be after end date");
      return;
    }
    setStartDate(val);
    setPage(1);
  };

  const handleEndDateChange = (val: string) => {
    if (val && startDate && val < startDate) {
      toast.error("End date cannot be before start date");
      return;
    }
    setEndDate(val);
    setPage(1);
  };

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleClearAllFilters = () => {
    setSearch("");
    updateFilters({ query: "", entityType: "", actionType: "", startDate: "", endDate: "", bookId: "", studentId: "", copyId: "", userId: "", page: "" });
    toast.success("All filters cleared");
  };

  const activeAdvancedFilterCount = [bookId, studentId, copyId, userId, entityType !== "all", actionType !== "all", startDate || endDate].filter(Boolean).length;

  const hasAnyFilterActive = useMemo(() => {
    return !!(bookId || studentId || copyId || userId || search || entityType !== "all" || actionType !== "all" || startDate || endDate);
  }, [search, entityType, actionType, startDate, endDate, bookId, studentId, copyId, userId]);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);

  const pageSize = 20; // Increased page size for dense table

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (new URLSearchParams(window.location.search).get("query") || "")) setDebouncedSearch(search);
    }, 400);
    searchTimer.current = timer;
    return () => clearTimeout(timer);
  }, [search, setDebouncedSearch]);

  useEffect(() => { setSearch(debouncedSearch); }, [debouncedSearch]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: ((page - 1) * pageSize).toString(),
      ...(sort === "oldest" && { sort }),
      ...(debouncedSearch && { query: debouncedSearch }),
      ...(entityType !== "all" && { entityType }),
      ...(actionType !== "all" && { actionType }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(bookId && { bookId }),
      ...(studentId && { studentId }),
      ...(copyId && { copyId }),
      ...(userId && { userId }),
    });
    return params.toString();
  }, [page, sort, debouncedSearch, entityType, actionType, startDate, endDate, bookId, studentId, copyId, userId]);

  const { data, error, isLoading, mutate } = useSWR<{
    logs: AuditLog[];
    total: number;
  }>(`/api/admin/audit-logs?${queryParams}`, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (error) {
      const msg = error.status === 401 || error.status === 403 
        ? "Access Denied: Please ensure your session is active and you have administrative permissions."
        : (error.info?.error || error.message || "An unexpected error occurred while communicating with the server.");
      toast.error(msg);
    }
  }, [error]);

  return (
    <>
      <AdminTableShell
      className="min-h-[calc(100vh-140px)]"
      controls={
        <div className="flex flex-col gap-3 w-full">
          <div className="app-toolbar-row w-full">
            <div className="app-toolbar-search lg:max-w-md">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                aria-label="Search audit records"
                placeholder="Search records, names, or actions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="app-toolbar-control pl-9 pr-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 sm:p-0.5"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                variant={activeAdvancedFilterCount > 0 ? "secondary" : "outline"}
                onClick={() => setShowAdvancedFilters(true)}
                className={cn(
                  "app-toolbar-control gap-2 px-3.5",
                  activeAdvancedFilterCount > 0 && "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                )}
                title="Open Advanced Filters Modal"
              >
                <SlidersHorizontal aria-hidden="true" />
                <span>Filters</span>
                {activeAdvancedFilterCount > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                    {activeAdvancedFilterCount}
                  </span>
                )}
              </Button>

              <TableSortSelect value={sort} onChange={setSort} options={timestampSortOptions} className="lg:hidden" />

              <OverflowActionsMenu
                label="Audit log actions"
                className="lg:hidden"
                actions={[
                  {
                    id: "export-import-audit",
                    label: canImport ? "Export / Import" : "Export",
                    icon: Download,
                    onSelect: () => setIsExportImportOpen(true),
                  },
                ]}
              />

              <Button
                variant="default"
                size="sm"
                onClick={() => setIsExportImportOpen(true)}
                className="app-toolbar-control hidden px-4 lg:inline-flex"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                <span>{canImport ? "Export / Import" : "Export"}</span>
              </Button>
            </div>
          </div>
          {hasAnyFilterActive && <div className="flex flex-wrap gap-2" aria-label="Active audit filters">
            {bookId && <AuditSubjectChip kind="book" label="Book" value={bookId} onRemove={() => updateFilters({ bookId: "", copyId: "" })} />}
            {studentId && <AuditSubjectChip kind="student" label="Student" value={studentId} onRemove={() => updateFilters({ studentId: "" })} />}
            {copyId && <AuditSubjectChip kind="copy" label="Copy" value={copyId} bookId={bookId} onRemove={() => updateFilters({ copyId: "" })} />}
            {userId && <AuditSubjectChip kind="actor" label="Performed by" value={userId} onRemove={() => updateFilters({ userId: "" })} />}
            {[["query", debouncedSearch, "Search"], ["entityType", entityType === "all" ? "" : entityType, "Entity"], ["actionType", actionType === "all" ? "" : actionType, "Action"], ["startDate", startDate, "From"], ["endDate", endDate, "To"]].filter(([, value]) => value).map(([key, value, label]) => <button type="button" key={key} className="min-h-11 sm:min-h-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted" aria-label={`Remove ${label.toLowerCase()} filter`} onClick={() => { updateFilters({ [key]: "" }); if (key === "query") setSearch(""); }}>{label}: {value.replaceAll("_", " ")} <span aria-hidden="true">×</span></button>)}
          </div>}
          <p role="status" className={error ? "text-xs text-destructive" : "sr-only"}>
            {error ? "Unable to load records. Adjust the filters or reload to retry." : isLoading || !data ? "Loading records…" : `${data.total.toLocaleString()} matching records`}
          </p>
        </div>
      }
      pagination={
        data && data.total > 0 ? (
          <CompactPagination 
            page={page}
            totalItems={data.total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : null
      }
    >
      <div className="p-2 sm:p-4" aria-busy={isLoading || undefined}>
        {!isLoading && data?.logs?.length === 0 && (
          <EmptyState
            noCard
            variant={hasAnyFilterActive ? "no-results" : "first-use"}
            icon={Search}
            title="No Entries Found"
            description="Try adjusting your search or filters."
            action={
              hasAnyFilterActive
                ? { label: "Clear all filters", onClick: handleClearAllFilters }
                : undefined
            }
          />
        )}

        {(!data || (isLoading && data.logs.length === 0)) && !error && (
          <div className="space-y-4 p-2">
             {Array.from({ length: 8 }).map((_, i) => (
               <div key={i} className="h-12 w-full bg-muted/10 animate-pulse rounded-lg border border-border/5" />
             ))}
          </div>
        )}

        {data?.logs && data.logs.length > 0 && (
          <>
            {/* Mobile & Tablet Cards (< 1024px) */}
            <div role="list" aria-label="Audit entries" className="lg:hidden flex flex-col divide-y divide-border/40">
              {data.logs.map((log) => {
                const dateString = log.created_at ? formatManilaTimestamp(log.created_at) : "N/A";
                const isExpanded = expandedRowId === log.id;
                const details = parseLogDetails(log.details);
                const hasDetails =
                  (details &&
                    (details.added?.length ||
                      details.removed?.length ||
                      Object.keys(details).filter(
                        (k) => !["added", "removed"].includes(k) && !IGNORED_KEYS.includes(k)
                      ).length > 0)) ||
                  log.old_value ||
                  log.new_value;

                return (
                  <div
                    key={`mobile-${log.id}`}
                    role="listitem"
                    className={cn(
                      "p-3.5 space-y-2.5 transition-colors",
                      isExpanded && "bg-muted/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {log.profiles?.full_name || log.profiles?.email || "System"}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {dateString}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold text-xs px-2 py-0.5 rounded-lg border-transparent shrink-0 max-w-[165px] overflow-hidden",
                          log.action === "create"
                            ? "status-success"
                            : log.action === "archive"
                              ? "status-warning"
                              : log.action === "delete"
                                ? "status-danger"
                                : "bg-primary/10 text-primary"
                        )}
                      >
                        <span className="truncate">{log.action.replace(/_/g, " ")}</span>
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {log.subject_book_id ? (
                        <button
                          type="button"
                          className="inline-flex min-h-11 lg:min-h-0 items-center text-left font-semibold text-primary hover:underline"
                          onClick={() => setDetailBookId(log.subject_book_id!)}
                        >
                          {log.book_title || "View book"}
                        </button>
                      ) : (
                        log.book_title && <span className="block text-foreground/90 font-medium">{log.book_title}</span>
                      )}
                      {log.subject_student_id ? (
                        <Link
                          className="inline-flex min-h-11 lg:min-h-0 items-center text-primary hover:underline"
                          href={`/users/${log.subject_student_id}`}
                        >
                          {log.student_name || "View student"}
                          {log.student_number ? ` · ${log.student_number}` : ""}
                        </Link>
                      ) : (
                        log.student_name && <span className="block">{log.student_name}</span>
                      )}
                      {log.copy_barcode && (
                        <span className="block font-mono">
                          {log.copy_barcode}
                          {log.copy_accession ? ` · ${log.copy_accession}` : ""}
                        </span>
                      )}
                      <span className="block capitalize">{log.entity_type.replace(/_/g, " ")}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-foreground/80 line-clamp-2 min-w-0 flex-1">
                        {log.reason || <span className="italic text-muted-foreground">No reason</span>}
                      </p>
                      {hasDetails ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-11 lg:h-8 px-3 lg:px-2.5 text-xs font-medium shrink-0 rounded-lg"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Hide" : "View"} details for ${log.action} at ${dateString}`}
                          onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                        >
                          {isExpanded ? "Hide" : "View"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic shrink-0">No diff</span>
                      )}
                    </div>

                    {isExpanded && hasDetails && (
                      <div className="bg-muted/20 p-3 border-l-2 border-l-primary rounded-r-xl text-xs space-y-3 mt-2">
                        {details && (
                          <div className="space-y-3">
                            {Array.isArray(details.added) && details.added.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Added Elements
                                </span>
                                <div className="grid gap-1.5">
                                  {details.added.map((item: AuditLogDetailItem, idx: number) => (
                                    <div key={idx} className="bg-background/80 p-2 rounded-lg border border-border/20 flex flex-col gap-1">
                                      {typeof item === "object" && item !== null ? (
                                        Object.entries(item).map(([k, v]) => (
                                          <div key={k} className="flex gap-2">
                                            <span className="font-semibold text-xs text-muted-foreground shrink-0">{k.replace(/_/g, " ")}:</span>
                                            <span className="font-mono text-xs break-all">{formatValue(v)}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <span className="font-mono text-xs">{formatValue(item)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {Array.isArray(details.removed) && details.removed.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-2xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                  Removed Elements
                                </span>
                                <div className="grid gap-1.5">
                                  {details.removed.map((item: AuditLogDetailItem, idx: number) => (
                                    <div key={idx} className="bg-background/80 p-2 rounded-lg border border-border/20 flex flex-col gap-1 line-through decoration-rose-500/40">
                                      {typeof item === "object" && item !== null ? (
                                        Object.entries(item).map(([k, v]) => (
                                          <div key={k} className="flex gap-2">
                                            <span className="font-semibold text-xs text-muted-foreground shrink-0">{k.replace(/_/g, " ")}:</span>
                                            <span className="font-mono text-xs break-all">{formatValue(v)}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <span className="font-mono text-xs">{formatValue(item)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {Object.entries(details)
                              .filter(([k]) => k !== "added" && k !== "removed" && !IGNORED_KEYS.includes(k))
                              .map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                  <span className="font-semibold text-xs text-muted-foreground shrink-0">{k.replace(/_/g, " ")}:</span>
                                  <span className="font-mono text-xs break-all">{formatValue(v)}</span>
                                </div>
                              ))}
                          </div>
                        )}

                        {(log.old_value || log.new_value) && (
                          <div>
                            <span className="text-2xs font-semibold uppercase tracking-wider text-primary mb-1.5 block">Value Changes</span>
                            <DataDiff oldVal={log.old_value} newVal={log.new_value} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/30 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-4 py-3 whitespace-nowrap" aria-sort={sort === "oldest" ? "ascending" : "descending"}>
                      <SortableTableHeader direction={sort === "oldest" ? "asc" : "desc"} onToggle={() => setSort(sort === "oldest" ? "newest" : "oldest")}>
                        Timestamp (Manila, UTC+8)
                      </SortableTableHeader>
                    </th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Performed by</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Action</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Book / student / copy</th>
                    <th scope="col" className="px-4 py-3 whitespace-nowrap">Reason</th>
                    <th scope="col" className="px-4 py-3 text-center whitespace-nowrap">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/15">
                  {data.logs.map((log) => {
                    const dateString = log.created_at ? formatManilaTimestamp(log.created_at) : "N/A";
                    const isExpanded = expandedRowId === log.id;
                    const details = parseLogDetails(log.details);
                    const hasDetails = (details && (details.added?.length || details.removed?.length || Object.keys(details).filter(k => !['added', 'removed'].includes(k) && !IGNORED_KEYS.includes(k)).length > 0)) || log.old_value || log.new_value;

                    return (
                      <React.Fragment key={log.id}>
                        <tr 
                          className={cn(
                            "group hover:bg-muted/40 transition-colors text-xs",
                            isExpanded && "bg-muted/20"
                          )}
                          onClick={() => hasDetails && setExpandedRowId(isExpanded ? null : log.id)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {dateString}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground truncate max-w-[160px]" title={log.profiles?.full_name || log.profiles?.email || log.admin_id}>
                                {log.profiles?.full_name || log.profiles?.email || "System"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn(
                              "font-semibold text-xs px-2 py-0.5 rounded-lg border-transparent whitespace-nowrap",
                              log.action === "create" ? "status-success" :
                              log.action === "archive" ? "status-warning" :
                              log.action === "delete" ? "status-danger" :
                              "bg-primary/10 text-primary"
                            )}>
                              {log.action.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-muted-foreground">
                            <div className="space-y-1 max-w-64">
                              {log.subject_book_id ? <button type="button" className="block text-left font-semibold text-primary hover:underline" onClick={event => { event.stopPropagation(); setDetailBookId(log.subject_book_id!); }}>{log.book_title || "View book"}</button> : log.book_title && <span className="block">{log.book_title}</span>}
                              {log.subject_student_id ? <Link className="block text-primary hover:underline" href={`/users/${log.subject_student_id}`} onClick={event => event.stopPropagation()}>{log.student_name || "View student"}{log.student_number ? ` · ${log.student_number}` : ""}</Link> : log.student_name && <span className="block">{log.student_name}</span>}
                              {log.copy_barcode && <span className="block text-xs font-mono">{log.copy_barcode}{log.copy_accession ? ` · ${log.copy_accession}` : ""}</span>}
                              <span className="block text-xs">{log.entity_type.replace(/_/g, " ")}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="truncate block max-w-[240px] font-medium" title={log.reason || ""}>
                              {log.reason || <span className="italic text-muted-foreground">No reason</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasDetails ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 px-2.5 text-xs font-medium rounded-lg"
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? "Hide" : "View"} details for ${log.action} at ${dateString}`}
                                onClick={(e) => { e.stopPropagation(); setExpandedRowId(isExpanded ? null : log.id); }}
                              >
                                {isExpanded ? "Hide" : "View"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">None</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && hasDetails && (
                          <tr>
                            <td colSpan={6} className="p-0 border-b border-border/10">
                              <div className="bg-muted/15 p-4 border-l-2 border-l-primary mx-3 my-2 rounded-r-xl text-xs space-y-4">
                                {/* Detailed Lists (Added/Removed) */}
                                {details && (
                                  <div className="space-y-4">
                                    {Array.isArray(details.added) && details.added.length > 0 && (
                                      <div className="space-y-2">
                                        <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          Added Elements
                                        </span>
                                        <div className="grid gap-2">
                                          {details.added.map((item: AuditLogDetailItem, idx: number) => (
                                            <div key={idx} className="bg-background/80 p-2.5 rounded-lg border border-border/15 flex flex-col gap-1">
                                              {typeof item === 'object' && item !== null ? (
                                                Object.entries(item).map(([k, v]) => (
                                                  <div key={k} className="flex gap-2">
                                                    <span className="font-semibold text-xs text-muted-foreground w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                                    <span className="font-mono text-xs truncate">{formatValue(v)}</span>
                                                  </div>
                                                ))
                                              ) : (
                                                <span className="font-mono text-xs">{formatValue(item)}</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {Array.isArray(details.removed) && details.removed.length > 0 && (
                                      <div className="space-y-2">
                                        <span className="text-2xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-2">
                                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                          Removed Elements
                                        </span>
                                        <div className="grid gap-2">
                                          {details.removed.map((item: AuditLogDetailItem, idx: number) => (
                                            <div key={idx} className="bg-background/80 p-2.5 rounded-lg border border-border/15 flex flex-col gap-1 line-through decoration-rose-500/30">
                                              {typeof item === 'object' && item !== null ? (
                                                Object.entries(item).map(([k, v]) => (
                                                  <div key={k} className="flex gap-2">
                                                    <span className="font-semibold text-xs text-muted-foreground w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                                    <span className="font-mono text-xs truncate">{formatValue(v)}</span>
                                                  </div>
                                                ))
                                              ) : (
                                                <span className="font-mono text-xs">{formatValue(item)}</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Render any other metadata in details */}
                                    {Object.entries(details)
                                      .filter(([k]) => k !== 'added' && k !== 'removed' && !IGNORED_KEYS.includes(k))
                                      .map(([k, v]) => (
                                        <div key={k} className="flex gap-2 px-1">
                                          <span className="font-semibold text-xs text-muted-foreground w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                          <span className="font-mono text-xs">{formatValue(v)}</span>
                                        </div>
                                      ))
                                    }
                                  </div>
                                )}

                                {/* Display Data Diff instead of Raw JSON */}
                                {(log.old_value || log.new_value) && (
                                  <div>
                                    <span className="text-2xs font-semibold uppercase tracking-wider text-primary mb-2 block">Value Changes</span>
                                    <DataDiff oldVal={log.old_value} newVal={log.new_value} />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminTableShell>
    <Dialog open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
      <DialogContent className="flex max-h-[min(85dvh,760px)] flex-col gap-0 overflow-hidden rounded-2xl border-border/40 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border/30 px-5 py-5 pr-12 sm:px-6">
          <DialogTitle className="text-lg font-semibold">Advanced Audit Filters</DialogTitle>
          <DialogDescription className="text-sm">Combine filters to find a precise history. Results update automatically.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <section className="space-y-3" aria-labelledby="audit-subject-heading">
            <h3 id="audit-subject-heading" className="text-sm font-semibold">Book and student</h3>
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <AuditSubjectFilter kind="book" label="Book" value={bookId} onChange={option => updateFilters({ bookId: option?.id || "", copyId: "" })} />
              <AuditSubjectFilter kind="student" label="Student" value={studentId} onChange={option => updateFilters({ studentId: option?.id || "" })} />
            </div>
            {bookId && <AuditSubjectFilter kind="copy" label="Copy" value={copyId} bookId={bookId} onChange={option => updateFilters({ copyId: option?.id || "" })} />}
            <p className="text-xs text-muted-foreground">Student means the person involved in the record, including transactions processed by staff. Book history includes all copies unless you select one.</p>
          </section>

          <section className="space-y-3" aria-labelledby="audit-activity-heading">
            <h3 id="audit-activity-heading" className="text-sm font-semibold">Activity</h3>
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label id="audit-action-type-label" className="text-xs text-muted-foreground">Action</label>
              <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(1); }}>
                <SelectTrigger aria-labelledby="audit-action-type-label" className="w-full h-11 border border-border/30 bg-muted/10 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/5">
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <SelectValue placeholder="All Actions" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40 max-h-[300px]">
                  {ACTION_OPTIONS.map((action) => (
                    <SelectItem 
                      key={action.value} 
                      value={action.value} 
                      title={action.tooltip}
                      className="py-2.5 px-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-xs text-foreground">{action.label}</span>
                        <span className="text-[11px] text-muted-foreground truncate">{action.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              <div className="space-y-1.5">
                <label id="audit-entity-type-label" className="text-xs text-muted-foreground">Entity type</label>
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                <SelectTrigger aria-labelledby="audit-entity-type-label" className="w-full h-11 border border-border/30 bg-muted/10 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/5">
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <SelectValue placeholder="All Entities" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40 max-h-[300px]">
                  {ENTITY_GROUPS.map((group) => (
                    <SelectGroup key={group.name}>
                      <SelectLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5">
                        {group.name}
                      </SelectLabel>
                      {group.items.map((item) => (
                        <SelectItem 
                          key={item.value} 
                          value={item.value} 
                          title={item.tooltip}
                          className="py-2 px-3 cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex flex-col text-left">
                            <span className="font-semibold text-xs text-foreground">{item.label}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{item.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>
            <AuditSubjectFilter kind="actor" label="Performed by" value={userId} onChange={option => updateFilters({ userId: option?.id || "" })} />
            <p className="text-xs text-muted-foreground">Optionally limit records to the staff member who processed them.</p>
          </section>

          <section className="space-y-3" aria-labelledby="audit-date-heading">
            <h3 id="audit-date-heading" className="text-sm font-semibold">Date range <span className="font-normal text-muted-foreground">· Manila time</span></h3>
            <div className="flex flex-wrap gap-2" aria-label="Quick date ranges">
              {([['Today', 0], ['Last 7 days', 6], ['This month', -1]] as const).map(([label, days]) => <Button key={label} type="button" variant="outline" size="sm" onClick={() => {
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
                const start = new Date(`${today}T12:00:00+08:00`);
                if (days === -1) start.setUTCDate(1); else start.setUTCDate(start.getUTCDate() - days);
                updateFilters({ startDate: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), endDate: today });
              }}>{label}</Button>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="audit-start-date" className="text-xs text-muted-foreground">From</label>
                <Input id="audit-start-date" type="date" value={startDate} max={endDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })} onChange={event => handleStartDateChange(event.target.value)} className="min-w-0" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="audit-end-date" className="text-xs text-muted-foreground">To</label>
                <Input id="audit-end-date" type="date" value={endDate} min={startDate || undefined} max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })} onChange={event => handleEndDateChange(event.target.value)} className="min-w-0" />
              </div>
            </div>
          </section>
          {(bookId || studentId) && <p className="text-xs text-muted-foreground">Older entries without identifiable book or student references may be missing from this filtered history.</p>}
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-between border-t border-border/30 bg-muted/10 px-5 py-4 sm:justify-between sm:px-6">
          <Button type="button" variant="ghost" size="sm" onClick={handleClearAllFilters} disabled={!hasAnyFilterActive}>Clear all</Button>
          <div className="flex items-center gap-3">
            <span role="status" className="text-xs text-muted-foreground">{error ? "Could not load results" : data ? `${data.total.toLocaleString()} matching records` : "Updating…"}</span>
            <Button type="button" size="sm" onClick={() => setShowAdvancedFilters(false)}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {detailBookId && <BookDetailModal bookId={detailBookId} open onOpenChange={open => { if (!open) setDetailBookId(null); }} variant="read_only" />}
      {isExportImportOpen && (
        <AuditLogExportImportModal
          isOpen={isExportImportOpen}
          onClose={() => setIsExportImportOpen(false)}
          onImportSuccess={() => mutate()}
          canImport={canImport}
          currentFilters={{
            query: debouncedSearch,
            entityType,
            actionType,
            startDate,
            endDate,
            bookId,
            studentId,
            copyId,
            userId,
          }}
        />
      )}
  </>
  );
}
