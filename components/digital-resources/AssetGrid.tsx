"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ModernAssetCard } from "./ModernAssetCard";
import { Search } from "lucide-react";
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
  categories?: {
    name?: string | null;
  } | null;
};

interface AssetGridProps {
  resources: AssetGridResource[] | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
}

export function AssetGrid({ resources, selectedIds, onToggleSelect }: AssetGridProps) {
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
        icon={Search}
        title="No assets found"
        description="No digital assets match your current filters. Try another keyword."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {pageItems.map((resource) => (
            <ModernAssetCard
              key={resource.id}
              resource={resource}
              selected={selectedIds.has(resource.id)}
              onSelectChange={(checked) => onToggleSelect(resource.id, checked)}
            />
          ))}
        </AnimatePresence>
      </div>

      <CompactPagination
        page={page}
        totalItems={normalizedResources.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}
