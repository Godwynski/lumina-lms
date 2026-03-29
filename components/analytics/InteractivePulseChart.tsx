"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface Bucket {
  key: string;
  label: string;
  value: number;
}

interface InteractivePulseChartProps {
  buckets: Bucket[];
  peakValue: number;
}

export function InteractivePulseChart({ buckets, peakValue }: InteractivePulseChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getPoints = () => {
    return buckets
      .map((bucket, idx) => {
        const x = buckets.length === 1 ? 50 : (idx / (buckets.length - 1)) * 100;
        const y = 36 - (bucket.value / Math.max(1, peakValue)) * 28;
        return `${x},${y}`;
      })
      .join(" ");
  };

  return (
    <div className="relative rounded-xl border border-border/50 bg-muted/30 p-4 transition-all hover:bg-muted/40 hover:shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
          Circulation Velocity
        </h3>
        {hoveredIndex !== null && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[11px] font-bold text-primary"
          >
            {buckets[hoveredIndex].value} loans in {buckets[hoveredIndex].label}
          </motion.div>
        )}
      </div>

      <div className="relative h-32 w-full pt-2">
        <svg viewBox="0 0 100 40" className="h-full w-full overflow-visible" preserveAspectRatio="none">
          {/* Subtle Grid Lines */}
          {[0, 10, 20, 30].map((v) => (
            <line
              key={v}
              x1="0"
              y1={36 - (v / 40) * 36}
              x2="100"
              y2={36 - (v / 40) * 36}
              stroke="currentColor"
              strokeWidth="0.1"
              className="text-border/40"
            />
          ))}

          {/* Trend Line */}
          <motion.polyline
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            points={getPoints()}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-primary"
            vectorEffect="non-scaling-stroke"
          />

          {/* Interactive Points */}
          {buckets.map((bucket, idx) => {
            const x = buckets.length === 1 ? 50 : (idx / (buckets.length - 1)) * 100;
            const y = 36 - (bucket.value / Math.max(1, peakValue)) * 28;
            return (
              <g
                key={bucket.key}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                <motion.circle
                  initial={{ scale: 0 }}
                  animate={{ scale: hoveredIndex === idx ? 2 : 1 }}
                  cx={x}
                  cy={y}
                  r="1.2"
                  className={hoveredIndex === idx ? "fill-primary" : "fill-primary/80"}
                />
                {/* Hit area */}
                <circle cx={x} cy={y} r="5" fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-6 border-t border-border/20 pt-3">
        {buckets.map((m, idx) => (
          <span
            key={m.key}
            className={`text-center text-[9px] font-bold transition-colors ${
              hoveredIndex === idx ? "text-primary scale-110" : "text-muted-foreground/60"
            }`}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
