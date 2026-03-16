"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ModernAssetCard } from "./ModernAssetCard";
import { Search } from "lucide-react";

interface AssetGridProps {
  resources: any[] | null;
}

export function AssetGrid({ resources }: AssetGridProps) {
  if (!resources || resources.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-20 rounded-[3rem] border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center text-center w-full"
      >
        <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center text-zinc-300 dark:text-zinc-600 mb-6 border border-zinc-200 dark:border-zinc-700">
          <Search size={40} />
        </div>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">No assets found</h3>
        <p className="text-zinc-500 max-w-xs">Our vault seems to be empty for this search. Try different keywords or browse categories.</p>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <AnimatePresence mode="popLayout">
        {resources.map((resource, index) => (
          <ModernAssetCard key={resource.id} resource={resource} />
        ))}
      </AnimatePresence>
    </div>
  );
}
