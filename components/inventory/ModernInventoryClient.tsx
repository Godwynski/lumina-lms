"use client";

import Link from "next/link";
import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, 
  Search, 
  X, 
  ArrowUpDown, 
  SlidersHorizontal,
  Upload, 
  Download, 
  Loader2, 
  Play, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileCode,
  Image as ImageIcon,
  Settings
} from "lucide-react";

export const AVAILABLE_BOOK_COLUMNS = [
  { id: "title", label: "Title", desc: "The title of the book" },
  { id: "author", label: "Author", desc: "The author(s) of the book" },
  { id: "isbn", label: "ISBN", desc: "Standard book numbering (ISBN-10 or 13)" },
  { id: "dewey_decimal", label: "Dewey Decimal", desc: "Dewey Decimal Classification system code" },
  { id: "category", label: "Category", desc: "The primary subject category name" },
  { id: "published_year", label: "Published Year", desc: "The year the book was published" },
  { id: "location", label: "Location", desc: "Physical shelving room or library code" },
  { id: "section", label: "Section", desc: "Physical shelving cabinet or section code" },
  { id: "tags", label: "Tags", desc: "Tags/subjects linked to the book" },
  { id: "status", label: "Status", desc: "Active or Archived catalog status" },
  { id: "description", label: "Description", desc: "Book synopsis or descriptive summary" },
  { id: "cover_url", label: "Cover URL", desc: "Full path to the stored cover image" }
];

export interface ParsedBook {
  title: string;
  author: string;
  isbn: string;
  category: string;
  published_year: string;
  description: string;
  stock: number;
  location: string;
  section: string;
  dewey_decimal: string;
  tags: string;
}

export interface ExportBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  dewey_decimal: string | null;
  description: string | null;
  published_year: number | null;
  cover_url: string | null;
  tags: string[] | null;
  location: string | null;
  section: string | null;
  is_active: boolean;
  created_at: string;
  categories: { name: string } | Array<{ name: string }> | null;
}
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { 
  getBooksForExport, 
  batchImportBooks, 
  lookupAndImportISBN 
} from "@/lib/actions/catalog";

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

  // Batch Operations States
  const [activeTab, setActiveTab] = useState<"import" | "isbn" | "export">("import");
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  
  // Import File States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedBooks, setParsedBooks] = useState<ParsedBook[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    imported: number;
    copiesAdded: number;
    duplicates: number;
    logs: string[];
  } | null>(null);

  // ISBN Fallback States
  const [isbnInput, setIsbnInput] = useState("");
  const [isISBNProcessing, setIsISBNProcessing] = useState(false);
  const [isbnProgress, setIsbnProgress] = useState({ current: 0, total: 0, currentIsbn: "" });
  const [isbnLogs, setIsbnLogs] = useState<{ isbn: string; status: "success" | "exists" | "error"; message: string }[]>([]);

  // Export States
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
    AVAILABLE_BOOK_COLUMNS.map(c => c.id)
  );
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingJSON, setIsExportingJSON] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  // Handle spreadsheet file selection and parsing on the client
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsing(true);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (json.length === 0) {
          toast.error("The spreadsheet appears to be empty.");
          setIsParsing(false);
          return;
        }

        // Normalize headers/keys
        const normalized: ParsedBook[] = json.map((row) => {
          const cleanRow: Record<string, unknown> = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
            cleanRow[cleanKey] = row[key];
          });

          return {
            title: String(cleanRow.title || cleanRow.book_title || cleanRow.name || ""),
            author: String(cleanRow.author || cleanRow.writer || cleanRow.authors || ""),
            isbn: String(cleanRow.isbn || cleanRow.isbn_number || cleanRow.code || ""),
            category: String(cleanRow.category || cleanRow.category_name || cleanRow.genre || ""),
            published_year: String(cleanRow.published_year || cleanRow.year || cleanRow.pub_year || ""),
            description: String(cleanRow.description || cleanRow.desc || cleanRow.summary || ""),
            stock: Number(cleanRow.stock || cleanRow.copies || cleanRow.quantity || cleanRow.copies_count || 1),
            location: String(cleanRow.location || cleanRow.shelving || cleanRow.shelf || ""),
            section: String(cleanRow.section || ""),
            dewey_decimal: String(cleanRow.dewey || cleanRow.dewey_decimal || cleanRow.call_number || ""),
            tags: String(cleanRow.tags || cleanRow.subjects || cleanRow.keywords || "")
          };
        });

        const validBooks = normalized.filter(b => b.title && b.author);
        setParsedBooks(validBooks);
        toast.success(`Successfully parsed ${validBooks.length} valid book records.`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Error reading spreadsheet: ${errMsg}`);
      } finally {
        setIsParsing(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Run the batch import server action
  const handleStartImport = async () => {
    if (parsedBooks.length === 0) return;
    setIsImporting(true);
    try {
      const res = await batchImportBooks(parsedBooks);
      if (res.success) {
        setImportResults({
          imported: res.imported,
          copiesAdded: res.copiesAdded,
          duplicates: res.duplicates,
          logs: res.logs || []
        });
        toast.success(`Import complete! Created ${res.imported} books, added ${res.copiesAdded} copies.`);
        router.refresh();
      } else {
        toast.error("Batch import failed.");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${errMsg}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Process sequential ISBN lookup with 500ms throttling to avoid rate limits
  const handleStartISBNLookup = async () => {
    const rawList = isbnInput
      .split(/[\n,]/)
      .map(isbn => isbn.trim().replace(/[- ]/g, ''))
      .filter(isbn => isbn.length > 0);

    if (rawList.length === 0) {
      toast.error("Please enter at least one valid ISBN.");
      return;
    }

    setIsISBNProcessing(true);
    setIsbnProgress({ current: 0, total: rawList.length, currentIsbn: rawList[0] });
    setIsbnLogs([]);

    toast.info(`Starting lookup sequence for ${rawList.length} ISBNs. Please keep this dialog open.`);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const BATCH_SIZE = 3;
    let completedCount = 0;

    for (let i = 0; i < rawList.length; i += BATCH_SIZE) {
      const batch = rawList.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (isbn) => {
        try {
          const res = await lookupAndImportISBN(isbn);

          if (res.success) {
            if (res.status === 'exists') {
              setIsbnLogs(prev => [...prev, {
                isbn,
                status: 'exists',
                message: `[RESOLVED] "${res.title}" already in catalog. Stock incremented by 1 copy.`
              }]);
            } else {
              setIsbnLogs(prev => [...prev, {
                isbn,
                status: 'success',
                message: `[IMPORTED] "${res.title}" by ${res.author} successfully cataloged.`
              }]);
            }
          } else {
            setIsbnLogs(prev => [...prev, {
              isbn,
              status: 'error',
              message: `[FAILED] ISBN ${isbn}: ${res.error || 'Metadata lookup empty'}`
            }]);
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          setIsbnLogs(prev => [...prev, {
            isbn,
            status: 'error',
            message: `[ERROR] ISBN ${isbn}: ${errMsg}`
          }]);
        } finally {
          completedCount++;
          setIsbnProgress(prev => ({ ...prev, current: completedCount, currentIsbn: isbn }));
        }
      }));

      // Safe throttling sleep to prevent "Too Many Requests" (429) errors from Google Books/Open Library
      if (i + BATCH_SIZE < rawList.length) {
        await sleep(500);
      }
    }

    setIsISBNProcessing(false);
    toast.success("ISBN import sequence completed!");
    router.refresh();
  };

  // Helper to map dynamic book columns
  const getMappedExportRows = (data: ExportBook[]) => {
    return data.map(b => {
      const row: Record<string, string | number> = {};
      if (selectedExportColumns.includes("title")) row['Title'] = b.title;
      if (selectedExportColumns.includes("author")) row['Author'] = b.author;
      if (selectedExportColumns.includes("isbn")) row['ISBN'] = b.isbn || '';
      if (selectedExportColumns.includes("dewey_decimal")) row['Dewey Decimal'] = b.dewey_decimal || '';
      if (selectedExportColumns.includes("category")) {
        row['Category'] = Array.isArray(b.categories) 
          ? b.categories.map((c) => c?.name).filter(Boolean).join(', ') 
          : b.categories?.name || 'Uncategorized';
      }
      if (selectedExportColumns.includes("published_year")) row['Published Year'] = b.published_year || '';
      if (selectedExportColumns.includes("location")) row['Location'] = b.location || '';
      if (selectedExportColumns.includes("section")) row['Section'] = b.section || '';
      if (selectedExportColumns.includes("tags")) row['Tags'] = Array.isArray(b.tags) ? b.tags.join(', ') : '';
      if (selectedExportColumns.includes("status")) row['Status'] = b.is_active ? 'Active' : 'Archived';
      if (selectedExportColumns.includes("description")) row['Description'] = b.description || '';
      if (selectedExportColumns.includes("cover_url")) row['Cover URL'] = b.cover_url || '';
      return row;
    });
  };

  // Client-side Excel Export
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const data = await getBooksForExport();
      const rows = getMappedExportRows(data);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Lumina Catalog');
      
      // Auto-fit columns
      const maxLen = rows.reduce((acc, row) => {
        Object.keys(row).forEach((key, i) => {
          const val = String(row[key as keyof typeof row] || '');
          acc[i] = Math.max(acc[i] || 0, val.length, key.length);
        });
        return acc;
      }, [] as number[]);
      worksheet['!cols'] = maxLen.map((len: number) => ({ wch: Math.min(len + 2, 50) }));

      XLSX.writeFile(workbook, 'lumina_catalog_export.xlsx');
      toast.success("Catalog exported to Excel successfully!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Excel export failed: ${errMsg}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Client-side CSV Export
  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const data = await getBooksForExport();
      const rows = getMappedExportRows(data);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "lumina_catalog_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Catalog exported to CSV successfully!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`CSV export failed: ${errMsg}`);
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Client-side JSON Export
  const handleExportJSON = async () => {
    setIsExportingJSON(true);
    try {
      const data = await getBooksForExport() as ExportBook[];
      const rows = data.map((b) => {
        const row: Record<string, string | number | string[] | null> = {};
        if (selectedExportColumns.includes("title")) row.title = b.title;
        if (selectedExportColumns.includes("author")) row.author = b.author;
        if (selectedExportColumns.includes("isbn")) row.isbn = b.isbn || '';
        if (selectedExportColumns.includes("dewey_decimal")) row.dewey_decimal = b.dewey_decimal || '';
        if (selectedExportColumns.includes("category")) {
          row.category = Array.isArray(b.categories) 
            ? b.categories.map((c) => c?.name).filter(Boolean).join(', ') 
            : b.categories?.name || 'Uncategorized';
        }
        if (selectedExportColumns.includes("published_year")) row.published_year = b.published_year || null;
        if (selectedExportColumns.includes("location")) row.location = b.location || '';
        if (selectedExportColumns.includes("section")) row.section = b.section || '';
        if (selectedExportColumns.includes("tags")) row.tags = b.tags || [];
        if (selectedExportColumns.includes("status")) row.status = b.is_active ? 'Active' : 'Archived';
        if (selectedExportColumns.includes("description")) row.description = b.description || '';
        if (selectedExportColumns.includes("cover_url")) row.cover_url = b.cover_url || '';
        return row;
      });

      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "lumina_catalog_export.json");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Catalog exported to JSON successfully!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`JSON export failed: ${errMsg}`);
    } finally {
      setIsExportingJSON(false);
    }
  };

  // Cover ZIP streaming API trigger
  const handleExportCoversZip = async () => {
    setIsExportingZip(true);
    try {
      window.location.href = "/api/catalog/export/covers";
      toast.success("Generating ZIP archive... Your download will begin shortly!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`ZIP export failed: ${errMsg}`);
    } finally {
      setTimeout(() => setIsExportingZip(false), 2000);
    }
  };

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

  const selectedCategoryIds = categoryId === "all" ? [] : categoryId.split(",").filter(Boolean);
  const handleCategoryToggle = (id: string) => {
    let newSelected: string[];
    if (selectedCategoryIds.includes(id)) {
      newSelected = selectedCategoryIds.filter((cid) => cid !== id);
    } else {
      newSelected = [...selectedCategoryIds, id];
    }
    const val = newSelected.join(",");
    updateParams({ categoryId: val || "all" });
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
            <SheetContent showCloseButton={false} side="right" className="w-full sm:max-w-md rounded-l-3xl border-l-border/10 bg-background p-0 overflow-hidden flex flex-col">
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
                        variant={selectedCategoryIds.length === 0 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCategoryId("all")}
                        className={cn(
                          "h-9 rounded-lg px-4 text-[10px] font-bold uppercase tracking-wider transition-all",
                          selectedCategoryIds.length === 0 ? "bg-primary text-primary-foreground" : "bg-muted/5 border-border/10"
                        )}
                      >
                        All Items
                      </Button>
                      {categories.map((cat) => {
                        const isSelected = selectedCategoryIds.includes(cat.id);
                        return (
                          <Button
                            key={cat.id}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleCategoryToggle(cat.id)}
                            className={cn(
                              "h-10 rounded-xl px-5 text-[10px] font-bold uppercase tracking-widest transition-all",
                              isSelected ? "bg-primary shadow-lg shadow-primary/20" : "bg-muted/5 border-border/10"
                            )}
                          >
                            {cat.name}
                          </Button>
                        );
                      })}
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

          {/* Add Item & Batch Operations Buttons */}
          {canManage && (
            <div className="flex gap-2 shrink-0">
              <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-11 rounded-2xl px-4 gap-2 border-border/20 bg-muted/5 hover:bg-background transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider">
                    <Upload className="h-4 w-4 text-primary/80" />
                    <span className="hidden sm:inline">Batch Ops</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full sm:max-w-2xl rounded-3xl border border-border/10 bg-background/95 backdrop-blur-xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-[9999]">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      Batch Catalog Operations
                    </DialogTitle>
                  </DialogHeader>
                  
                  {/* Beautiful Glassmorphic Tab Selectors */}
                  <div className="flex gap-1 p-1 rounded-xl bg-muted/20 border border-border/5 mb-6">
                    <button
                      onClick={() => setActiveTab("import")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        activeTab === "import" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import Sheet
                    </button>
                    <button
                      onClick={() => setActiveTab("isbn")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        activeTab === "isbn" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Play className="h-3.5 w-3.5" />
                      ISBN Fallback
                    </button>
                    <button
                      onClick={() => setActiveTab("export")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        activeTab === "export" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Data
                    </button>
                  </div>

                  {/* Tab 1: Import Sheet */}
                  {activeTab === "import" && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      <div className="border-2 border-dashed border-border/20 rounded-2xl p-8 flex flex-col items-center justify-center bg-muted/5 transition-all hover:border-primary/30 relative">
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={isParsing || isImporting}
                        />
                        {isParsing ? (
                          <>
                            <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                            <p className="text-sm font-semibold">Reading spreadsheet content...</p>
                          </>
                        ) : importFile ? (
                          <>
                            <FileSpreadsheet className="h-8 w-8 text-primary mb-3" />
                            <p className="text-sm font-semibold">{importFile.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{(importFile.size / 1024).toFixed(1)} KB • {parsedBooks.length} ready rows</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImportFile(null);
                                setParsedBooks([]);
                                setImportResults(null);
                              }}
                              className="mt-3 text-xs text-destructive font-bold hover:underline"
                            >
                              Remove File
                            </button>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground/50 mb-3" />
                            <p className="text-sm font-semibold">Choose CSV or Excel Spreadsheet</p>
                            <p className="text-xs text-muted-foreground mt-1">Drag and drop or click to browse</p>
                            <p className="text-[10px] text-muted-foreground/40 mt-3 uppercase tracking-wider">Required headers: Title, Author (Optional: ISBN, Category, Copies)</p>
                          </>
                        )}
                      </div>

                      {parsedBooks.length > 0 && !importResults && (
                        <div className="bg-muted/10 border border-border/10 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dry-Run Preview Summary</span>
                            <Badge className="bg-primary/20 text-primary border-none">{parsedBooks.length} Books Detected</Badge>
                          </div>
                          <div className="max-h-32 overflow-y-auto text-xs space-y-1.5 custom-scrollbar pr-1">
                            {parsedBooks.slice(0, 5).map((b, idx) => (
                              <div key={idx} className="flex justify-between border-b border-border/5 py-1 text-muted-foreground">
                                <span className="font-semibold text-foreground truncate max-w-[200px]">{b.title}</span>
                                <span>by {b.author}</span>
                                <span>{b.stock} cop{b.stock > 1 ? "ies" : "y"}</span>
                              </div>
                            ))}
                            {parsedBooks.length > 5 && (
                              <div className="text-center pt-1.5 text-muted-foreground/60 text-[10px]">
                                + {parsedBooks.length - 5} more records
                              </div>
                            )}
                          </div>
                          
                          <Button
                            onClick={handleStartImport}
                            disabled={isImporting}
                            className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          >
                            {isImporting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing Import...
                              </>
                            ) : (
                              "Commit & Import to Catalog"
                            )}
                          </Button>
                        </div>
                      )}

                      {importResults && (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                          <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                            <CheckCircle2 className="h-5 w-5" />
                            Spreadsheet Import Successful!
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center py-2 bg-emerald-500/10 rounded-xl">
                            <div>
                              <div className="text-xl font-bold text-emerald-400">{importResults.imported}</div>
                              <div className="text-[10px] text-muted-foreground uppercase font-black">Created</div>
                            </div>
                            <div>
                              <div className="text-xl font-bold text-emerald-400">{importResults.copiesAdded}</div>
                              <div className="text-[10px] text-muted-foreground uppercase font-black">Copies Added</div>
                            </div>
                            <div>
                              <div className="text-xl font-bold text-amber-400">{importResults.duplicates}</div>
                              <div className="text-[10px] text-muted-foreground uppercase font-black">Duplicates</div>
                            </div>
                          </div>
                          {importResults.logs.length > 0 && (
                            <div className="max-h-24 overflow-y-auto text-[10px] font-mono bg-black/40 rounded-lg p-2.5 space-y-1 text-emerald-300 custom-scrollbar">
                              {importResults.logs.map((log, idx) => (
                                <div key={idx}>{log}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: ISBN Lookup */}
                  {activeTab === "isbn" && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 flex flex-col">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Paste ISBN List</label>
                        <textarea
                          placeholder="9780743273565&#10;9780451524935&#10;9780061120084"
                          value={isbnInput}
                          onChange={(e) => setIsbnInput(e.target.value)}
                          disabled={isISBNProcessing}
                          className="h-32 w-full rounded-2xl border border-border/20 bg-muted/5 p-4 text-xs font-medium focus:border-primary/30 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/5 placeholder:text-muted-foreground/30 font-mono resize-none"
                        />
                        <span className="text-[10px] text-muted-foreground ml-1 block">One ISBN code per line. We will lookup metadata, download optimized covers, and catalog them.</span>
                      </div>

                      {isISBNProcessing && (
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="flex items-center gap-2 text-primary">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Searching API Catalog: {isbnProgress.currentIsbn}
                            </span>
                            <span>{isbnProgress.current} / {isbnProgress.total}</span>
                          </div>
                          {/* Animated Premium Progress Bar */}
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                            <div 
                              className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-300 rounded-full"
                              style={{ width: `${(isbnProgress.current / isbnProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={handleStartISBNLookup}
                        disabled={isISBNProcessing || !isbnInput.trim()}
                        className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0"
                      >
                        {isISBNProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Looking up ISBNs ({isbnProgress.current} of {isbnProgress.total})...
                          </>
                        ) : (
                          "Start Sequential Auto-Lookup"
                        )}
                      </Button>

                      {isbnLogs.length > 0 && (
                        <div className="flex-1 min-h-[140px] flex flex-col">
                          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 ml-1">Real-time Terminal Logs</div>
                          <div className="flex-1 bg-black/40 border border-border/10 rounded-2xl p-3 font-mono text-[10px] space-y-1.5 overflow-y-auto max-h-36 custom-scrollbar">
                            {isbnLogs.map((log, idx) => (
                              <div 
                                key={idx} 
                                className={cn(
                                  "py-0.5 border-b border-white/5",
                                  log.status === "success" && "text-emerald-400",
                                  log.status === "exists" && "text-amber-400",
                                  log.status === "error" && "text-red-400"
                                )}
                              >
                                {log.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Export Data */}
                  {activeTab === "export" && (
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 flex flex-col justify-start">
                      <div className="text-center max-w-sm mx-auto space-y-1 mb-2">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                          <Download className="h-5 w-5" />
                        </div>
                        <h4 className="text-sm font-bold">Export Catalog Elements</h4>
                        <p className="text-[11px] text-muted-foreground">Select columns and download the active catalog in your preferred format.</p>
                      </div>

                      {/* Columns Selector Checklist */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Settings className="h-3.5 w-3.5 text-primary" />
                            Customize Columns ({selectedExportColumns.length} / {AVAILABLE_BOOK_COLUMNS.length})
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedExportColumns(AVAILABLE_BOOK_COLUMNS.map(c => c.id))}
                              className="text-[10px] font-bold text-primary hover:underline bg-transparent border-0 p-0"
                            >
                              Select All
                            </button>
                            <span className="text-[10px] text-muted-foreground/30">|</span>
                            <button
                              type="button"
                              onClick={() => setSelectedExportColumns([])}
                              className="text-[10px] font-bold text-muted-foreground/60 hover:text-foreground hover:underline bg-transparent border-0 p-0"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/10 border border-border/10 max-h-[160px] overflow-y-auto custom-scrollbar">
                          {AVAILABLE_BOOK_COLUMNS.map((col) => {
                            const isSelected = selectedExportColumns.includes(col.id);
                            return (
                              <div
                                key={col.id}
                                onClick={() => {
                                  setSelectedExportColumns(prev =>
                                    prev.includes(col.id)
                                      ? prev.filter(id => id !== col.id)
                                      : [...prev, col.id]
                                  );
                                }}
                                className={cn(
                                  "flex items-start gap-2 p-1.5 rounded-xl border border-transparent cursor-pointer transition-all hover:bg-muted/20 select-none",
                                  isSelected ? "bg-muted/10 border-border/5" : "opacity-60 hover:opacity-100"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="mt-0.5 accent-primary h-3.5 w-3.5 rounded border-border/20 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold block">{col.label}</span>
                                  <span className="text-[9px] text-muted-foreground leading-tight block truncate">
                                    {col.desc}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Export buttons grid (4 items: Excel, CSV, JSON, ZIP) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        {/* Excel Export */}
                        <Button
                          variant="outline"
                          onClick={handleExportExcel}
                          disabled={isExportingExcel || selectedExportColumns.length === 0}
                          className="h-24 rounded-2xl flex flex-col justify-center gap-2 border-border/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-center"
                        >
                          {isExportingExcel ? (
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                          ) : (
                            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                          )}
                          <div className="w-full">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-foreground">Spreadsheet</span>
                            <span className="block text-[8px] text-muted-foreground font-semibold">Excel (.xlsx)</span>
                          </div>
                        </Button>

                        {/* CSV Export */}
                        <Button
                          variant="outline"
                          onClick={handleExportCSV}
                          disabled={isExportingCSV || selectedExportColumns.length === 0}
                          className="h-24 rounded-2xl flex flex-col justify-center gap-2 border-border/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-center"
                        >
                          {isExportingCSV ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          ) : (
                            <FileCode className="h-5 w-5 text-blue-500" />
                          )}
                          <div className="w-full">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-foreground">Text CSV</span>
                            <span className="block text-[8px] text-muted-foreground font-semibold">Comma-Sep (.csv)</span>
                          </div>
                        </Button>

                        {/* JSON Export */}
                        <Button
                          variant="outline"
                          onClick={handleExportJSON}
                          disabled={isExportingJSON || selectedExportColumns.length === 0}
                          className="h-24 rounded-2xl flex flex-col justify-center gap-2 border-border/10 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-center"
                        >
                          {isExportingJSON ? (
                            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                          ) : (
                            <FileCode className="h-5 w-5 text-amber-500" />
                          )}
                          <div className="w-full">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-foreground">JSON Data</span>
                            <span className="block text-[8px] text-muted-foreground font-semibold">Developer (.json)</span>
                          </div>
                        </Button>

                        {/* ZIP Export */}
                        <Button
                          variant="outline"
                          onClick={handleExportCoversZip}
                          disabled={isExportingZip}
                          className="h-24 rounded-2xl flex flex-col justify-center gap-2 border-border/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-center"
                        >
                          {isExportingZip ? (
                            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-indigo-500" />
                          )}
                          <div className="w-full">
                            <span className="block text-[9px] font-black uppercase tracking-wider text-foreground">Covers ZIP</span>
                            <span className="block text-[8px] text-muted-foreground font-semibold">Images (.zip)</span>
                          </div>
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border border-t border-border/10 flex justify-end shrink-0">
                    <DialogClose asChild>
                      <Button variant="outline" className="h-10 rounded-xl px-5 text-xs font-bold tracking-wide border-border/10">
                        Close Panel
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>

              <Link href="/inventory/add" className="shrink-0">
                <Button className="h-11 rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 group">
                  <Plus className="sm:mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
                  <span className="hidden sm:inline">Add Item</span>
                </Button>
              </Link>
            </div>
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
