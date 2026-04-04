'use client';

import { useState, useEffect } from 'react';
import { Zap, ShieldCheck, BarChart2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HealthNode() {
  const [latency, setLatency] = useState<number | null>(null);
  const [traffic, setTraffic] = useState<'Normal' | 'Low' | 'High'>('Normal');
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      const start = performance.now();
      try {
        const res = await fetch('/api/heartbeat', { cache: 'no-store' });
        if (res.ok) {
          const end = performance.now();
          setLatency(Math.round(end - start));
          
          // Simulate traffic fluctuations
          const rand = Math.random();
          if (rand > 0.9) setTraffic('High');
          else if (rand < 0.1) setTraffic('Low');
          else setTraffic('Normal');
          
          setIsSecure(true);
        } else {
          setIsSecure(false);
        }
      } catch {
        setIsSecure(false);
        setLatency(null);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <StatusIndicator 
        icon={Zap} 
        label="Response" 
        value={latency !== null ? `${latency}ms` : '---'} 
        color={latency !== null && latency < 200 ? "text-emerald-500" : "text-amber-500"} 
      />
      <div className="h-px w-full bg-border/40" />
      <StatusIndicator 
        icon={ShieldCheck} 
        label="Firewall" 
        value={isSecure ? "Active" : "Degraded"} 
        color={isSecure ? "text-blue-500" : "text-destructive"} 
      />
      <div className="h-px w-full bg-border/40" />
      <StatusIndicator 
        icon={BarChart2} 
        label="Traffic" 
        value={traffic} 
        color={traffic === 'High' ? "text-amber-500" : "text-emerald-500"} 
      />
    </div>
  );
}

function StatusIndicator({ icon: Icon, label, value, color }: { icon: LucideIcon, label: string, value: string, color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className={cn("shrink-0", color)} />
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">{label}:</span>
      <span className={cn("text-[11px] font-bold", color)}>{value}</span>
    </div>
  );
}
