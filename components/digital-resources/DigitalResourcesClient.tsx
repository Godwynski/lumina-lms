"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UploadAction } from "./UploadAction";
import { AssetGrid } from "./AssetGrid";
import { Badge } from "@/components/ui/badge";

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
  categories?: { name?: string | null }[] | null;
};

interface DigitalResourcesClientProps {
  resources: ResourceItem[] | null;
  categories: Category[];
  isLibrarian: boolean;
  query?: string;
}

export function DigitalResourcesClient({ resources, categories, isLibrarian, query }: DigitalResourcesClientProps) {
  const normalizedResources = resources ?? [];

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Premium Header Layout */}
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-foreground sm:text-4xl">
                Repository
              </h1>
              <Badge variant="outline" className="h-6 rounded-md bg-muted px-2 py-0 font-bold uppercase tracking-widest text-muted-foreground/60 border-none">
                Vault
              </Badge>
            </div>
            <p className="max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
              Official institutional archive for Capstones, Theses, and curated academic research.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLibrarian && (
              <UploadAction 
                categories={categories} 
                className="h-10 rounded-xl px-5 font-bold shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 active:scale-95"
              />
            )}
          </div>
        </div>

        {/* Floating Search Bar with Glassmorphism */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/50 p-1.5 shadow-sm backdrop-blur-xl dark:bg-card/30">
          <form action="/protected/resources" method="GET" className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              name="q"
              placeholder="Filter by title (e.g. Artificial Intelligence)..."
              defaultValue={query}
              className="h-11 border-none bg-transparent pl-11 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </form>

          <div className="hidden h-8 w-[1px] bg-border/40 sm:block" />
          
          <div className="mr-3 px-3 py-1.5">
            <span className="text-xs font-bold tabular-nums tracking-tight text-muted-foreground">
              {normalizedResources.length} results
            </span>
          </div>
        </div>
      </div>

      {/* Grid Container with better vertical padding */}
      <div className="min-h-[400px]">
        <AssetGrid resources={resources} />
      </div>
    </div>
  );
}
