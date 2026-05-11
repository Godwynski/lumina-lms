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
  Cell,
  Legend
} from 'recharts';
import type { TrendDataPoint } from '@/lib/actions/analytics';

interface TrendChartProps {
  data: TrendDataPoint[];
  title: string;
  color: string;
}

export function TrendChart({ data, title, color }: TrendChartProps) {
  return (
    <div className="w-full h-[220px]">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3 ml-1">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color.replace(/[^a-zA-Z0-9]/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.02)" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} 
            dy={10}
            interval="preserveStartEnd"
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))', 
              border: '1px solid hsl(var(--border))', 
              borderRadius: '8px',
              fontSize: '10px',
              padding: '8px 12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            itemStyle={{ color: 'hsl(var(--popover-foreground))', padding: 0 }}
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke={color} 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill={`url(#gradient-${color.replace(/[^a-zA-Z0-9]/g, '-')})`} 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StatusPieChartProps {
  data: { name: string; value: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--primary) / 0.7)', 'hsl(var(--primary) / 0.4)', 'hsl(var(--primary) / 0.15)'];

export function StatusPieChart({ data }: StatusPieChartProps) {
  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={45}
            outerRadius={65}
            paddingAngle={4}
            dataKey="value"
            animationDuration={400}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
             contentStyle={{ 
              backgroundColor: 'rgb(10,10,10)', 
              border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '4px',
              fontSize: '10px'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            align="center" 
            iconType="circle"
            iconSize={4}
            formatter={(value) => <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
