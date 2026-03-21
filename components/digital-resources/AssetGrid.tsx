"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ModernAssetCard } from "./ModernAssetCard";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AssetGridResource = {
  id: string;
  title: string;
  author: string;
  type: string;
  access_level: string;
  created_at: string;
  published_year?: number | null;
  categories?: {
    name?: string | null;
  } | null;
};

interface AssetGridProps {
  resources: AssetGridResource[] | null;
}

export function AssetGrid({ resources }: AssetGridProps) {
  const normalizedResources = resources ?? [];
  const [pageSize, setPageSize] = useState(9);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(normalizedResources.length / pageSize));
  const pageItems = normalizedResources.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [normalizedResources.length, pageSize]);

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
            <ModernAssetCard key={resource.id} resource={resource} />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span>
          Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, normalizedResources.length)} of {normalizedResources.length}
        </span>
        <div className="flex items-center gap-1.5">
          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="h-7 w-[72px] rounded-md border-border bg-card px-2 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">9 / page</SelectItem>
              <SelectItem value="18">18 / page</SelectItem>
              <SelectItem value="27">27 / page</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-md px-2 text-[11px]"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </Button>
          <span className="min-w-12 text-center text-[11px] font-medium text-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-md px-2 text-[11px]"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
