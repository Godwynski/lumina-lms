'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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

interface TrendChartProps {
  data: TrendDataPoint[];
  title: string;
  color: string;
  href?: string;
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: payload[0].stroke }} />
          <p className="text-sm font-black tracking-tight text-foreground">
            {payload[0].value} <span className="text-[10px] font-bold text-muted-foreground">units</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};



export function TrendChart({ data, title, color, href }: TrendChartProps) {
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
      href && "hover:bg-muted/10 hover:border-primary/20 cursor-pointer active:scale-[0.99]"
    )}>
      {/* Subtle background glow */}
      {href && <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.01] to-transparent pointer-events-none" />}
      
      <div className="flex items-center justify-between mb-6 px-1 relative z-10">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/90">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 group-hover/chart:w-8 transition-all duration-500" />
        </div>
        {href && (
          <span className="text-[9px] font-black text-primary/40 group-hover/chart:text-primary transition-all duration-300 uppercase tracking-widest flex items-center gap-1 select-none translate-x-1 group-hover/chart:translate-x-0">
            View Details →
          </span>
        )}
      </div>
      
      <div className="flex-1 w-full relative z-10 min-h-0">
        <div className={cn("w-full h-full transition-all duration-1000", !hasData && "grayscale")}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0} initialDimension={{ width: 100, height: 100 }}>
              <LineChart data={ghostData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid 
                  strokeDasharray="8 8" 
                  vertical={true} 
                  horizontal={true}
                  stroke="hsl(var(--border) / 0.1)" 
                />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.8)', fontWeight: 700 }} 
                  dy={15}
                  interval="preserveStartEnd"
                  hide={!hasData}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.8)', fontWeight: 700 }} 
                  hide={!hasData}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary) / 0.2)', strokeWidth: 1 }} />
                
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke={hasData ? color : 'hsl(var(--muted-foreground) / 0.6)'} 
                  strokeWidth={3}
                  dot={hasData ? { r: 3, fill: color, strokeWidth: 0 } : { r: 2, fill: 'hsl(var(--muted-foreground) / 0.5)', strokeWidth: 0 }}
                  activeDot={hasData ? { r: 5, strokeWidth: 0, fill: color } : false}
                  animationDuration={2000}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block w-full">{content}</Link>;
  }

  return content;
}

interface CategoryPieChartProps {
  data: { name: string; value: number }[];
  title: string;
}

const CATEGORY_COLORS = [
  'hsl(var(--primary))', 
  'hsl(var(--primary) / 0.85)', 
  'hsl(var(--primary) / 0.7)', 
  'hsl(var(--primary) / 0.55)', 
  'hsl(var(--primary) / 0.4)', 
  'hsl(var(--primary) / 0.25)', 
  'hsl(var(--primary) / 0.15)'
];

export function CategoryPieChart({ data, title }: CategoryPieChartProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasData = data && data.length > 0 && data.some(d => d.value > 0);
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="w-full h-[280px] relative flex flex-col border border-border/40 rounded-2xl p-4 bg-muted/[0.02] overflow-hidden transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.01] to-transparent pointer-events-none" />
      
      <div className="flex items-center justify-between mb-2 px-1 relative z-10">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/90">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 transition-all duration-500" />
        </div>
      </div>

      <div className="flex-1 relative z-10 min-h-0">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={hasData ? data : [{ name: 'Empty', value: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={hasData ? 6 : 0}
                dataKey="value"
                animationDuration={1000}
                stroke="none"
              >
                {hasData ? data.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} 
                    className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                  />
                )) : (
                  <Cell fill="hsl(var(--muted) / 0.1)" />
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        
        {/* Center Label */}
        <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col items-center pointer-events-none mt-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            {hasData ? 'Total' : 'No Data'}
          </span>
          <span className={cn("text-lg font-black text-foreground transition-all duration-700", !hasData && "opacity-40 scale-90")}>
            {hasData ? total : '0'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 min-h-[40px] max-h-[70px] overflow-y-auto custom-scrollbar">
        {hasData ? data.slice(0, 6).map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/90 truncate max-w-[80px]">{entry.name}</span>
            <span className="text-[9px] font-black text-foreground/60">{entry.value}</span>
          </div>
        )) : (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 italic">Waiting for activity...</span>
          </div>
        )}
        {hasData && data.length > 6 && (
          <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest self-center">
            +{data.length - 6} more
          </span>
        )}
      </div>
    </div>
  );
}

interface PeakHoursBarChartProps {
  data: { hour: string; count: number }[];
  title: string;
  color: string;
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <p className="text-sm font-black tracking-tight text-foreground">
            {payload[0].value} <span className="text-[10px] font-bold text-muted-foreground">visits</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function PeakHoursBarChart({ data, title, color }: PeakHoursBarChartProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasData = data && data.length > 0 && data.some(d => d.count > 0);

  return (
    <div className="w-full h-[280px] flex flex-col group/chart border border-border/40 rounded-2xl p-4 bg-muted/[0.02] relative overflow-hidden transition-all duration-300">
      <div className="flex items-center justify-between mb-6 px-1 relative z-10">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/90">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 group-hover/chart:w-8 transition-all duration-500" />
        </div>
      </div>
      
      <div className="flex-1 w-full relative z-10 min-h-0">
        <div className={cn("w-full h-full transition-all duration-1000", !hasData && "grayscale")}>
          {mounted && (
            <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0} minHeight={0}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid 
                  strokeDasharray="8 8" 
                  vertical={false} 
                  horizontal={true}
                  stroke="hsl(var(--border) / 0.1)" 
                />
                <XAxis 
                  dataKey="hour" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.8)', fontWeight: 700 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.8)', fontWeight: 700 }} 
                  domain={[0, 'auto']}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.05)' }} />
                <Bar 
                  dataKey="count" 
                  fill={color} 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton({ title }: { title: string }) {
  return (
    <div className="w-full h-[280px] flex flex-col animate-pulse">
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">{title}</p>
          <div className="h-0.5 w-4 bg-muted/20" />
        </div>
      </div>
      <div className="flex-1 w-full bg-muted/5 rounded-xl border border-dashed border-border/10" />
    </div>
  );
}
