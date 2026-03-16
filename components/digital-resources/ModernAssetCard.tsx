"use client";

import { motion } from "framer-motion";
import { 
  FileText, 
  User, 
  Calendar, 
  Shield, 
  Eye, 
  Download, 
  ExternalLink,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AssetCardProps {
  resource: any;
}

export function ModernAssetCard({ resource }: AssetCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      {/* Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-700" />
      
      <div className="relative bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl p-6 rounded-[2.2rem] border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl shadow-zinc-200/20 flex flex-col h-full overflow-hidden">
        
        {/* Card Header & Type Badge */}
        <div className="flex items-start justify-between mb-8">
          <div className="relative">
            <div className="h-16 w-16 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
              <FileText size={32} className="text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            {/* Animated Dot for "Active" or "New" status could go here */}
            {new Date(resource.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-white"></span>
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-full uppercase tracking-[0.15em] border border-indigo-200/30">
              {resource.type}
            </span>
            {resource.categories?.name && (
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter bg-zinc-100/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">
                {resource.categories.name}
              </span>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1">
          <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-[1.2] mb-3">
            {resource.title}
          </h3>
          
          <div className="flex items-center gap-2 mb-6 opacity-70 group-hover:opacity-100 transition-opacity">
            <div className="h-7 w-7 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
              <User size={14} className="text-indigo-500" />
            </div>
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{resource.author}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-zinc-50/50 dark:bg-zinc-800/30 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Calendar size={12} />
                <span className="text-[9px] font-black uppercase tracking-widest">Released</span>
              </div>
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {resource.published_year || new Date(resource.created_at).getFullYear()}
              </p>
            </div>
            <div className="bg-zinc-50/50 dark:bg-zinc-800/30 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
              <div className="flex items-center gap-2 text-emerald-500/70 mb-1">
                <Shield size={12} />
                <span className="text-[9px] font-black uppercase tracking-widest">Security</span>
              </div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{resource.access_level}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-6 border-t border-zinc-100/80 dark:border-zinc-800/80">
          <Link href={`/protected/resources?view=${resource.id}`} className="flex-1">
            <Button className="w-full h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-indigo-600 dark:hover:bg-indigo-400 transition-all font-bold shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 flex items-center gap-2">
              <Eye size={18} />
              Open Asset
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-zinc-400 hover:text-indigo-600">
             <Download size={18} />
          </Button>
        </div>

        {/* Decorative subtle pattern */}
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-tl from-indigo-500/5 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
      </div>
    </motion.div>
  );
}
