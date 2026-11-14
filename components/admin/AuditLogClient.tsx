"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "./AdminTableShell";
import { AuditLogExportImportModal } from "./AuditLogExportImportModal";

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

export function AuditLogClient() {
  const urlFilters = useSearchParams();
  const updateFilters = useCallback((changes: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "all") params.set(key, value); else params.delete(key);
    }
    if (!("page" in changes)) params.delete("page");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, []);
  const page = Math.max(1, Math.floor(Number(urlFilters.get("page"))) || 1);
  const setPage = (value: number) => updateFilters({ page: value === 1 ? "" : String(value) });
  const [search, setSearch] = useState(urlFilters.get("query") || "");
  const debouncedSearch = urlFilters.get("query") || "";
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
    return () => clearTimeout(timer);
  }, [search, setDebouncedSearch]);

  useEffect(() => { setSearch(debouncedSearch); }, [debouncedSearch]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: ((page - 1) * pageSize).toString(),
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
  }, [page, debouncedSearch, entityType, actionType, startDate, endDate, bookId, studentId, copyId, userId]);

  const { data, error, mutate } = useSWR<{
    logs: AuditLog[];
    total: number;
  }>(`/api/admin/audit-logs?${queryParams}`, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: false,
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
        <div className="flex flex-col gap-3 w-full p-1">
          {/* Top Control Bar */}
          <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 items-stretch lg:items-center justify-between w-full">
            <div className="relative flex-1 w-full lg:max-w-xs xl:max-w-sm 2xl:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input 
                aria-label="Search audit records"
                placeholder="Search records, names, or actions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-10 border border-border/20 bg-muted/5 rounded-2xl text-xs font-medium w-full transition-all focus-visible:ring-4 focus-visible:ring-primary/5"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Advanced Filters Trigger Button (Opens Modal) */}
              <Button
                variant={activeAdvancedFilterCount > 0 ? "secondary" : "outline"}
                onClick={() => setShowAdvancedFilters(true)}
                className={cn(
                  "h-10 rounded-2xl border border-border/20 px-3.5 text-xs font-medium flex items-center gap-2 transition-all",
                  activeAdvancedFilterCount > 0 
                    ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15" 
                    : "bg-muted/5 hover:bg-muted/10 text-muted-foreground hover:text-foreground"
                )}
                title="Open Advanced Filters Modal"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters</span>
                {activeAdvancedFilterCount > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                    {activeAdvancedFilterCount}
                  </span>
                )}
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => setIsExportImportOpen(true)}
                className="h-10 rounded-2xl text-[11px] font-bold uppercase tracking-wider px-3.5 transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                <span>Export / Import</span>
              </Button>
            </div>
          </div>
          {hasAnyFilterActive && <div className="flex flex-wrap gap-2" aria-label="Active audit filters">
            {bookId && <AuditSubjectChip kind="book" label="Book" value={bookId} onRemove={() => updateFilters({ bookId: "", copyId: "" })} />}
            {studentId && <AuditSubjectChip kind="student" label="Student" value={studentId} onRemove={() => updateFilters({ studentId: "" })} />}
            {copyId && <AuditSubjectChip kind="copy" label="Copy" value={copyId} bookId={bookId} onRemove={() => updateFilters({ copyId: "" })} />}
            {userId && <AuditSubjectChip kind="actor" label="Performed by" value={userId} onRemove={() => updateFilters({ userId: "" })} />}
            {[["query", debouncedSearch, "Search"], ["entityType", entityType === "all" ? "" : entityType, "Entity"], ["actionType", actionType === "all" ? "" : actionType, "Action"], ["startDate", startDate, "From"], ["endDate", endDate, "To"]].filter(([, value]) => value).map(([key, value, label]) => <button type="button" key={key} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted" aria-label={`Remove ${label.toLowerCase()} filter`} onClick={() => { updateFilters({ [key]: "" }); if (key === "query") setSearch(""); }}>{label}: {value.replaceAll("_", " ")} <span aria-hidden="true">×</span></button>)}
          </div>}
          <p role="status" className="text-xs text-muted-foreground">{error ? "Unable to load records. Adjust the filters or reload to retry." : data ? `${data.total.toLocaleString()} matching records` : "Loading records…"}</p>
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
      <div className="p-2 sm:p-4">


        {data?.logs?.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center gap-3 bg-muted/5 rounded-[2.5rem] border border-border/10 border-dashed">
            <div className="h-16 w-16 rounded-full bg-muted/10 flex items-center justify-center border border-border/10">
              <Search className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="text-center">
              <span className="text-sm font-black uppercase tracking-widest text-foreground block">No Entries Found</span>
              <span className="text-xs text-muted-foreground font-medium">Try adjusting your search or filters.</span>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className="space-y-4 pl-4">
             {Array.from({ length: 8 }).map((_, i) => (
               <div key={i} className="h-12 w-full bg-muted/10 animate-pulse rounded-lg border border-border/5" />
             ))}
          </div>
        )}

        {data?.logs && data.logs.length > 0 && (
          <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-border/20 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="p-3 font-bold w-48">Timestamp (Manila, UTC+8)</th>
                  <th className="p-3 font-bold w-48">Performed by</th>
                  <th className="p-3 font-bold">Action</th>
                  <th className="p-3 font-bold min-w-60">Book / student / copy</th>
                  <th className="p-3 font-bold">Reason</th>
                  <th className="p-3 font-bold text-center">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {data.logs.map((log) => {
                  const dateString = log.created_at ? formatManilaTimestamp(log.created_at) : "N/A";
                  const isExpanded = expandedRowId === log.id;
                  const details = parseLogDetails(log.details);
                  const hasDetails = (details && (details.added?.length || details.removed?.length || Object.keys(details).filter(k => !['added', 'removed'].includes(k) && !IGNORED_KEYS.includes(k)).length > 0)) || log.old_value || log.new_value;

                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={cn(
                          "group hover:bg-muted/5 transition-colors text-xs",
                          isExpanded && "bg-muted/5"
                        )}
                        onClick={() => hasDetails && setExpandedRowId(isExpanded ? null : log.id)}
                      >
                        <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {dateString}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-foreground truncate max-w-[150px]" title={log.profiles?.full_name || log.profiles?.email || log.admin_id}>
                              {log.profiles?.full_name || log.profiles?.email || "System"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={cn(
                            "font-bold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded shadow-xs border-transparent",
                            log.action === "create" ? "bg-green-500/10 text-green-600" :
                            log.action === "archive" ? "bg-amber-500/10 text-amber-600" :
                            log.action === "delete" ? "bg-red-500/10 text-red-600" :
                            "bg-primary/10 text-primary"
                          )}>
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium text-muted-foreground">
                          <div className="space-y-1 max-w-64">
                            {log.subject_book_id ? <button type="button" className="block text-left font-semibold text-primary hover:underline" onClick={event => { event.stopPropagation(); setDetailBookId(log.subject_book_id!); }}>{log.book_title || "View book"}</button> : log.book_title && <span className="block">{log.book_title}</span>}
                            {log.subject_student_id ? <Link className="block text-primary hover:underline" href={`/users/${log.subject_student_id}`} onClick={event => event.stopPropagation()}>{log.student_name || "View student"}{log.student_number ? ` · ${log.student_number}` : ""}</Link> : log.student_name && <span className="block">{log.student_name}</span>}
                            {log.copy_barcode && <span className="block text-xs">{log.copy_barcode}{log.copy_accession ? ` · ${log.copy_accession}` : ""}</span>}
                            <span className="block text-xs">{log.entity_type.replace(/_/g, " ")}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="truncate block max-w-[250px] font-medium" title={log.reason || ""}>
                            {log.reason || <span className="italic">No reason</span>}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {hasDetails ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 text-[11px] font-bold uppercase tracking-wider hover:bg-background border border-border/10"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? "Hide" : "View"} details for ${log.action} at ${dateString}`}
                              onClick={(e) => { e.stopPropagation(); setExpandedRowId(isExpanded ? null : log.id); }}
                            >
                              {isExpanded ? "Hide" : "View"}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">None</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={6} className="p-0 border-b border-border/10">
                            <div className="bg-muted/10 p-4 border-l-2 border-l-primary mx-3 my-2 rounded-r-xl shadow-inner text-xs space-y-4">
                              {/* Detailed Lists (Added/Removed) */}
                              {details && (
                                <div className="space-y-4">
                                  {Array.isArray(details.added) && details.added.length > 0 && (
                                    <div className="space-y-2">
                                      <span className="text-[11px] font-black uppercase tracking-[0.1em] text-green-600/80 flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                        Added Elements
                                      </span>
                                      <div className="grid gap-2">
                                        {details.added.map((item: AuditLogDetailItem, idx: number) => (
                                          <div key={idx} className="bg-background/60 p-2.5 rounded-lg border border-border/5 flex flex-col gap-1">
                                            {typeof item === 'object' && item !== null ? (
                                              Object.entries(item).map(([k, v]) => (
                                                <div key={k} className="flex gap-2">
                                                  <span className="font-bold text-[11px] uppercase text-muted-foreground w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                                  <span className="font-mono text-[11px] truncate">{formatValue(v)}</span>
                                                </div>
                                              ))
                                            ) : (
                                              <span className="font-mono text-[11px]">{formatValue(item)}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {Array.isArray(details.removed) && details.removed.length > 0 && (
                                    <div className="space-y-2">
                                      <span className="text-[11px] font-black uppercase tracking-[0.1em] text-red-600/80 flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                        Removed Elements
                                      </span>
                                      <div className="grid gap-2">
                                        {details.removed.map((item: AuditLogDetailItem, idx: number) => (
                                          <div key={idx} className="bg-background/60 p-2.5 rounded-lg border border-border/5 flex flex-col gap-1 line-through decoration-red-500/30">
                                            {typeof item === 'object' && item !== null ? (
                                              Object.entries(item).map(([k, v]) => (
                                                <div key={k} className="flex gap-2">
                                                  <span className="font-bold text-[11px] uppercase text-muted-foreground w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                                  <span className="font-mono text-[11px] truncate">{formatValue(v)}</span>
                                                </div>
                                              ))
                                            ) : (
                                              <span className="font-mono text-[11px]">{formatValue(item)}</span>
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
                                        <span className="font-bold text-[11px] uppercase text-muted-foreground w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                        <span className="font-mono text-[11px]">{formatValue(v)}</span>
                                      </div>
                                    ))
                                  }
                                </div>
                              )}

                              {/* Display Data Diff instead of Raw JSON */}
                              {(log.old_value || log.new_value) && (
                                <div>
                                  <span className="text-[11px] font-black uppercase tracking-[0.1em] text-primary/80 mb-2 block">Value Changes</span>
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
      <AuditLogExportImportModal
      isOpen={isExportImportOpen}
      onClose={() => setIsExportImportOpen(false)}
      onImportSuccess={() => mutate()}
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
  </>
  );
}
