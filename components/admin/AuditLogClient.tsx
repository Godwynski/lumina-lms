"use client";

import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
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
  RotateCcw,
  ChevronRight,
  SlidersHorizontal,
  Calendar,
  X
} from "lucide-react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "./AdminTableShell";
import { AuditLogExportImportModal } from "./AuditLogExportImportModal";

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
            <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">{k.replace(/_/g, ' ')}</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-4 bg-muted/20 rounded-2xl border border-border/5 opacity-60">
        {fields.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 min-w-0 line-through decoration-muted-foreground/30">
            <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">{k.replace(/_/g, ' ')}</span>
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
          <span className="font-bold text-muted-foreground/70 w-32 shrink-0 truncate">
            {k}
          </span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="line-through opacity-60 text-muted-foreground truncate max-w-[200px]">
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [actionType, setActionType] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleStartDateChange = (val: string) => {
    if (endDate && val > endDate) {
      toast.error("Start date cannot be after end date");
      return;
    }
    setStartDate(val);
    setPage(1);
  };

  const handleEndDateChange = (val: string) => {
    if (startDate && val < startDate) {
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
    setDebouncedSearch("");
    setEntityType("all");
    setActionType("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
    toast.success("All filters cleared");
    void mutate();
  };

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (actionType !== "all") count++;
    if (startDate) count++;
    if (endDate) count++;
    return count;
  }, [actionType, startDate, endDate]);

  const hasAnyFilterActive = useMemo(() => {
    return !!(search || entityType !== "all" || actionType !== "all" || startDate || endDate);
  }, [search, entityType, actionType, startDate, endDate]);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);

  const pageSize = 20; // Increased page size for dense table

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: ((page - 1) * pageSize).toString(),
      ...(debouncedSearch && { query: debouncedSearch }),
      ...(entityType !== "all" && { entityType }),
      ...(actionType !== "all" && { actionType }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    });
    return params.toString();
  }, [page, debouncedSearch, entityType, actionType, startDate, endDate]);

  const { data, error, mutate, isValidating } = useSWR<{
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
        <div className="flex flex-col gap-3 w-full p-1">
          {/* Top Control Bar */}
          <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center w-full">
            <div className="relative flex-1 w-full xl:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input 
                placeholder="Search name, action, or reason..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-10 border border-border/20 bg-muted/5 rounded-2xl text-xs font-medium w-full transition-all focus-visible:ring-4 focus-visible:ring-primary/5"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                <SelectTrigger className="flex-1 sm:flex-initial xl:w-[170px] h-10 border border-border/20 bg-muted/5 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/5 transition-all">
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <SelectValue placeholder="All Entities" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40 max-h-[360px]">
                  {ENTITY_GROUPS.map((group) => (
                    <SelectGroup key={group.name}>
                      <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-3 py-1.5">
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
                            <span className="text-[10px] text-muted-foreground truncate">{item.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

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
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeAdvancedFilterCount}
                  </span>
                )}
              </Button>

              {/* Clear Filters (replaces old Refresh button) */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllFilters}
                className={cn(
                  "h-10 rounded-2xl bg-background text-[10px] font-bold uppercase tracking-wider px-3.5 border border-border/20 hover:bg-muted transition-all flex items-center gap-1.5",
                  !hasAnyFilterActive && "text-muted-foreground"
                )}
                title="Clear all filters, dates, actions, and search keywords"
              >
                <RotateCcw className={cn("h-3.5 w-3.5", isValidating && "animate-spin")} />
                <span>Clear Filters</span>
              </Button>

              <div className="hidden xl:flex items-center gap-2 border-l border-border/10 pl-2 ml-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsExportImportOpen(true)}
                  className="h-10 rounded-2xl text-[10px] font-bold uppercase tracking-wider px-4 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Download className="h-3.5 w-3.5 xl:mr-2" />
                  <span className="hidden xl:inline">Export / Import</span>
                </Button>
              </div>
            </div>

            {/* Mobile Actions (Visible below xl) */}
            <div className="flex xl:hidden items-center gap-2 w-full pt-1">
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsExportImportOpen(true)}
                className="h-10 flex-1 rounded-2xl text-[10px] font-bold uppercase tracking-wider px-4 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Download className="h-3.5 w-3.5 mr-2" />
                Export / Import
              </Button>
            </div>
          </div>
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
      <div className="py-6 px-2">


        {data?.logs?.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center gap-3 opacity-60 bg-muted/5 rounded-[2.5rem] border border-border/10 border-dashed">
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
          <div className="w-full overflow-x-auto pb-8">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-border/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  <th className="p-3 font-bold w-48">Timestamp (UTC)</th>
                  <th className="p-3 font-bold w-48">Admin</th>
                  <th className="p-3 font-bold">Action</th>
                  <th className="p-3 font-bold">Entity</th>
                  <th className="p-3 font-bold w-1/3">Reason</th>
                  <th className="p-3 font-bold text-center">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {data.logs.map((log) => {
                  const dateString = log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "N/A";
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
                            "font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded shadow-xs border-transparent",
                            log.action === "create" ? "bg-green-500/10 text-green-600" :
                            log.action === "archive" ? "bg-amber-500/10 text-amber-600" :
                            log.action === "delete" ? "bg-red-500/10 text-red-600" :
                            "bg-primary/10 text-primary"
                          )}>
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium text-muted-foreground">
                          {log.entity_type.replace(/_/g, " ")}
                        </td>
                        <td className="p-3">
                          <span className="truncate block max-w-[250px] font-medium" title={log.reason || ""}>
                            {log.reason || <span className="italic opacity-50">No reason</span>}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {hasDetails ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider hover:bg-background border border-border/10"
                              onClick={(e) => { e.stopPropagation(); setExpandedRowId(isExpanded ? null : log.id); }}
                            >
                              {isExpanded ? "Hide" : "View"}
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40 italic">None</span>
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
                                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-green-600/80 flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                        Added Elements
                                      </span>
                                      <div className="grid gap-2">
                                        {details.added.map((item: AuditLogDetailItem, idx: number) => (
                                          <div key={idx} className="bg-background/60 p-2.5 rounded-lg border border-border/5 flex flex-col gap-1">
                                            {typeof item === 'object' && item !== null ? (
                                              Object.entries(item).map(([k, v]) => (
                                                <div key={k} className="flex gap-2">
                                                  <span className="font-bold text-[10px] uppercase text-muted-foreground/50 w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
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
                                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-red-600/80 flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                        Removed Elements
                                      </span>
                                      <div className="grid gap-2 opacity-80">
                                        {details.removed.map((item: AuditLogDetailItem, idx: number) => (
                                          <div key={idx} className="bg-background/60 p-2.5 rounded-lg border border-border/5 flex flex-col gap-1 line-through decoration-red-500/30">
                                            {typeof item === 'object' && item !== null ? (
                                              Object.entries(item).map(([k, v]) => (
                                                <div key={k} className="flex gap-2">
                                                  <span className="font-bold text-[10px] uppercase text-muted-foreground/50 w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
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
                                        <span className="font-bold text-[10px] uppercase text-muted-foreground/50 w-24 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                        <span className="font-mono text-[11px]">{formatValue(v)}</span>
                                      </div>
                                    ))
                                  }
                                </div>
                              )}

                              {/* Display Data Diff instead of Raw JSON */}
                              {(log.old_value || log.new_value) && (
                                <div>
                                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-primary/80 mb-2 block">Value Changes</span>
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
        )}
      </div>
    </AdminTableShell>
    <Dialog open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-7 border border-border/40 shadow-2xl">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-border/10">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">Advanced Audit Filters</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Narrow down system activity logs by action category, entity type, and date timeframe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Action Type Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Action Type
              </label>
              <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(1); }}>
                <SelectTrigger className="w-full h-11 border border-border/30 bg-muted/10 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/5">
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
                        <span className="text-[10px] text-muted-foreground truncate">{action.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-muted-foreground/60" />
                  Start Date
                </label>
                <Input 
                  type="date" 
                  value={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="h-11 border border-border/30 bg-muted/10 rounded-2xl text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-muted-foreground/60" />
                  End Date
                </label>
                <Input 
                  type="date" 
                  value={endDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="h-11 border border-border/30 bg-muted/10 rounded-2xl text-xs font-medium"
                />
              </div>
            </div>

            {/* Entity Quick Select inside Modal as well */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Entity Type
              </label>
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                <SelectTrigger className="w-full h-11 border border-border/30 bg-muted/10 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/5">
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <SelectValue placeholder="All Entities" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40 max-h-[300px]">
                  {ENTITY_GROUPS.map((group) => (
                    <SelectGroup key={group.name}>
                      <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-3 py-1.5">
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
                            <span className="text-[10px] text-muted-foreground truncate">{item.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Results summary indicator */}
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/20 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Matching records found:</span>
              <span className="font-bold text-foreground">
                {data ? `${data.total.toLocaleString()} records` : "Loading..."}
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setActionType("all");
                setStartDate("");
                setEndDate("");
                setEntityType("all");
                setPage(1);
              }}
              className="w-full sm:w-auto h-10 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setShowAdvancedFilters(false)}
              className="w-full sm:w-auto h-10 rounded-xl text-xs font-semibold px-5"
            >
              Apply & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
      }}
    />
  </>
  );
}
