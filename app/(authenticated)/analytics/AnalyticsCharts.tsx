'use client';

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
  Cell
} from 'recharts';
import type { TrendDataPoint } from '@/lib/actions/analytics';
import { cn } from '@/lib/utils';

interface TrendChartProps {
  data: TrendDataPoint[];
  title: string;
  color: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
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

export function TrendChart({ data, title, color }: TrendChartProps) {
  const hasData = data && data.length > 0 && data.some(d => d.count > 0);

  // Generate ghost data if no real data exists - now set to zero to show the floor line
  const ghostData = !hasData ? [
    { label: '', count: 0 }, { label: '', count: 0 }, { label: '', count: 0 },
    { label: '', count: 0 }, { label: '', count: 0 }, { label: '', count: 0 },
    { label: '', count: 0 }
  ] : data;

  return (
    <div className="w-full h-[280px] flex flex-col group/chart border border-border/40 rounded-2xl p-4 bg-muted/[0.02] relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 px-1 relative z-10">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/90">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 group-hover/chart:w-8 transition-all duration-500" />
        </div>
      </div>
      
      <div className="flex-1 w-full relative z-10">
        <div className={cn("w-full h-full transition-all duration-1000", !hasData && "grayscale")}>
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      </div>
    </div>
  );
}

interface StatusPieChartProps {
  data: { name: string; value: number }[];
}

const COLORS = [
  'hsl(var(--primary))', 
  'hsl(var(--primary) / 0.7)', 
  'hsl(var(--primary) / 0.4)', 
  'hsl(var(--primary) / 0.15)'
];

export function StatusPieChart({ data }: StatusPieChartProps) {
  const hasData = data && data.length > 0 && data.some(d => d.value > 0);
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="w-full h-[240px] relative flex flex-col border border-border/40 rounded-2xl p-4 bg-muted/[0.02] overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.01] to-transparent pointer-events-none" />
      
      <div className="flex-1 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? data : [{ name: 'Empty', value: 1 }]}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={90}
              paddingAngle={hasData ? 8 : 0}
              dataKey="value"
              animationDuration={1000}
              stroke="none"
            >
              {hasData ? data.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                />
              )) : (
                <Cell fill="hsl(var(--muted) / 0.1)" />
              )}
            </Pie>
            {hasData && (
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border) / 0.5)', 
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Label */}
        <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col items-center pointer-events-none">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            {hasData ? 'Total' : 'Pending'}
          </span>
          <span className={cn("text-xl font-black text-foreground transition-all duration-700", !hasData && "opacity-40 scale-90")}>
            {hasData ? total : '0'}
          </span>
        </div>

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-[150px] h-[150px] border border-dashed border-border/20 rounded-full animate-[spin_30s_linear_infinite] opacity-50" />
             <div className="absolute w-[180px] h-[180px] border border-primary/[0.03] rounded-full" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 min-h-[40px]">
        {hasData ? data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/90">{entry.name}</span>
            <span className="text-[10px] font-black text-foreground/60">{entry.value}</span>
          </div>
        )) : (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 italic">Waiting for activity...</span>
          </div>
        )}
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
