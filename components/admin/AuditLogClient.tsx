"use client";

import { useState } from "react";
import useSWR from "swr";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { 
  Search, 
  Download, 
  Filter, 
  Clock, 
  User as UserIcon, 
  Database,
  RefreshCw,
  Eye
} from "lucide-react";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { AuditDiffViewer } from "./AuditDiffViewer";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AuditLog {
  id: string;
  admin_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
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

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("create")) return "bg-green-100 text-green-700 border-green-200";
    if (a.includes("delete")) return "bg-red-100 text-red-700 border-red-200";
    if (a.includes("update") || a.includes("edit")) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const entityTypes = [
    "all",
    "book",
    "profile",
    "borrow_record",
    "reservation",
    "violation",
    "setting",
  ];

  return (
    <Card className="border-border shadow-sm overflow-hidden bg-card backdrop-blur-sm">
      <CardHeader className="border-b bg-muted/50 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Activity History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isValidating}
              className="h-9 rounded-lg"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleExport}
              className="h-9 rounded-lg shadow-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by action or ID..." 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-10 border-border shadow-none focus-visible:ring-ring"
            />
          </div>
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
            <SelectTrigger className="h-10 border-border shadow-none">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              {entityTypes.map(t => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end px-2 text-xs text-muted-foreground font-medium">
            {data ? `${data.total} records found` : "Searching records..."}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow>
                <TableHead className="w-[180px] font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Timestamp</TableHead>
                <TableHead className="w-[140px] font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Entity</TableHead>
                <TableHead className="w-[140px] font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Action</TableHead>
                <TableHead className="min-w-[200px] font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Admin</TableHead>
                <TableHead className="w-[100px] text-right font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-red-500 font-medium">
                    Failed to load audit logs. Please check your permissions.
                  </TableCell>
                </TableRow>
              )}
              {data?.logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 opacity-50">
                      <Database className="h-10 w-10 text-muted-foreground" />
                      <span className="text-sm font-medium">No results match your search.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!data && !error && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-full bg-muted animate-pulse rounded" /></TableCell>
                  ))}
                </TableRow>
              ))}
              {data?.logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/50 transition-colors group">
                  <TableCell className="font-medium text-foreground">
                    <div className="flex flex-col">
                      <span className="text-sm">{log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "-"}</span>
                      <span className="text-[10px] text-muted-foreground font-mono tracking-tighter">
                        {log.created_at ? format(new Date(log.created_at), "HH:mm:ss") : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold capitalize text-foreground">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">
                          #{log.entity_id.split("-")[0]}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-black text-[10px] uppercase tracking-wide border-2 ${getActionColor(log.action)}`}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center border-border shadow-sm overflow-hidden border">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                       </div>
                       <div className="flex flex-col min-w-0">
                         <span className="text-xs font-bold text-foreground truncate">
                            {log.profiles?.full_name || log.profiles?.email || "Unknown"}
                         </span>
                         <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none">
                            {log.profiles?.role || "Admin"}
                         </span>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground group-hover:visible">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="sm:max-w-xl">
                        <SheetHeader className="mb-6">
                          <SheetTitle className="text-2xl font-black">Event Insight</SheetTitle>
                          <SheetDescription className="text-muted-foreground font-medium">
                            Comparison of state changes for this {log.entity_type} {log.action} event.
                          </SheetDescription>
                        </SheetHeader>
                        
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/50 rounded-xl border border-border flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">When</span>
                                <span className="text-xs font-bold font-mono text-foreground">{log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "-"}</span>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-xl border border-border flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Admin</span>
                                <span className="text-xs font-bold truncate text-foreground">{log.profiles?.full_name || log.profiles?.email}</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-xs font-black uppercase tracking-widest text-foreground border-b border-border pb-2 flex items-center gap-2">
                              <Database className="h-3 w-3" />
                              Data Changes
                            </h3>
                            <AuditDiffViewer oldValue={log.old_value} newValue={log.new_value} />
                          </div>

                          {log.reason && (
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                              <h4 className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Administrative Reason</h4>
                              <p className="text-xs text-emerald-900 leading-relaxed font-medium">&quot;{log.reason}&quot;</p>
                            </div>
                          )}
                        </div>
                      </SheetContent>
                    </Sheet>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data && data.total > 0 && (
          <div className="p-4 border-t border-border bg-muted/30">
            <CompactPagination 
              page={page}
              totalItems={data.total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
