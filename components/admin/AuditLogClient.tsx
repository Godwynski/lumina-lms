"use client";

import { useState, useEffect, useMemo } from "react";
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
  User as UserIcon, 
  Database,
  RefreshCw,
  Calendar,
  ChevronRight
} from "lucide-react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "./AdminTableShell";

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
    <div className="space-y-3 p-4 bg-muted/5 rounded-2xl border border-border/5">
      {changes.map(k => (
        <div key={k} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2 border-b border-border/5 last:border-0 group/diff">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 w-32 shrink-0 group-hover/diff:text-muted-foreground/60 transition-colors">
            {k.replace(/_/g, ' ')}
          </span>
          <div className="flex items-center gap-2 text-xs overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            <span className="line-through text-muted-foreground/50 bg-muted/30 px-2 py-1 rounded-lg font-medium whitespace-nowrap">
              {formatValue(oldVal[k])}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/20 shrink-0" />
            <span className="text-primary font-bold bg-primary/10 px-2 py-1 rounded-lg shadow-xs whitespace-nowrap border border-primary/5 ring-1 ring-primary/5">
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
  const pageSize = 10;

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
    });
    return params.toString();
  }, [page, debouncedSearch, entityType]);

  const { data, error, mutate, isValidating } = useSWR<{
    logs: AuditLog[];
    total: number;
  }>(`/api/admin/audit-logs?${queryParams}`, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const handleExport = async () => {
    try {
      const exportParams = new URLSearchParams({
        ...(debouncedSearch && { query: debouncedSearch }),
        ...(entityType !== "all" && { entityType }),
      });
      window.open(`/api/admin/audit-logs/export?${exportParams.toString()}`, '_blank');
      toast.success("Audit log export started");
    } catch {
      toast.error("Failed to export audit logs");
    }
  };

  return (
    <AdminTableShell
      className="min-h-[calc(100vh-140px)]"
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            className="h-9 rounded-xl bg-background shadow-xs text-[10px] font-bold uppercase tracking-wider px-4 border-border/40 hover:bg-muted"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isValidating && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            className="h-9 rounded-xl shadow-lg shadow-primary/10 text-[10px] font-bold uppercase tracking-wider px-4 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Export CSV
          </Button>
        </div>
      }
      controls={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full p-1">
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
            <Input 
              placeholder="Search actions, entities, or reasons..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 bg-muted/10 rounded-2xl text-xs font-bold transition-all"
            />
          </div>
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
            <SelectTrigger className="h-12 border-none shadow-none bg-muted/10 rounded-2xl text-xs font-bold transition-all focus:ring-2 focus:ring-primary/20">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground/40" />
                <SelectValue placeholder="Entity Type" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/40 shadow-2xl backdrop-blur-xl bg-background/95">
              {ENTITY_TYPES.map(t => (
                <SelectItem key={t} value={t} className="capitalize text-xs font-bold py-3 px-4">
                  {t === "all" ? "All Entities" : t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end px-5 text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.15em] bg-muted/5 rounded-2xl border border-border/5">
            {data ? `${data.total.toLocaleString()} Records` : "Indexing..."}
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
        {error && (
          <div className="p-12 text-center bg-destructive/5 rounded-[2.5rem] border border-destructive/10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
              <Database className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-destructive mb-1">Access Denied</h3>
            <p className="text-xs text-muted-foreground font-medium">Failed to retrieve audit logs. Please ensure you have administrative permissions.</p>
          </div>
        )}

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
          <div className="space-y-10 relative border-l-2 border-muted/20 pl-8 ml-6">
             {Array.from({ length: 4 }).map((_, i) => (
               <div key={i} className="relative">
                 <div className="absolute -left-[37px] top-6 h-4 w-4 rounded-full bg-muted/20 animate-pulse ring-8 ring-background" />
                 <div className="h-40 w-full bg-muted/5 animate-pulse rounded-[2.5rem] border border-border/5" />
               </div>
             ))}
          </div>
        )}

        {data?.logs && data.logs.length > 0 && (
          <div className="relative border-l-2 border-border/10 pl-8 ml-6 md:ml-10 space-y-10 pb-10">
            {data.logs.map((log) => {
              const date = log.created_at ? new Date(log.created_at) : new Date();

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[37px] top-6 h-4 w-4 rounded-full border-2 border-primary/20 bg-background ring-8 ring-background z-10 group-hover:scale-125 group-hover:bg-primary group-hover:border-primary transition-all duration-500 shadow-sm" />
                  
                  {/* Card */}
                  <div className="rounded-[2.5rem] border border-border/20 bg-card/10 p-5 md:p-8 shadow-sm hover:shadow-2xl hover:shadow-primary/[0.03] transition-all duration-500 hover:border-primary/10 backdrop-blur-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/5 pb-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary/[0.03] flex items-center justify-center border border-primary/5 text-primary/60 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-inner">
                          <UserIcon className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-base font-black text-card-foreground tracking-tight truncate leading-none">
                            {log.profiles?.full_name || log.profiles?.email || "System Actor"}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1.5 opacity-60">
                            {log.profiles?.role || "System Role"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 bg-muted/5 px-4 py-2 rounded-2xl border border-border/5 w-fit">
                        <Calendar className="h-3.5 w-3.5 opacity-40" />
                        <span className="font-bold tracking-tight">{formatDistanceToNow(date, { addSuffix: true })}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        {log.reason ? (
                          <h3 className="text-base md:text-lg text-foreground font-bold tracking-tight leading-snug">
                            {log.reason}
                          </h3>
                        ) : (
                          <h3 className="text-base md:text-lg text-muted-foreground font-medium italic leading-snug">
                            No explanation provided for this {log.action} action.
                          </h3>
                        )}
                        <p className="text-xs text-muted-foreground/60 font-medium">
                          Performed <span className="text-foreground font-bold">{log.action.replace(/_/g, ' ')}</span> on <span className="text-foreground font-bold">{log.entity_type.replace(/_/g, ' ')}</span> entity.
                        </p>
                      </div>

                      {/* Detailed Lists (Added/Removed) */}
                      {log.details && (
                        (Array.isArray(log.details.added) && log.details.added.length > 0) || 
                        (Array.isArray(log.details.removed) && log.details.removed.length > 0)
                      ) && (
                        <div className="mt-2 space-y-4 bg-muted/5 rounded-[1.5rem] p-5 border border-border/5">
                          {Array.isArray(log.details.added) && log.details.added.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-green-600/70 flex items-center gap-2 px-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                Newly Added Records
                              </span>
                              <div className="grid gap-2">
                                {log.details.added.map((item: AuditLogDetailItem, idx: number) => (
                                  <div key={idx} className="text-[11px] text-muted-foreground bg-background/40 p-3 rounded-xl border border-border/5 flex flex-col gap-1 shadow-xs transition-colors hover:bg-background/60">
                                    {typeof item === 'object' && item !== null ? (
                                      Object.entries(item).map(([k, v]) => (
                                        <div key={k} className="flex gap-3">
                                          <span className="font-black text-[9px] uppercase text-muted-foreground/40 w-20 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                          <span className="truncate font-medium">{formatValue(v)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="font-medium">{formatValue(item)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {Array.isArray(log.details.removed) && log.details.removed.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-600/70 flex items-center gap-2 px-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                Removed Records
                              </span>
                              <div className="grid gap-2 opacity-70">
                                {log.details.removed.map((item: AuditLogDetailItem, idx: number) => (
                                  <div key={idx} className="text-[11px] text-muted-foreground bg-background/40 p-3 rounded-xl border border-border/5 flex flex-col gap-1 line-through decoration-red-500/20 shadow-xs transition-colors hover:bg-background/60">
                                    {typeof item === 'object' && item !== null ? (
                                      Object.entries(item).map(([k, v]) => (
                                        <div key={k} className="flex gap-3">
                                          <span className="font-black text-[9px] uppercase text-muted-foreground/40 w-20 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                          <span className="truncate font-medium">{formatValue(v)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="font-medium">{formatValue(item)}</span>
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
                              <div key={k} className="flex gap-3 text-[11px] text-muted-foreground/60 px-1 border-t border-border/5 pt-2 mt-2 first:mt-0 first:pt-0 first:border-0">
                                <span className="font-black text-[9px] uppercase text-muted-foreground/40 w-20 shrink-0">{k.replace(/_/g, ' ')}:</span>
                                <span className="font-medium">{formatValue(v)}</span>
                              </div>
                            ))
                          }
                        </div>
                      )}

                      {/* Display Data Diff instead of Raw JSON */}
                      {(log.old_value || log.new_value) && (
                        <div className="mt-2">
                          <DataDiff oldVal={log.old_value} newVal={log.new_value} />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-widest bg-secondary/40 text-secondary-foreground border-transparent px-3 py-1 rounded-lg">
                          {log.entity_type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest border-primary/20 text-primary bg-primary/[0.03] px-3 py-1 rounded-lg shadow-xs">
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                        <div className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 px-1">
                          ID: {log.id.split('-')[0]}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminTableShell>
  );
}
