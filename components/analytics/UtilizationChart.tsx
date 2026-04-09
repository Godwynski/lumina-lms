"use client";

import { m } from "framer-motion";
import Link from "next/link";

interface CategoryUtilization {
  name: string;
  total: number;
  borrowed: number;
  utilization: number;
}

interface UtilizationChartProps {
  categories: CategoryUtilization[];
}

export function UtilizationChart({ categories }: UtilizationChartProps) {
  return (
    <div className="space-y-3">
      {categories.map((c, idx) => (
        <m.div
          key={c.name}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1, duration: 0.5 }}
        >
          <Link
            href="/catalog"
            className="group flex flex-col gap-2 rounded-xl border border-border/40 bg-card p-3 transition-all hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold text-foreground">
                {c.name}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground group-hover:text-primary transition-colors">
                {c.utilization}% Utilization
              </span>
            </div>

            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/60 ring-1 ring-inset ring-black/5">
              <m.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, c.utilization)}%` }}
                transition={{ delay: (idx * 0.1) + 0.5, duration: 1.2, ease: "easeOut" }}
                className={`h-full rounded-full transition-all duration-1000 ${
                  c.utilization > 80 ? 'bg-amber-500' : 
                  c.utilization > 50 ? 'bg-primary' : 
                  'bg-indigo-400'
                } shadow-[0_0_8px_rgba(0,0,0,0.1)]`}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
              <span className="font-medium group-hover:text-foreground/80 transition-colors">
                {c.borrowed} Copies Borrowed
              </span>
              <span className="font-bold">
                of {c.total}
              </span>
            </div>
          </Link>
        </m.div>
      ))}

      {categories.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground/60">
          No circulation activity to report for these categories.
        </div>
      )}
    </div>
  );
}
