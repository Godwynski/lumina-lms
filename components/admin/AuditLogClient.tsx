"use client";

import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  Download, 
  Filter, 
  RefreshCw,
  ChevronRight,
  SlidersHorizontal
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

const ENTITY_TYPES = [
  "all",
  "book",
  "book_copy",
  "profile",
  "borrowing_record",
  "category",
  "policy",
  "fine",
  "settings",
  "system",
] as const;

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
            <div className="flex items-center gap-2 w-full xl:max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                <Input 
                  placeholder="Search name, action, or reason..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 border border-border/20 bg-muted/5 rounded-2xl text-xs font-medium w-full transition-all focus-visible:ring-4 focus-visible:ring-primary/5"
                />
              </div>
              <Button
                variant={showAdvancedFilters ? "secondary" : "outline"}
                size="icon"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "h-10 w-10 shrink-0 rounded-2xl border border-border/20 transition-all xl:hidden",
                  showAdvancedFilters ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/5 hover:bg-muted/10"
                )}
                title="Toggle Advanced Filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-row items-center gap-2 w-full xl:w-auto">
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                <SelectTrigger className="flex-1 xl:w-[140px] h-10 border border-border/20 bg-muted/5 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/5 transition-all">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 text-muted-foreground/40" />
                    <SelectValue placeholder="Entity" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40">
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize text-xs py-2">
                      {t === "all" ? "All Entities" : t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(1); }}>
                <SelectTrigger className="flex-1 xl:w-[140px] h-10 border border-border/20 bg-muted/5 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-primary/5 transition-all">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 text-muted-foreground/40" />
                    <SelectValue placeholder="Action" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40">
                  <SelectItem value="all" className="text-xs py-2">All Actions</SelectItem>
                  <SelectItem value="create" className="text-xs py-2">Create</SelectItem>
                  <SelectItem value="update" className="text-xs py-2">Update</SelectItem>
                  <SelectItem value="archive" className="text-xs py-2">Archive</SelectItem>
                  <SelectItem value="login" className="text-xs py-2">Login</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showAdvancedFilters ? "secondary" : "outline"}
                size="icon"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "hidden xl:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/20 transition-all",
                  showAdvancedFilters ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/5 hover:bg-muted/10"
                )}
                title="Toggle Advanced Filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>

              <div className="hidden xl:flex items-center gap-2 border-l border-border/10 pl-2 ml-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mutate()}
                  disabled={isValidating}
                  className="h-10 rounded-2xl bg-background text-[10px] font-bold uppercase tracking-wider px-4 border border-border/20 hover:bg-muted transition-all"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 xl:mr-2", isValidating && "animate-spin")} />
                  <span className="hidden xl:inline">Refresh</span>
                </Button>
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
                  variant="outline"
                  size="sm"
                  onClick={() => mutate()}
                  disabled={isValidating}
                  className="h-10 flex-1 rounded-2xl bg-background text-[10px] font-bold uppercase tracking-wider px-4 border border-border/20 hover:bg-muted"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isValidating && "animate-spin")} />
                  Refresh
                </Button>
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

          {/* Collapsible Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 p-4 mt-2 bg-muted/5 rounded-3xl border border-border/5 animate-in slide-in-from-top-2 fade-in-50 duration-200">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground ml-1 uppercase tracking-wider">Start Date</span>
                <Input 
                  type="date" 
                  value={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="h-9 border-none shadow-none bg-muted/10 rounded-xl text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground ml-1 uppercase tracking-wider">End Date</span>
                <Input 
                  type="date" 
                  value={endDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="h-9 border-none shadow-none bg-muted/10 rounded-xl text-xs"
                />
              </div>
              <div className="flex items-end justify-start xl:justify-end">
                <div className="h-9 flex items-center px-4 text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider bg-background rounded-xl border border-border/10">
                  {data ? `${data.total.toLocaleString()} Records Found` : "..."}
                </div>
              </div>
            </div>
          )}
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
                  const hasDetails = (log.details && (log.details.added?.length || log.details.removed?.length || Object.keys(log.details).filter(k => !['added', 'removed'].includes(k) && !IGNORED_KEYS.includes(k)).length > 0)) || log.old_value || log.new_value;

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
                              {log.details && (
                                <div className="space-y-4">
                                  {Array.isArray(log.details.added) && log.details.added.length > 0 && (
                                    <div className="space-y-2">
                                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-green-600/80 flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                        Added Elements
                                      </span>
                                      <div className="grid gap-2">
                                        {log.details.added.map((item: AuditLogDetailItem, idx: number) => (
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

                                  {Array.isArray(log.details.removed) && log.details.removed.length > 0 && (
                                    <div className="space-y-2">
                                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-red-600/80 flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                        Removed Elements
                                      </span>
                                      <div className="grid gap-2 opacity-80">
                                        {log.details.removed.map((item: AuditLogDetailItem, idx: number) => (
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
                                  {Object.entries(log.details)
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
