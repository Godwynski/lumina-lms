"use client";

import Link from "next/link";
import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X, Loader2, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { InventoryGrid } from "./InventoryGrid";
import { Book, Category, Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ModernInventoryClientProps {
  books: Book[];
  totalItems: number;
  categories: Category[];
  canManage?: boolean;
  isStudentView?: boolean;
  reservations?: Reservation[];
}

export function ModernInventoryClient({ 
  books, 
  totalItems, 
  categories, 
  canManage = true,
  isStudentView = false,
  reservations = []
}: ModernInventoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Derived values from URL
  const sortBy = (searchParams.get("sort") as "newest" | "title_asc" | "title_desc" | "availability_desc" | "availability_asc") || "newest";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const categoryId = searchParams.get("categoryId") || "all";
  const urlQuery = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const pageSize = 12;

  // Sync with URL query
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

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
  const setPage = (p: number) => updateParams({ page: p });
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    updateParams({ q: searchQuery || null });
  };
  const clearSearch = () => {
    setSearchQuery("");
    updateParams({ q: null });
  };


  return (
    <div className="w-full space-y-4 pb-10">

      <div className="sticky top-0 z-30 flex flex-col gap-3 rounded-[2rem] border border-border/10 bg-background/60 p-2.5 shadow-sm backdrop-blur-2xl transition-all duration-300 md:p-3">
        {/* Top Controls Row */}
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          {/* Search Box */}
          <form onSubmit={handleSearch} className="relative flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className={cn(
                "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                searchQuery ? "text-primary" : "text-muted-foreground/40"
              )} />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-2xl border border-border/10 bg-muted/10 pl-10 pr-10 text-sm font-medium transition-all focus:border-primary/30 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/5"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button 
              type="submit" 
              size="sm" 
              variant="secondary"
              className="h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-widest shadow-none border border-border/10 hover:bg-muted/30"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
            </Button>
          </form>

          <div className="flex items-center gap-2 shrink-0">
            {/* Sort Select */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-10 w-full min-w-[140px] rounded-2xl border border-border/10 bg-muted/10 px-4 text-xs font-bold shadow-none focus:ring-0 md:w-[160px]">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/10 shadow-2xl">
                <SelectItem value="newest">Recently Added</SelectItem>
                <SelectItem value="title_asc">Title A-Z</SelectItem>
                <SelectItem value="title_desc">Title Z-A</SelectItem>
                <SelectItem value="availability_desc">By Availability</SelectItem>
              </SelectContent>
            </Select>

            {/* Add Item Button */}
            {canManage && (
              <>
                <div className="h-6 w-px bg-border/20 mx-1 hidden sm:block" />
                <Link href="/catalog/add" className="shrink-0">
                  <Button className="h-10 rounded-2xl px-5 text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add Item</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1 pb-1 border-t border-border/5 pt-2">
          <Button
            type="button"
            variant={categoryId === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryId("all")}
            className={cn(
              "h-8 whitespace-nowrap rounded-xl px-4 text-[10px] font-black uppercase tracking-widest transition-all md:text-[11px]",
              categoryId === "all" 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "text-muted-foreground/60 border border-transparent hover:bg-muted/20 hover:text-foreground"
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
                "h-8 whitespace-nowrap rounded-xl px-4 text-[10px] font-black uppercase tracking-widest transition-all md:text-[11px]",
                categoryId === cat.id 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground/60 border border-transparent hover:bg-muted/20 hover:text-foreground"
              )}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>
      <div className={cn("transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
        <InventoryGrid 
          books={books} 
          canManage={canManage} 
          isStudentView={isStudentView}
          reservations={reservations}
        />
      </div>

      {totalItems > 0 && (
        <CompactPagination
          page={page}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          variant="default"
        />
      )}
    </div>
  );
}
