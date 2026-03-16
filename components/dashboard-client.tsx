'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Users, 
  Clock, 
  ArrowUpRight, 
  Plus, 
  Search, 
  FileText, 
  Settings, 
  TrendingUp, 
  BookMarked, 
  LayoutDashboard, 
  History as HistoryIcon,
  Moon, 
  Sun, 
  Cloud, 
  Coffee, 
  Sparkles, 
  CloudMoon, 
  Zap,
  Sunrise,
  Sunset,
  Timer,
  CloudSun
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MagicCard } from '@/components/magicui/magic-card';
import BlurFade from '@/components/magicui/blur-fade';
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';

interface DashboardProps {
  user: User;
  role: string | null;
  stats: {
    totalBooks: number;
    activeLoans: number;
    totalUsers: number;
    recentBooks: any[];
  };
}

export function DashboardClient({ user, role, stats }: DashboardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getMoodInfo = () => {
    if (!mounted) return { 
      greeting: 'Welcome', 
      icon: Zap, 
      subtitle: 'Initializing your intelligence hub...', 
      mood: 'neutral',
      color: 'indigo',
      bannerTitle: 'System Loading',
      bannerText: 'Optimizing your synchronized overview...'
    };
    
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) return { 
      greeting: 'Good Morning', 
      icon: Sunrise, 
      subtitle: 'Fresh start. Your library records are synchronized for the day.',
      mood: 'morning',
      color: 'amber',
      bannerTitle: 'Morning Briefing',
      bannerText: 'New acquisitions from overnight have been indexed. You have a clear schedule for resource management today.'
    };
    if (hour >= 12 && hour < 17) return { 
      greeting: 'Good Afternoon', 
      icon: CloudSun, 
      subtitle: 'Mid-day check-in. The system is performing at peak capacity.',
      mood: 'afternoon',
      color: 'emerald',
      bannerTitle: 'Peak Performance',
      bannerText: 'Heavy traffic detected in the digital library. Intelligence nodes are scaling to ensure zero-latency access.'
    };
    if (hour >= 17 && hour < 21) return { 
      greeting: 'Good Evening', 
      icon: Sunset, 
      subtitle: 'Wrapping up? Here is your end-of-day resource report.',
      mood: 'evening',
      color: 'orange',
      bannerTitle: 'Daily Sync',
      bannerText: 'All digital loans for today have been logged. Review any pending returns before the end of the shift.'
    };
    
    // Night Logic (Split between "Late Night" and "Early Night")
    const isLate = hour < 5;
    return { 
      greeting: isLate ? 'Working late?' : 'Good Night', 
      icon: isLate ? Coffee : Moon, 
      subtitle: isLate ? 'Burning the midnight oil. Lumina remains active.' : 'Closing the day strong. All systems operational.',
      mood: 'night',
      color: 'indigo',
      bannerTitle: isLate ? 'Power Hour' : 'Nocturnal Progress',
      bannerText: isLate 
        ? "You're pushing through the quiet hours. Lumina has minimized background telemetry for maximum performance." 
        : "Final system optimizations running. Your workspace is secured and synchronized for tomorrow morning."
    };
  };

  const mood = getMoodInfo();
  const isNight = mood.mood === 'night';
  const isMorning = mood.mood === 'morning';
  const isAfternoon = mood.mood === 'afternoon';
  const isEvening = mood.mood === 'evening';
  const greetingSuffix = mood.greeting.endsWith('?') ? '' : ',';

  // Dynamic theme colors based on mood
  const moodConfig: Record<string, {
    bg: string;
    border: string;
    text: string;
    accent: string;
    orb1: string;
    orb2: string;
    icon: string;
    bannerBg: string;
    bannerBorder: string;
    pulse: string;
  }> = {
    morning: {
      bg: "bg-amber-50/40",
      border: "border-amber-100",
      text: "text-amber-700",
      accent: "from-amber-500 to-orange-600",
      orb1: "bg-amber-300/30",
      orb2: "bg-orange-300/30",
      icon: "text-amber-600",
      bannerBg: "bg-amber-50",
      bannerBorder: "border-amber-100",
      pulse: "bg-amber-500"
    },
    afternoon: {
      bg: "bg-emerald-50/30",
      border: "border-emerald-100",
      text: "text-emerald-700",
      accent: "from-emerald-500 to-teal-600",
      orb1: "bg-emerald-200/40",
      orb2: "bg-teal-200/40",
      icon: "text-emerald-600",
      bannerBg: "bg-emerald-50",
      bannerBorder: "border-emerald-100",
      pulse: "bg-emerald-500"
    },
    evening: {
      bg: "bg-orange-50/30",
      border: "border-orange-100",
      text: "text-orange-700",
      accent: "from-rose-500 to-orange-600",
      orb1: "bg-rose-100/40",
      orb2: "bg-orange-100/40",
      icon: "text-orange-600",
      bannerBg: "bg-orange-50",
      bannerBorder: "border-orange-100",
      pulse: "bg-orange-500"
    },
    night: {
      bg: "bg-indigo-50/30",
      border: "border-indigo-100",
      text: "text-indigo-700",
      accent: "from-indigo-600 to-purple-600",
      orb1: "bg-indigo-200/40",
      orb2: "bg-purple-200/40",
      icon: "text-indigo-600",
      bannerBg: "bg-indigo-50",
      bannerBorder: "border-indigo-100",
      pulse: "bg-indigo-500"
    },
    neutral: {
      bg: "bg-zinc-50/30",
      border: "border-zinc-200/60",
      text: "text-zinc-600",
      accent: "from-zinc-600 to-zinc-800",
      orb1: "bg-zinc-100",
      orb2: "bg-zinc-100",
      icon: "text-zinc-600",
      bannerBg: "bg-zinc-50",
      bannerBorder: "border-zinc-200/50",
      pulse: "bg-zinc-400"
    }
  };

  const theme = moodConfig[mood.mood] || moodConfig.neutral;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const metricCards = [
    { 
      title: 'Total Resources', 
      value: stats.totalBooks.toString(), 
      icon: BookOpen, 
      color: isNight ? 'text-indigo-400' : 'text-blue-600', 
      bg: isNight ? 'bg-indigo-500/10' : 'bg-blue-50',
      description: 'Physical & Digital items'
    },
    { 
      title: 'Active Loans', 
      value: stats.activeLoans.toString(), 
      icon: Clock, 
      color: isNight ? 'text-purple-400' : 'text-purple-600', 
      bg: isNight ? 'bg-purple-500/10' : 'bg-purple-50',
      description: 'Items currently out'
    },
    { 
      title: 'Active Users', 
      value: stats.totalUsers.toString(), 
      icon: Users, 
      color: isNight ? 'text-emerald-400' : 'text-emerald-600', 
      bg: isNight ? 'bg-emerald-500/10' : 'bg-emerald-50',
      description: 'Students & Staff'
    },
    { 
      title: isNight ? 'Late Night Focus' : 'System Health', 
      value: isNight ? 'Peak' : '99.9%', 
      icon: isNight ? Sparkles : TrendingUp, 
      color: isNight ? 'text-orange-400' : 'text-orange-600', 
      bg: isNight ? 'bg-orange-500/10' : 'bg-orange-50',
      description: isNight ? 'Efficiency optimized' : 'All services operational'
    }
  ];

  const isAdmin = role === 'admin' || role === 'librarian';
  
  const quickActions = [
    { title: 'Add Resource', icon: Plus, href: '/protected/catalog/add', color: 'bg-indigo-600', show: isAdmin },
    { title: 'Search Catalog', icon: Search, href: role === 'student' ? '/protected/student-catalog' : '/protected/catalog', color: 'bg-zinc-800', show: true },
    { title: 'Generate Report', icon: FileText, href: '/protected/reports', color: 'bg-zinc-800', show: role !== 'student' },
    { title: 'Member Status', icon: Users, href: '/protected/users', color: 'bg-zinc-800', show: role !== 'student' },
    { title: 'Loan History', icon: HistoryIcon, href: '/protected/history', color: 'bg-zinc-800', show: true },
    { title: 'System Settings', icon: Settings, href: '/protected/settings', color: 'bg-zinc-800', show: role === 'admin' },
  ].filter(action => action.show);

  return (
    <div className="space-y-10 pb-12">
      {/* Header Section with dynamic mood-aware light theme */}
      <section className={cn(
        "relative overflow-hidden p-8 md:p-12 rounded-[40px] transition-all duration-1000 group border",
        theme.bg, theme.border, 
        isNight ? "shadow-xl shadow-indigo-500/5" : "shadow-sm"
      )}>
        {/* Animated Background Orbs */}
        <div className={cn(
          "absolute -top-24 -right-24 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
          theme.orb1
        )} />
        <div className={cn(
          "absolute -bottom-24 -left-24 w-64 h-64 blur-3xl rounded-full transition-colors duration-1000",
          theme.orb2
        )} />
        
        {mounted && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.5, 0.2], y: [0, -20, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
              className={cn("absolute top-10 left-[15%] w-1.5 h-1.5 rounded-full", isMorning ? "bg-amber-400" : isAfternoon ? "bg-emerald-400" : isEvening ? "bg-orange-400" : "bg-indigo-400")} 
            />
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.6, 0.2], y: [0, 20, 0] }}
              transition={{ duration: 7, repeat: Infinity, delay: 1 }}
              className={cn("absolute top-32 left-[45%] w-1.5 h-1.5 rounded-full", isMorning ? "bg-orange-400" : isAfternoon ? "bg-teal-400" : isEvening ? "bg-rose-400" : "bg-purple-400")} 
            />
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.7, 0.2], x: [0, 10, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: 2 }}
              className={cn("absolute top-20 left-[75%] w-2 h-2 rounded-full", isMorning ? "bg-amber-500" : isAfternoon ? "bg-emerald-500" : isEvening ? "bg-orange-500" : "bg-indigo-500")} 
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <BlurFade delay={0.1}>
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border shadow-sm transition-all duration-1000",
                theme.bannerBg, theme.bannerBorder, theme.text
              )}>
                <mood.icon size={12} className="animate-pulse" />
                {mood.bannerTitle}
              </div>
            </BlurFade>
            <BlurFade delay={0.2}>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 !leading-[1.1]">
                {mood.greeting}{greetingSuffix} <br className="sm:hidden" />
                <span className={cn("text-transparent bg-clip-text bg-gradient-to-r", theme.accent)}>
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
                {mounted && <Sparkles className={cn("inline-block ml-3 animate-bounce h-8 w-8", theme.icon)} />}
              </h1>
              <p className="text-zinc-500 max-w-lg mt-3 text-lg font-medium">
                {mood.subtitle}
              </p>
            </BlurFade>
          </div>
          
          <BlurFade delay={0.3}>
            <div className={cn(
              "flex items-center gap-4 p-2 pr-6 rounded-3xl border shadow-inner transition-colors duration-1000",
              isNight ? "bg-white border-indigo-100" : "bg-zinc-50 border-zinc-200/50"
            )}>
              <div className={cn(
                "h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-xl ring-4 transition-all duration-1000",
                "bg-gradient-to-br ring-white shadow-zinc-200/50",
                theme.accent
              )}>
                <span className="text-2xl font-black italic">{(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}</span>
              </div>
              <div className="flex flex-col">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Authenticated Proxy</p>
                <p className="text-sm font-bold text-zinc-900 truncate max-w-[150px]">{user.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse",
                    theme.pulse
                  )} />
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-tighter",
                    theme.text
                  )}>{role} Access</span>
                </div>
              </div>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Metrics Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {metricCards.map((card, idx) => (
          <motion.div key={card.title} variants={item}>
            <MagicCard 
              className={cn(
                "group flex flex-col p-6 gap-6 transition-all duration-500 border",
                isNight 
                  ? "bg-white/80 border-indigo-100 hover:border-indigo-400/50 shadow-sm" 
                  : "bg-white border-zinc-200/60 hover:border-indigo-300 shadow-sm"
              )}
              gradientColor={isNight ? "rgba(99, 102, 241, 0.12)" : "rgba(99, 102, 241, 0.08)"}
            >
              <div className="flex justify-between items-start">
                <div className={cn(
                  "p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform duration-300",
                  card.bg,
                  card.color
                )}>
                  <card.icon size={22} />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 border uppercase tracking-tighter",
                  theme.text, theme.bannerBg, theme.bannerBorder
                )}>
                  <TrendingUp size={10} strokeWidth={3} /> {mood.mood === 'afternoon' ? 'Peak' : 'Stable'}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-400">{card.title}</p>
                <h3 className="text-3xl font-black mt-1 tracking-tight text-zinc-900">{card.value}</h3>
                <p className="text-xs mt-2 font-medium text-zinc-400">{card.description}</p>
              </div>
            </MagicCard>
          </motion.div>
        ))}
      </motion.div>

      {mounted && (
        <BlurFade delay={0.4}>
          <div className={cn(
            "p-6 rounded-[32px] border transition-all duration-1000 flex items-start sm:items-center gap-6 relative overflow-hidden group shadow-lg",
            theme.bannerBg, theme.bannerBorder, theme.text
          )}>
             <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent pointer-events-none opacity-50", theme.bannerBg.replace('bg-', 'from-'))} />
             <div className={cn("h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 border", theme.bannerBg, theme.bannerBorder, theme.icon)}>
                <mood.icon size={26} strokeWidth={2} />
             </div>
             <div className="relative z-10">
                <p className="text-base font-bold text-zinc-900 flex items-center gap-2">
                   {mood.bannerTitle} <Zap size={14} className={cn("fill-current", theme.icon)} />
                </p>
                <p className="text-sm text-zinc-500 leading-relaxed mt-0.5">
                   {mood.bannerText}
                </p>
             </div>
          </div>
        </BlurFade>
      )}

      <div className="space-y-8">
        <div className="space-y-4">
          <h2 className="text-xl font-black px-2 text-zinc-900">Shortcuts</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action, idx) => (
              <BlurFade key={action.title} delay={0.5 + idx * 0.05}>
                <Link href={action.href}>
                  <div className={cn(
                    "flex flex-col items-center justify-center gap-4 p-6 rounded-[32px] border transition-all duration-500 text-center h-full group/btn",
                    isNight 
                      ? "bg-white border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50/30" 
                      : "bg-white border-zinc-200/50 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10"
                  )}>
                    <div className={cn(
                      "p-3.5 rounded-2xl transition-all duration-500 group-hover/btn:scale-110",
                      idx === 0 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                        : (isNight ? "bg-indigo-50 text-indigo-600 group-hover/btn:bg-indigo-100" : "bg-zinc-50 text-zinc-600 group-hover/btn:bg-indigo-50 group-hover/btn:text-indigo-600")
                    )}>
                      <action.icon size={22} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">{action.title}</span>
                  </div>
                </Link>
              </BlurFade>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black flex items-center gap-2.5 text-zinc-900">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isNight ? "bg-indigo-100" : "bg-indigo-50"
              )}>
                <BookMarked size={18} className="text-indigo-600" />
              </div>
              Recent Acquisitions
            </h2>
            <Link href="/protected/catalog" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group bg-indigo-50/50 px-3 py-1.5 rounded-full transition-colors">
              Inventory <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <div className="grid gap-3">
            {stats.recentBooks.length > 0 ? (
              stats.recentBooks.map((book, idx) => (
                <BlurFade key={book.id} delay={0.4 + idx * 0.05}>
                  <Link href={`/protected/catalog/${book.id}`}>
                    <div className={cn(
                      "group flex items-center justify-between p-4 rounded-3xl border transition-all duration-300",
                      isNight 
                        ? "bg-indigo-50/20 border-indigo-100 hover:border-indigo-400 hover:bg-white" 
                        : "bg-white border-zinc-200/50 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-14 w-10 rounded-xl border flex items-center justify-center transition-all duration-500 group-hover:rotate-2 relative overflow-hidden",
                          isNight 
                            ? "bg-white border-indigo-100 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white" 
                            : "bg-zinc-50 border-zinc-100 text-zinc-400 group-hover:bg-indigo-600 group-hover:text-white"
                        )}>
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <p className={cn(
                            "font-bold transition-colors line-clamp-1",
                            isNight ? "text-zinc-900 group-hover:text-indigo-600" : "text-zinc-900 group-hover:text-indigo-600"
                          )}>{book.title}</p>
                          <p className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                            <span className={cn("w-1 h-1 rounded-full", "bg-zinc-300")} /> {book.author}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1 px-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Resource</span>
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-lg",
                          isNight ? "bg-indigo-50 text-indigo-700" : "bg-zinc-100 text-zinc-600"
                        )}>
                          {mounted ? new Date(book.created_at).toLocaleDateString() : '...'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </BlurFade>
              ))
            ) : (
              <div className="p-16 text-center rounded-[40px] bg-white border border-dashed border-zinc-200 shadow-inner">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BookOpen size={40} className="text-zinc-200" />
                </div>
                <p className="text-zinc-500 font-bold text-lg">Your library is waiting for its first item.</p>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-1">Start by adding a book or digital resource to the catalog.</p>
                <Button variant="outline" className="mt-8 rounded-2xl h-11 px-8 border-zinc-200 hover:border-indigo-600 hover:bg-indigo-50 font-bold" asChild>
                  <Link href="/protected/catalog/add">Add Resource</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
