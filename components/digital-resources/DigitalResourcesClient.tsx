"use client";

import { motion } from "framer-motion";
import { AssetGrid } from "./AssetGrid";
import { 
  Zap, 
  Library, 
  Database, 
  Users,
  Search,
  BookOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { UploadAction } from "./UploadAction";
import Image from "next/image";

type Category = { id: string; name: string };

type ResourceItem = {
  id: string;
  title: string;
  author: string;
  type: string;
  access_level: string;
  created_at: string;
  published_year?: number | null;
  categories?: { name?: string | null } | null;
};

interface DigitalResourcesClientProps {
  resources: ResourceItem[] | null;
  categories: Category[];
  isLibrarian: boolean;
  query?: string;
}

export function DigitalResourcesClient({ 
  resources, 
  categories, 
  isLibrarian,
  query 
}: DigitalResourcesClientProps) {
  return (
    <div className="flex flex-col gap-12 pb-24">
      
      {/* Immersive Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-[400px] rounded-[3rem] overflow-hidden group shadow-2xl shadow-indigo-500/10"
      >
        <Image 
          src="/images/hero.png" 
          alt="Digital Vault" 
          fill 
          className="object-cover group-hover:scale-105 transition-transform duration-[20s] ease-linear"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-6 bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 w-fit px-4 py-2 rounded-2xl">
              <Zap size={18} className="text-indigo-400 animate-pulse" />
              <span className="text-xs font-black text-indigo-100 uppercase tracking-[0.2em]">Next-Gen Digital Vault</span>
            </div>
            <h1 className="text-6xl font-black text-white tracking-tight mb-4">
              Explore the <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Digital Archive</span>
            </h1>
            <p className="text-zinc-300 max-w-xl text-lg leading-relaxed mb-8">
              Access the school&apos;s high-performance repository of curated academic assets, zero-latency research materials, and historical archives.
            </p>
          </motion.div>
        </div>

        {/* Floating Upload Action */}
        {isLibrarian && (
          <div className="absolute top-8 right-8">
            <UploadAction categories={categories} />
          </div>
        )}
      </motion.div>

      {/* Stats Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          { label: "Total Assets", val: resources?.length || 0, icon: Library, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "Active Repo", val: "Libris-01", icon: Database, color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Node Load", val: "Low", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Access Control", val: "Fortified", icon: Users, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((item, i) => (
          <div key={i} className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-zinc-200/50 dark:border-zinc-800/50 flex items-center gap-4 group hover:bg-white dark:hover:bg-zinc-900 transition-all duration-300">
            <div className={`h-12 w-12 rounded-2xl ${item.bg} flex items-center justify-center ${item.color} group-hover:rotate-12 transition-transform`}>
              <item.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">{item.label}</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-white">{item.val}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Area */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
              <BookOpen className="text-indigo-600" />
              Content Library
            </h2>
            
            <div className="relative md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <form action="/protected/resources" method="GET">
                <Input 
                  name="q"
                  placeholder="Search vault..." 
                  defaultValue={query}
                  className="pl-12 h-12 bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all rounded-2xl text-base"
                />
              </form>
            </div>
          </div>

          <AssetGrid resources={resources} />
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                <Database size={28} />
              </div>
              <h4 className="text-2xl font-bold mb-4 tracking-tight">Intranet Infrastructure</h4>
              <p className="text-indigo-100/80 text-sm leading-relaxed mb-8 font-medium">
                You are currently connected to the primary campus node. Assets are synchronized across all local servers for redundant offline availability.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-white/10">
                  <span className="text-xs font-bold text-indigo-200">Latency</span>
                  <span className="text-xs font-black">&lt; 1ms</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-white/10">
                  <span className="text-xs font-bold text-indigo-200">Protocol</span>
                  <span className="text-xs font-black">L-NFS v3</span>
                </div>
              </div>
            </div>
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-[10s]" />
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200/60 dark:border-zinc-800/60">
            <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">Recent Nodes</h4>
            <div className="space-y-6">
              {[
                { name: "Main Library-A1", status: "Active", load: "12%" },
                { name: "Science Wing-C4", status: "Active", load: "5%" },
                { name: "Admin Block", status: "Standby", load: "0%" },
              ].map((node, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${node.status === "Active" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-300"}`} />
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">{node.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-zinc-400 font-mono">{node.load}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
