"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UploadAction } from "./UploadAction";
import { AssetGrid } from "./AssetGrid";

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

export function DigitalResourcesClient({ resources, categories, isLibrarian, query }: DigitalResourcesClientProps) {
  return (
    <div className="w-full space-y-3 pb-6 md:pb-8">
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">Digital Assets</h1>
            <p className="text-[11px] text-muted-foreground">Browse and open resources.</p>
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <form action="/protected/resources" method="GET" className="relative w-full sm:w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search title"
                defaultValue={query}
                className="h-8 rounded-md pl-8 text-xs"
              />
            </form>
            {isLibrarian ? <UploadAction categories={categories} /> : null}
          </div>
        </div>
      </div>

      <AssetGrid resources={resources} />
    </div>
  );
}
