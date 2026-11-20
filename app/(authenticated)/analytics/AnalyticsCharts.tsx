'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import type { TrendDataPoint } from '@/lib/actions/analytics';
import { cn } from '@/lib/utils';

function ChartAccess({ rows, onSelect }: { rows: { label: string; count: number }[]; onSelect: (index: number) => void }) {
  return <div className="sr-only focus-within:not-sr-only flex flex-wrap gap-2" aria-label="Chart data selections">
    {rows.map((row, index) => <button key={index} type="button" className="rounded border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-ring"
      onClick={() => onSelect(index)}>{row.label}: {row.count}. View records</button>)}
  </div>;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  title: string;
  color: string;
  onSelect?: (point: TrendDataPoint) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; stroke: string }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-md border border-border/50 p-3 shadow-2xl rounded-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: payload[0].stroke }} />
          <p className="text-sm font-black tracking-tight text-foreground">
            {payload[0].value} <span className="text-[11px] font-bold text-muted-foreground">units</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};



export function TrendChart({ data, title, color, onSelect }: TrendChartProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasData = data && data.length > 0 && data.some(d => d.count > 0);

  // Generate ghost data if no real data exists - now set to zero to show the floor line
  const ghostData = !hasData ? [
    { label: '', count: 0 }, { label: '', count: 0 }, { label: '', count: 0 },
    { label: '', count: 0 }, { label: '', count: 0 }, { label: '', count: 0 },
    { label: '', count: 0 }
  ] : data;

  const content = (
    <div className={cn(
      "w-full h-[280px] flex flex-col group/chart border border-border/40 rounded-2xl p-4 bg-muted/[0.02] relative overflow-hidden transition-all duration-300",
      onSelect && "hover:bg-muted/10 hover:border-primary/20 cursor-pointer active:scale-[0.99]"
    )}>
      {/* Subtle background glow */}
      {onSelect && <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.01] to-transparent pointer-events-none" />}
      
      <div className="flex items-center justify-between mb-6 px-1 relative z-10">
        <div className="flex flex-col gap-0.5">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 group-hover/chart:w-8 transition-all duration-500" />
        </div>
        {onSelect && (
          <span className="text-xs font-semibold text-primary flex items-center gap-1 select-none">
            View Details →
          </span>
        )}
      </div>
      
      <div className="flex-1 w-full relative z-10 min-h-0">
        <div className={cn("w-full h-full transition-all duration-300", !hasData && "grayscale")}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0} initialDimension={{ width: 100, height: 100 }}>
              <LineChart onClick={(state) => { if (state.activeTooltipIndex == null) return; const point = data[Number(state.activeTooltipIndex)]; if (point) onSelect?.(point); }} data={ghostData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid 
                  strokeDasharray="8 8" 
                  vertical={true} 
                  horizontal={true}
                  stroke="hsl(var(--border) / 0.25)" 
                />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                  dy={12}
                  interval="preserveStartEnd"
                  hide={!hasData}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                  hide={!hasData}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary) / 0.25)', strokeWidth: 1 }} />
                
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke={hasData ? color : 'hsl(var(--muted-foreground) / 0.6)'} 
                  strokeWidth={2.5}
                  dot={hasData ? { r: 3.5, fill: color, strokeWidth: 0 } : { r: 2, fill: 'hsl(var(--muted-foreground) / 0.5)', strokeWidth: 0 }}
                  activeDot={hasData ? { r: 5, strokeWidth: 0, fill: color } : false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {content}
      <ChartAccess rows={data} onSelect={(i) => onSelect?.(data[i])} />
    </>
  );
}

interface CategoryPieChartProps {
  data: { name: string; value: number }[];
  onSelect?: (name: string) => void;
  title: string;
}

const CATEGORY_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary) / 0.55)',
];

export function CategoryPieChart({ data, title, onSelect }: CategoryPieChartProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasData = data && data.length > 0 && data.some(d => d.value > 0);
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <>
    <div className="w-full min-h-[280px] relative flex flex-col border border-border/40 rounded-2xl p-4 bg-muted/[0.02] overflow-hidden transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.01] to-transparent pointer-events-none" />
      
      <div className="flex items-center justify-between mb-2 px-1 relative z-10">
        <div className="flex flex-col gap-0.5">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 transition-all duration-500" />
        </div>
      </div>

      <div className="relative z-10 h-[185px] w-full">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={hasData ? data : [{ name: 'Empty', value: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={78}
                paddingAngle={hasData ? 4 : 0}
                onClick={(_, index) => { if (hasData) onSelect?.(data[index].name); }}
                dataKey="value"
                isAnimationActive={false}
                stroke="none"
              >
                {hasData ? data.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} 
                    className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                  />
                )) : (
                  <Cell fill="hsl(var(--muted) / 0.25)" />
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        
        {/* Center Label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {hasData ? 'Total' : 'No Data'}
          </span>
          <span className={cn("text-lg font-bold text-foreground", !hasData && "text-muted-foreground")}>
            {hasData ? total : '0'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 pt-1">
        {hasData ? data.map((entry, index) => (
          <button type="button" onClick={() => onSelect?.(entry.name)} key={entry.name} className="flex min-h-6 min-w-6 items-center justify-center gap-1.5 rounded px-1 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
            <span className="text-xs font-medium text-muted-foreground">{entry.name}</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">{entry.value}</span>
          </button>
        )) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground italic">Waiting for activity...</span>
          </div>
        )}

      </div>
    </div>

    </>
  );
}

interface PeakHoursBarChartProps {
  data: { hour: string; count: number }[];
  title: string;
  color: string;
  onSelect?: (hour: string) => void;
}

interface CustomBarTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

const CustomBarTooltip = ({ active, payload, label }: CustomBarTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-md border border-border/50 p-3 shadow-2xl rounded-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <p className="text-sm font-black tracking-tight text-foreground">
            {payload[0].value} <span className="text-[11px] font-bold text-muted-foreground">visits</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function PeakHoursBarChart({ data, title, color, onSelect }: PeakHoursBarChartProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasData = data && data.length > 0 && data.some(d => d.count > 0);

  return (
    <>
    <div className="w-full h-[280px] flex flex-col group/chart border border-border/40 rounded-2xl p-4 bg-muted/[0.02] relative overflow-hidden transition-all duration-300">
      <div className="flex items-center justify-between mb-6 px-1 relative z-10">
        <div className="flex flex-col gap-0.5">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 group-hover/chart:w-8 transition-all duration-500" />
        </div>
      </div>
      
      <div className="flex-1 w-full relative z-10 min-h-0">
        <div className={cn("w-full h-full transition-all duration-300", !hasData && "grayscale")}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid 
                  strokeDasharray="8 8" 
                  vertical={false} 
                  horizontal={true}
                  stroke="hsl(var(--border) / 0.25)" 
                />
                <XAxis 
                  dataKey="hour" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                  domain={[0, 'auto']}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.05)' }} />
                <Bar onClick={(entry) => { const hour = entry.payload?.hour; if (typeof hour === 'string') onSelect?.(hour); }} style={{ cursor: "pointer" }}
                  dataKey="count" 
                  fill={color} 
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
    <ChartAccess rows={data.map(({ hour, count }) => ({ label: hour, count }))} onSelect={(i) => onSelect?.(data[i].hour)} />
    </>
  );
}

export function ChartSkeleton({ title }: { title: string }) {
  return (
    <div className="w-full h-[280px] flex flex-col animate-pulse">
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">{title}</p>
          <div className="h-0.5 w-4 bg-muted/20" />
        </div>
      </div>
      <div className="flex-1 w-full bg-muted/5 rounded-xl border border-dashed border-border/10" />
    </div>
  );
}
