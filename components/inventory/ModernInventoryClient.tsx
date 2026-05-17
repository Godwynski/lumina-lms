"use client";

import Link from "next/link";
import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { InventoryGrid } from "./InventoryGrid";
import { Book, Category, Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
  const status = (searchParams.get("status")?.toUpperCase() as "ACTIVE" | "ARCHIVED" | "ALL") || "ACTIVE";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const categoryId = searchParams.get("categoryId") || "all";
  const urlQuery = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const pageSize = 12;

  // Sync with URL query
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  // Realtime subscription to refresh data
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('inventory-realtime')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'books' }, 
        () => {
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'book_copies' },
        () => {
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          router.refresh();
        }
      )
      .subscribe();


    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  // Centralized navigation helper
  const updateParams = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "all" || (key === "page" && value === 1) || (key === "status" && value === "ACTIVE")) {
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
  const setStatus = (s: typeof status) => updateParams({ status: s });
  const setPage = (p: number) => updateParams({ page: p });
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    updateParams({ q: searchQuery || null });
  };
  const clearSearch = () => {
    setSearchQuery("");
    updateParams({ q: null });
  };


  const activeFilterCount = (status !== "ACTIVE" ? 1 : 0) + (categoryId !== "all" ? 1 : 0) + (sortBy !== "newest" ? 1 : 0);

  return (
    <div className="w-full space-y-6 pb-10">
      <div className="sticky top-0 z-30 flex flex-col gap-4 rounded-3xl border border-border/10 bg-background/60 p-2.5 backdrop-blur-2xl transition-all duration-300">
        <div className="flex items-center gap-3 w-full">
          {/* Search Box */}
          <form onSubmit={handleSearch} className="relative flex flex-1 items-center gap-2">
            <div className="relative flex-1 group">
              <Search className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-all duration-300",
                searchQuery ? "text-primary scale-110" : "text-muted-foreground/30"
              )} />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-2xl border border-border/20 bg-muted/5 pl-11 pr-11 text-sm font-medium transition-all focus:border-primary/30 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/5 placeholder:text-muted-foreground/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground/30 hover:bg-muted hover:text-foreground transition-all active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>

          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                className="h-11 rounded-2xl px-4 gap-2 border-border/20 bg-muted/5 hover:bg-background transition-all active:scale-95 relative"
              >
                <SlidersHorizontal className="h-4 w-4 text-primary/80" />
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full text-[10px] bg-primary text-primary-foreground border-2 border-background">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md rounded-l-3xl border-l-border/10 bg-background p-0 overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-4 z-10">
                <SheetClose className="rounded-full h-8 w-8 flex items-center justify-center bg-muted/20 text-muted-foreground hover:bg-muted transition-colors">
                   <X className="h-4 w-4" />
                </SheetClose>
              </div>

              <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-1">
                  <SheetTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    Filters
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground font-medium">Refine your search results</SheetDescription>
                </div>

                <Separator className="bg-border/10" />

                <div className="space-y-6">
                  {/* Status Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Availability Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["ACTIVE", "ARCHIVED", "ALL"] as const).map((s) => (
                        <Button
                          key={s}
                          variant={status === s ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStatus(s)}
                          className={cn(
                            "h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            status === s ? "bg-primary text-primary-foreground" : "bg-muted/5 border-border/10 hover:bg-muted/10"
                          )}
                        >
                          {s === "ACTIVE" ? "Visible" : s === "ARCHIVED" ? "Archived" : "All"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Sort Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Sorting Order</label>
                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                      <SelectTrigger className="h-10 w-full rounded-lg border border-border/10 bg-muted/5 px-3 text-[11px] font-medium shadow-none focus:ring-0">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-border/10">
                        <SelectItem value="newest" className="text-[11px]">Recently Added</SelectItem>
                        <SelectItem value="title_asc" className="text-[11px]">Title A-Z</SelectItem>
                        <SelectItem value="title_desc" className="text-[11px]">Title Z-A</SelectItem>
                        <SelectItem value="availability_desc" className="text-[11px]">By Availability</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Categories Selection */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Categories</label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={categoryId === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryId("all")}
                        className={cn(
                          "h-9 rounded-lg px-4 text-[10px] font-bold uppercase tracking-wider transition-all",
                          categoryId === "all" ? "bg-primary text-primary-foreground" : "bg-muted/5 border-border/10"
                        )}
                      >
                        All Items
                      </Button>
                      {categories.map((cat) => (
                        <Button
                          key={cat.id}
                          variant={categoryId === cat.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCategoryId(cat.id)}
                          className={cn(
                            "h-10 rounded-xl px-5 text-[10px] font-bold uppercase tracking-widest transition-all",
                            categoryId === cat.id ? "bg-primary shadow-lg shadow-primary/20" : "bg-muted/5 border-border/10"
                          )}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-muted/5 border-t border-border/10 flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest border-border/10"
                  onClick={() => {
                    setCategoryId("all");
                    setStatus("ACTIVE");
                    setSortBy("newest");
                  }}
                >
                  Reset All
                </Button>
                <SheetClose asChild>
                  <Button className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                    Apply Filters
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          {/* Add Item Button */}
          {canManage && (
            <Link href="/inventory/add" className="shrink-0">
              <Button className="h-12 rounded-[1.5rem] px-5 text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 group">
                <Plus className="sm:mr-2 h-5 w-5 transition-transform group-hover:rotate-90" />
                <span className="hidden sm:inline">Add Item</span>
              </Button>
            </Link>
          )}
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
