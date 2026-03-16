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
  History as HistoryIcon
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

  const greeting = () => {
    if (!mounted) return 'Welcome';
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

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
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      description: 'Physical & Digital items'
    },
    { 
      title: 'Active Loans', 
      value: stats.activeLoans.toString(), 
      icon: Clock, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50',
      description: 'Items currently out'
    },
    { 
      title: 'Active Users', 
      value: stats.totalUsers.toString(), 
      icon: Users, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      description: 'Students & Staff'
    },
    { 
      title: 'System Health', 
      value: '99.9%', 
      icon: TrendingUp, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50',
      description: 'All services operational'
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
      {/* Header Section with subtle animated background */}
      <section className="relative overflow-hidden p-8 md:p-12 rounded-[40px] bg-white border border-zinc-200/60 shadow-sm group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full group-hover:bg-indigo-500/10 transition-colors duration-700" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full group-hover:bg-purple-500/10 transition-colors duration-700" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <BlurFade delay={0.1}>
              <div className="inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                Lumina Intelligence
              </div>
            </BlurFade>
            <BlurFade delay={0.2}>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 !leading-[1.1]">
                {greeting()}, <br className="sm:hidden" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
              </h1>
              <p className="text-zinc-500 max-w-lg mt-3 text-lg">
                Your library is active and performing well. Here's your synchronized overview.
              </p>
            </BlurFade>
          </div>
          
          <BlurFade delay={0.3}>
            <div className="flex items-center gap-4 bg-zinc-50 p-2 pr-6 rounded-3xl border border-zinc-200/50 shadow-inner">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200/50 ring-4 ring-white">
                <span className="text-2xl font-black italic">{(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}</span>
              </div>
              <div className="flex flex-col">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Authenticated as</p>
                <p className="text-sm font-bold text-zinc-900 truncate max-w-[150px]">{user.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">{role} Access</span>
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
              className="group flex flex-col p-6 gap-6 border-zinc-200/60 bg-white hover:border-indigo-300 transition-colors"
              gradientColor="rgba(99, 102, 241, 0.08)"
            >
              <div className="flex justify-between items-start">
                <div className={`p-4 rounded-2xl ${card.bg} ${card.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon size={22} />
                </div>
                <div className="text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 border border-emerald-100 uppercase tracking-tighter">
                  <TrendingUp size={10} strokeWidth={3} /> Stable
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.1em]">{card.title}</p>
                <h3 className="text-3xl font-black text-zinc-900 mt-1 tracking-tight">{card.value}</h3>
                <p className="text-xs text-zinc-400 mt-2 font-medium">{card.description}</p>
              </div>
            </MagicCard>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content: Recent Books */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
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
                    <div className="group flex items-center justify-between p-4 rounded-3xl bg-white border border-zinc-200/50 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:rotate-2">
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{book.title}</p>
                          <p className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-zinc-300" /> {book.author}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1 px-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Archived</span>
                        <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-lg">
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

        {/* Sidebar: Quick Actions */}
        <div className="lg:col-span-4 space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-zinc-900 px-2">Shortcuts</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, idx) => (
                <BlurFade key={action.title} delay={0.5 + idx * 0.05}>
                  <Link href={action.href}>
                    <div className="flex flex-col items-center justify-center gap-4 p-6 rounded-[32px] bg-white border border-zinc-200/50 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 text-center h-full group/btn">
                      <div className={cn(
                        "p-3.5 rounded-2xl transition-all duration-500 group-hover/btn:scale-110",
                        idx === 0 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-zinc-50 text-zinc-600 group-hover/btn:bg-indigo-50 group-hover/btn:text-indigo-600"
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

          <BlurFade delay={0.8}>
            <div className="p-8 rounded-[40px] bg-zinc-900 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-700">
                <TrendingUp size={160} />
              </div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Live Insights</span>
                </div>
                <h3 className="font-black text-2xl leading-tight">Growth <br />Metrics</h3>
                <p className="text-xs text-zinc-400 mt-3 font-medium leading-relaxed">
                  Utilization is up 24% this month across digital resources.
                </p>
                <Button size="sm" variant="outline" className="mt-8 border-zinc-800 bg-zinc-800/50 hover:bg-zinc-700 text-white rounded-2xl h-11 font-bold transition-all group-hover:translate-x-1" asChild>
                  <Link href="/protected/reports">View Detailed Analysis</Link>
                </Button>
              </div>
            </div>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
