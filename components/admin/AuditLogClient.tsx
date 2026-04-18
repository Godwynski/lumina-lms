"use client";

import { useState } from "react";
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
  Calendar
} from "lucide-react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminTableShell } from "./AdminTableShell";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AuditLog {
  id: string;
  admin_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
}

export function AuditLogClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const pageSize = 10;

  const queryParams = new URLSearchParams({
    limit: pageSize.toString(),
    offset: ((page - 1) * pageSize).toString(),
    ...(search && { query: search }),
    ...(entityType !== "all" && { entityType }),
  });

  const { data, error, mutate, isValidating } = useSWR<{
    logs: AuditLog[];
    total: number;
  }>(`/api/admin/audit-logs?${queryParams.toString()}`, fetcher, {
    revalidateOnFocus: false,
  });

  const handleExport = async () => {
    try {
      const exportParams = new URLSearchParams({
        ...(search && { query: search }),
        ...(entityType !== "all" && { entityType }),
      });
      window.open(`/api/admin/audit-logs/export?${exportParams.toString()}`, '_blank');
      toast.success("Audit log export started");
    } catch {
      toast.error("Failed to export audit logs");
    }
  };

  const entityTypes = [
    "all",
    "book",
    "book_copy",
    "profile",
    "borrowing_record",
  ];

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
            className="h-8 rounded-lg bg-background shadow-xs text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isValidating && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            className="h-8 rounded-lg shadow-sm text-xs font-bold uppercase tracking-tight"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Export CSV
          </Button>
        </div>
      }
      controls={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full p-1">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input 
              placeholder="Search actions or entity IDs..." 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-10 border-border/40 shadow-none focus-visible:ring-ring bg-muted/10 rounded-xl text-xs font-bold"
            />
          </div>
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
            <SelectTrigger className="h-10 border-border/40 shadow-none bg-muted/10 rounded-xl text-xs font-bold">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground/50" />
                <SelectValue placeholder="Entity Type" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/40 shadow-xl">
              {entityTypes.map(t => (
                <SelectItem key={t} value={t} className="capitalize text-xs font-bold py-2.5">
                  {t === "all" ? "All Entities" : t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end px-3 text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest bg-muted/20 rounded-xl">
            {data ? `${data.total} Records` : "Indexing..."}
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
      <div className="py-2">
        {error && (
          <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100">
            Failed to load audit logs. Please check your permissions.
          </div>
        )}

        {data?.logs.length === 0 && (
          <div className="h-48 flex flex-col items-center justify-center gap-2 opacity-50 bg-muted/20 rounded-xl border border-border border-dashed">
            <Database className="h-10 w-10 text-muted-foreground" />
            <span className="text-sm font-medium">No results match your search.</span>
          </div>
        )}

        {!data && !error && (
          <div className="space-y-6 relative border-l-2 border-muted pl-6 ml-4">
             {Array.from({ length: 4 }).map((_, i) => (
               <div key={i} className="relative">
                 <div className="absolute -left-[31px] top-2 h-4 w-4 rounded-full bg-muted animate-pulse ring-4 ring-background" />
                 <div className="h-28 w-full bg-muted animate-pulse rounded-xl" />
               </div>
             ))}
          </div>
        )}

        {data && data.logs.length > 0 && (
          <div className="relative border-l-[3px] border-border/60 pl-6 ml-2 md:ml-6 space-y-8 py-2">
            {data.logs.map((log) => {
              const date = log.created_at ? new Date(log.created_at) : new Date();

              return (
                <div key={log.id} className="relative group">
                  <div className="absolute -left-[31px] md:-left-[31px] top-4 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background ring-4 ring-background z-10 group-hover:scale-125 group-hover:bg-primary transition-all shadow-sm" />
                  
                  <div className="rounded-2xl border border-border/40 bg-card/40 p-4 md:p-5 shadow-none hover:shadow-lg hover:shadow-primary/5 transition-all hover:border-primary/20 backdrop-blur-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-inner">
                          <UserIcon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-card-foreground truncate">
                            {log.profiles?.full_name || log.profiles?.email || "System Actor"}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-tight">
                            {log.profiles?.role || "Admin Role"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full w-fit">
                        <Calendar className="h-3 w-3" />
                        <span className="font-semibold">{formatDistanceToNow(date, { addSuffix: true })}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {log.reason ? (
                         <h3 className="text-sm md:text-base text-foreground font-medium leading-relaxed">
                          {log.reason}
                         </h3>
                      ) : (
                         <h3 className="text-sm md:text-base text-muted-foreground italic leading-relaxed">
                           System performed {log.action} on {log.entity_type}.
                         </h3>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider bg-secondary/60 text-secondary-foreground border-transparent px-2.5">
                          {log.entity_type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="font-black text-[10px] uppercase tracking-wide border-primary/30 text-primary bg-primary/5 px-2.5 shadow-sm">
                          {log.action.replace(/_/g, " ")}
                        </Badge>
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
