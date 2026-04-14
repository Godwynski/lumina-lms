"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { ModernBookListItem } from "./ModernBookListItem";
import { InventoryGrid } from "./InventoryGrid";
import { Book, Category } from "@/lib/types";

interface ModernInventoryClientProps {
  books: Book[];
  totalItems: number;
  categories: Category[];
}

export function ModernInventoryClient({ books, totalItems, categories }: ModernInventoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [viewMode, setViewMode] = useState<"list" | "grid">((searchParams.get("view") as "list" | "grid" | null) || "grid");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out" | "low">((searchParams.get("stock") as "all" | "in" | "out" | "low" | null) || "all");
  const [sortBy, setSortBy] = useState<"title_asc" | "title_desc" | "availability_desc" | "availability_asc">((searchParams.get("sort") as "title_asc" | "title_desc" | "availability_desc" | "availability_asc" | null) || "title_asc");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") || "all");

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (viewMode !== "grid") params.set("view", viewMode);
    if (stockFilter !== "all") params.set("stock", stockFilter);
    if (categoryId !== "all") params.set("categoryId", categoryId);
    if (sortBy !== "title_asc") params.set("sort", sortBy);
    if (page !== 1) params.set("page", page.toString());
    
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }, [search, viewMode, stockFilter, sortBy, page, router, categoryId]);

  const pageSize = viewMode === "list" ? 10 : 9;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, stockFilter, sortBy, viewMode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const quickFilters = useMemo(
    () => [
      { key: "all" as const, label: "All", count: totalItems },
    ],
    [totalItems],
  );

  return (
    <div className="w-full space-y-3 pb-5 md:pb-7">
      <div className="sticky top-2 z-20 rounded-xl border border-border bg-card/90 p-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="hidden md:block">
            <h1 className="text-base font-semibold tracking-tight text-foreground">Book Catalog</h1>
            <p className="text-[11px] text-muted-foreground">Search, filter, and maintain inventory records.</p>
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title, author, ISBN"
                aria-label="Search the catalog"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-md pl-8 text-xs"
              />
            </div>
            <Link href="/catalog/add">
              <Button className="h-8 rounded-md px-2.5 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Book
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm">
        {quickFilters.map((filter) => (
          <Button
            key={filter.key}
            type="button"
            variant={stockFilter === filter.key ? "default" : "outline"}
            size="sm"
            onClick={() => setStockFilter(filter.key)}
            className="h-7 rounded-full px-2.5 text-[10px]"
          >
            {filter.label} ({filter.count})
          </Button>
        ))}

        <div className="mx-1 h-4 w-[1px] bg-border/50" />

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[400px]">
          <Button
            type="button"
            variant={categoryId === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryId("all")}
            className="h-7 whitespace-nowrap rounded-md px-2.5 text-[10px]"
          >
            All Categories
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={categoryId === cat.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCategoryId(cat.id)}
              className="h-7 whitespace-nowrap rounded-md px-2.5 text-[10px]"
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
            className="h-7 rounded-md px-2.5 text-[10px]"
          >
            List
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
            className="h-7 rounded-md px-2.5 text-[10px]"
          >
            Grid
          </Button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-7 rounded-md border-border bg-card px-2 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title_asc">Title A-Z</SelectItem>
                <SelectItem value="title_desc">Title Z-A</SelectItem>
                <SelectItem value="availability_desc">Most Available</SelectItem>
                <SelectItem value="availability_asc">Least Available</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="overflow-x-auto pb-4 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-thin">
          <div className="space-y-2 min-w-[700px] pr-2">
            {books.map((book) => (
              <ModernBookListItem key={book.id} book={book} />
            ))}
            {books.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-4 py-16 text-center shadow-sm backdrop-blur-sm">
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
                      setSearch("");
                      setStockFilter("all");
                      setCategoryId("all");
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
