"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { ModernBookListItem } from "./ModernBookListItem";
import { InventoryGrid } from "./InventoryGrid";
import { EditBookMetadataDialog } from "./EditBookMetadataDialog";
import { Book } from "@/lib/types";

interface ModernInventoryClientProps {
  books: Book[];
  onDelete: (book: Book) => void;
}

export function ModernInventoryClient({ books, onDelete }: ModernInventoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [viewMode, setViewMode] = useState<"list" | "grid">((searchParams.get("view") as "list" | "grid" | null) || "grid");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out" | "low">((searchParams.get("stock") as "all" | "in" | "out" | "low" | null) || "all");
  const [sortBy, setSortBy] = useState<"title_asc" | "title_desc" | "availability_desc" | "availability_asc">((searchParams.get("sort") as "title_asc" | "title_desc" | "availability_desc" | "availability_asc" | null) || "title_asc");
  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (viewMode !== "grid") params.set("view", viewMode);
    if (stockFilter !== "all") params.set("stock", stockFilter);
    if (sortBy !== "title_asc") params.set("sort", sortBy);
    if (page !== 1) params.set("page", page.toString());
    
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }, [search, viewMode, stockFilter, sortBy, page, router]);

  const handleEditClick = (book: Book) => {
    setBookToEdit(book);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    toast.success("Inventory record updated successfully");
    setIsEditDialogOpen(false);
    startTransition(() => {
      router.refresh();
    });
  };

  const filteredBooks = useMemo(() => {
    const searched = books.filter((b) =>
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.isbn?.toLowerCase().includes(search.toLowerCase()),
    );

    const stockFiltered = searched.filter((b) => {
      if (stockFilter === "in") return b.available_copies > 0;
      if (stockFilter === "out") return b.available_copies === 0;
      if (stockFilter === "low") return b.available_copies > 0 && b.available_copies <= 2;
      return true;
    });

    return [...stockFiltered].sort((a, b) => {
      if (sortBy === "title_desc") return b.title.localeCompare(a.title);
      if (sortBy === "availability_desc") return b.available_copies - a.available_copies;
      if (sortBy === "availability_asc") return a.available_copies - b.available_copies;
      return a.title.localeCompare(b.title);
    });
  }, [books, search, sortBy, stockFilter]);

  const quickFilters = useMemo(
    () => [
      { key: "all" as const, label: "All", count: books.length },
      { key: "in" as const, label: "In", count: books.filter((b) => b.available_copies > 0).length },
      { key: "out" as const, label: "Out", count: books.filter((b) => b.available_copies === 0).length },
      { key: "low" as const, label: "Low", count: books.filter((b) => b.available_copies > 0 && b.available_copies <= 2).length },
    ],
    [books],
  );

  const pageSize = viewMode === "list" ? 10 : 9;
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const pagedBooks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBooks.slice(start, start + pageSize);
  }, [filteredBooks, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, stockFilter, sortBy, viewMode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="w-full space-y-3 pb-5 md:pb-7">
      <div className="sticky top-2 z-20 rounded-xl border border-border bg-card/90 p-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">Book Catalog</h1>
            <p className="text-[11px] text-muted-foreground">Search, filter, and maintain inventory records.</p>
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title, author, ISBN"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-md pl-8 text-xs"
              />
            </div>
            <Link href="/protected/catalog/add">
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
            {pagedBooks.map((book) => (
              <ModernBookListItem key={book.id} book={book} onDelete={onDelete} onEdit={handleEditClick} />
            ))}
            {filteredBooks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground p-4">
                No books match current filters.
              </div>
            )}
          </div>
        </div>
      ) : (
        <InventoryGrid books={pagedBooks} onDelete={onDelete} onEdit={handleEditClick} />
      )}

      {filteredBooks.length > 0 && (
        <CompactPagination
          page={page}
          totalItems={filteredBooks.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}

      <EditBookMetadataDialog
        book={bookToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
