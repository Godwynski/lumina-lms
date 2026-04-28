"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompactPagination } from "@/components/ui/compact-pagination";
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
  const sortBy = (searchParams.get("sort") as "title_asc" | "title_desc" | "availability_desc" | "availability_asc") || "title_asc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const categoryId = searchParams.get("categoryId") || "all";

  const pageSize = 12;

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


  return (
    <div className="w-full space-y-4 pb-10">
      <div className="sticky top-16 z-20 space-y-2 rounded-2xl border border-border/10 bg-background/50 p-1.5 shadow-sm backdrop-blur-2xl transition-all duration-300 md:p-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <Link href="/catalog/add" className="shrink-0">
              <Button size="sm" className="h-8 rounded-xl px-3 text-[10px] font-bold uppercase tracking-widest shadow-none md:text-[11px] md:px-4">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Item</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </Link>
            <div className="mx-1 h-4 w-[1px] bg-border/20 hidden sm:block" />
          </div>

          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-7 w-[100px] rounded-xl border-border/20 bg-muted/5 px-2 text-[10px] font-bold shadow-none focus:ring-0 md:h-8 md:w-[130px] md:px-3 md:text-[11px]">
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

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1 pb-0.5">
          <Button
            type="button"
            variant={categoryId === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryId("all")}
            className={cn(
              "h-7 whitespace-nowrap rounded-lg px-3 text-[10px] font-bold transition-all md:h-8 md:text-[11px]",
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
                "h-7 whitespace-nowrap rounded-lg px-3 text-[10px] font-bold transition-all md:h-8 md:text-[11px]",
                categoryId === cat.id ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      <div className={cn("transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
        <InventoryGrid books={books} />
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
