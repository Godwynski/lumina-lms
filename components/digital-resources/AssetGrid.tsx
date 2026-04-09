"use client";

import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ModernAssetCard } from "./ModernAssetCard";
import { LibraryBig } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CompactPagination } from "@/components/ui/compact-pagination";

type AssetGridResource = {
  id: string;
  title: string;
  author: string;
  type: string;
  access_level: string;
  created_at: string;
  updated_at?: string | null;
  published_year?: number | null;
  categories?: { name?: string | null }[] | null;
};

interface AssetGridProps {
  resources: AssetGridResource[] | null;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
      mass: 1,
    }
  }
};

export function AssetGrid({ resources }: AssetGridProps) {
  const normalizedResources = resources ?? [];
  const pageSize = 9;
  const [page, setPage] = useState(1);
  const pageItems = normalizedResources.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [normalizedResources.length]);

  if (!resources || resources.length === 0) {
    return (
      <EmptyState
        icon={LibraryBig}
        title="No digital assets found"
        description="Try searching for a different keyword or upload new research papers."
      />
    );
  }

  return (
    <div className="space-y-6">
      <m.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      >
        <AnimatePresence mode="popLayout">
          {pageItems.map((resource) => (
            <m.div key={resource.id} variants={item} layout>
              <ModernAssetCard resource={resource} />
            </m.div>
          ))}
        </AnimatePresence>
      </m.div>

      <div className="flex justify-center border-t border-border/40 pt-10">
        <CompactPagination
          page={page}
          totalItems={normalizedResources.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
