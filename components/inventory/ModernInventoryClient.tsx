"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { ModernBookListItem } from "./ModernBookListItem";
import { InventoryGrid } from "./InventoryGrid";
import { Book, Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ModernInventoryClientProps {
  books: Book[];
  totalItems: number;
  categories: Category[];
}

export function ModernInventoryClient({ books, totalItems, categories }: ModernInventoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Derived values from URL
  const viewMode = (searchParams.get("view") as "list" | "grid") || "grid";
  const sortBy = (searchParams.get("sort") as "title_asc" | "title_desc" | "availability_desc" | "availability_asc") || "title_asc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const categoryId = searchParams.get("categoryId") || "all";

  const pageSize = viewMode === "list" ? 10 : 9;

  // Centralized navigation helper
  const updateParams = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "all" || (key === "page" && value === 1)) {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });

    // Reset page on filter change unless explicitly setting page
    if (!updates.page) {
      params.delete("page");
    }

    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  const setCategoryId = (id: string) => updateParams({ categoryId: id });
  const setSortBy = (sort: typeof sortBy) => updateParams({ sort });
  const setViewMode = (view: typeof viewMode) => updateParams({ view });
  const setPage = (p: number) => updateParams({ page: p });


  return (
    <div className="w-full space-y-4 pb-10">
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-background/50 p-2 shadow-sm backdrop-blur-2xl transition-all duration-300">
        <div className="flex items-center gap-1.5 px-1">
          <Link href="/catalog/add" className="shrink-0">
            <Button size="sm" className="h-8 rounded-lg px-3 text-[11px] font-bold uppercase tracking-tight shadow-none">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Item
            </Button>
          </Link>
          <div className="mx-1.5 h-4 w-[1px] bg-border/40" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          <Button
            type="button"
            variant={categoryId === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryId("all")}
            className={cn(
              "h-8 whitespace-nowrap rounded-lg px-3 text-[11px] font-bold transition-all",
              categoryId === "all" ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={categoryId === cat.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCategoryId(cat.id)}
              className={cn(
                "h-8 whitespace-nowrap rounded-lg px-3 text-[11px] font-bold transition-all",
                categoryId === cat.id ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 pr-1">
          <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setViewMode("list")}
              className={cn(
                "h-6 rounded-md px-2.5 text-[10px] font-bold transition-all",
                viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setViewMode("grid")}
              className={cn(
                "h-6 rounded-md px-2.5 text-[10px] font-bold transition-all",
                viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Grid
            </Button>
          </div>
          
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger className="h-8 w-[130px] rounded-lg border-border/40 bg-muted/10 px-3 text-[11px] font-bold shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title_asc">Title A-Z</SelectItem>
              <SelectItem value="title_desc">Title Z-A</SelectItem>
              <SelectItem value="availability_desc">Availability</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={cn("transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
        {viewMode === "list" ? (
          <div className="overflow-x-auto pb-4 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-thin">
            <div className="space-y-2 min-w-[700px] pr-2">
              {books.map((book) => (
                <ModernBookListItem key={book.id} book={book} />
              ))}
              {books.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-16 text-center shadow-none backdrop-blur-sm">
                  <div className="mb-4 rounded-full bg-slate-100 p-4 font-medium text-slate-400 ring-1 ring-slate-200/50">
                    <Search className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">No books found</h3>
                  <p className="mt-1 max-w-[280px] text-sm text-slate-500">
                    We couldn&apos;t find any books matching your current search or filters. Try adjusting them.
                  </p>
                  <div className="mt-6 flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full px-5 text-xs font-semibold"
                      onClick={() => {
                        updateParams({ q: null, stock: "all", categoryId: "all" });
                      }}
                    >
                      Clear Search
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <InventoryGrid books={books} />
        )}
      </div>

      {totalItems > 0 && (
        <CompactPagination
          page={page}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
