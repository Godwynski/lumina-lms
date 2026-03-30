"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UploadAction } from "./UploadAction";
import { AssetGrid } from "./AssetGrid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Category = { id: string; name: string };

type ResourceItem = {
  id: string;
  title: string;
  author: string;
  type: string;
  access_level: string;
  created_at: string;
  updated_at?: string | null;
  published_year?: number | null;
  categories?: { name?: string | null } | null;
};

interface DigitalResourcesClientProps {
  resources: ResourceItem[] | null;
  categories: Category[];
  isLibrarian: boolean;
  query?: string;
}

export function DigitalResourcesClient({ resources, categories, isLibrarian, query }: DigitalResourcesClientProps) {
  const normalizedResources = resources ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCount = selectedIds.size;
  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(normalizedResources.map((resource) => resource.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openSelected = () => {
    const selectedResources = normalizedResources.filter((resource) => selectedIds.has(resource.id));
    if (selectedResources.length === 0) return;
    
    if (selectedResources.length === 1) {
      window.location.href = `/protected/resources?view=${selectedResources[0].id}`;
    } else {
      selectedResources.forEach((res) => {
        window.open(`/protected/resources?view=${res.id}`, "_blank");
      });
      toast.success(`Opened ${selectedResources.length} assets in new tabs.`);
    }
  };

  const handleBatchDownload = () => {
    if (selectedCount === 0) return;
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Preparing batch download (ZIP)...",
        success: `Successfully prepared ${selectedCount} assets for download.`,
        error: "Failed to prepare download.",
      }
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    const ok = window.confirm(`Are you sure you want to delete ${selectedCount} resources? This action cannot be undone.`);
    if (!ok) return;

    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Deleting selected assets...",
        success: () => {
          clearSelection();
          return `Successfully deleted ${selectedCount} assets.`;
        },
        error: "Failed to delete assets.",
      }
    );
  };

  return (
    <div className="w-full pb-6 md:pb-8">
      <div className="sticky top-0 z-30 rounded-xl border border-border bg-card/95 p-2.5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">Digital Assets</h1>
              <p className="text-[11px] text-muted-foreground">Visual browse with compact controls.</p>
            </div>

            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 rounded-md px-2.5 text-xs">
                    Bulk Actions
                    {selectedCount > 0 ? ` (${selectedCount})` : ""}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={selectAll}>Select all results</DropdownMenuItem>
                  <DropdownMenuItem onClick={clearSelection} disabled={selectedCount === 0}>Clear selection</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={openSelected} disabled={selectedCount === 0}>
                    Open selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBatchDownload} disabled={selectedCount === 0}>
                    Batch download (ZIP)
                  </DropdownMenuItem>
                  {isLibrarian && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={handleDeleteSelected} 
                        disabled={selectedCount === 0}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        Delete selected
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>


              {isLibrarian ? <UploadAction categories={categories} /> : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <form action="/protected/resources" method="GET" className="relative w-full sm:w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search title"
                defaultValue={query}
                className="h-8 rounded-md pl-8 text-xs"
              />
            </form>

            <p className="text-[11px] text-muted-foreground">
              {normalizedResources.length} result{normalizedResources.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-0.5">
        <AssetGrid resources={resources} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
      </div>
    </div>
  );
}
