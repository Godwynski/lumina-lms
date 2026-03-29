"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowRight, Minus, Plus } from "lucide-react";

interface AuditDiffViewerProps {
  oldValue: string | null;
  newValue: string | null;
}

export function AuditDiffViewer({ oldValue, newValue }: AuditDiffViewerProps) {
  const parseJSON = (val: string | null) => {
    try {
      return val ? JSON.parse(val) : null;
    } catch {
      return val;
    }
  };

  const oldObj = parseJSON(oldValue);
  const newObj = parseJSON(newValue);

  // If both are not objects, show simple comparison
  if (typeof oldObj !== "object" || typeof newObj !== "object" || !oldObj || !newObj) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">Before</Badge>
          <pre className="p-4 bg-slate-50 rounded-lg text-xs overflow-auto font-mono text-slate-600 border border-slate-100 min-h-[100px]">
            {oldValue || "None"}
          </pre>
        </div>
        <div className="space-y-2">
          <Badge variant="outline" className="text-green-500 border-green-200 bg-green-50">After</Badge>
          <pre className="p-4 bg-slate-50 rounded-lg text-xs overflow-auto font-mono text-slate-800 border border-slate-100 min-h-[100px]">
            {newValue || "None"}
          </pre>
        </div>
      </div>
    );
  }

  // Get unique keys from both
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  return (
    <div className="h-[400px] w-full rounded-md border border-slate-200 bg-white overflow-auto">
      <div className="p-4 space-y-3">
        {allKeys.map((key) => {
          const oldVal = oldObj[key];
          const newVal = newObj[key];
          const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

          if (!hasChanged) return null;

          return (
            <div key={key} className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{key}</span>
              <div className="grid grid-cols-[1fr,24px,1fr] items-center gap-2">
                <div className="p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700 font-mono break-all opacity-80">
                  <div className="flex items-start gap-1">
                    <Minus className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
                    <span>{typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal ?? "null")}</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <div className="p-2 bg-green-50 border border-green-100 rounded text-xs text-green-700 font-mono break-all">
                  <div className="flex items-start gap-1">
                    <Plus className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
                    <span>{typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal ?? "null")}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {allKeys.every(k => JSON.stringify(oldObj[k]) === JSON.stringify(newObj[k])) && (
            <div className="text-center py-8 text-slate-400 text-sm italic">
                No measurable data changes detected in this event.
            </div>
        )}
      </div>
    </div>
  );
}
