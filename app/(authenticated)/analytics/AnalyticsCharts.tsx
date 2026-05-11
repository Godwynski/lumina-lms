'use client';

import { 
  AreaChart, 
  Area, 
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
  const gradientId = `gradient-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const hasData = data && data.length > 0 && data.some(d => d.count > 0);

  return (
    <div className="w-full h-[280px] flex flex-col group/chart">
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">{title}</p>
          <div className="h-0.5 w-4 bg-primary/40 group-hover/chart:w-8 transition-all duration-500" />
        </div>
      </div>
      
      {!hasData ? (
        <div className="flex-1 w-full flex flex-col items-center justify-center -mt-8 border border-dashed border-border/10 rounded-xl bg-muted/5">
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/30">
            Awaiting Data
          </p>
        </div>
      ) : (
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="8 8" 
              vertical={false} 
              stroke="hsl(var(--border) / 0.1)" 
            />
            <XAxis 
              dataKey="label" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.5)', fontWeight: 700 }} 
              dy={15}
              interval="preserveStartEnd"
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground) / 0.5)', fontWeight: 700 }} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary) / 0.2)', strokeWidth: 1 }} />
            <Area 
              type="monotone" 
              dataKey="count" 
              stroke={color} 
              strokeWidth={2}
              fillOpacity={1} 
              fill={`url(#${gradientId})`} 
              animationDuration={2000}
              activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
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
  return (
    <div className="w-full h-[240px] relative flex flex-col">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={8}
              dataKey="value"
              animationDuration={1000}
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                />
              ))}
            </Pie>
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
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Label */}
        <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col items-center pointer-events-none">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Total</span>
          <span className="text-xl font-black text-foreground">
            {data.reduce((acc, curr) => acc + curr.value, 0)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">{entry.name}</span>
            <span className="text-[10px] font-black text-foreground/40">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
