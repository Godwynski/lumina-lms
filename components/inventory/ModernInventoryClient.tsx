"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ModernBookListItem } from "./ModernBookListItem";
import { InventoryGrid } from "./InventoryGrid";
import { 
  Search, 
  Plus, 
  Box,
  AlertCircle,
  Package,
  Activity,
  Archive,
  MapPin,
  LayoutGrid,
  Rows3,
  ArrowUpDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Book } from "@/lib/types";
import { useState, useMemo } from "react";
import { EditBookMetadataDialog } from "./EditBookMetadataDialog";

interface ModernInventoryClientProps {
  books: Book[];
  onDelete: (book: Book) => void;
}

export function ModernInventoryClient({ books, onDelete }: ModernInventoryClientProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out" | "low">("all");
  const [sortBy, setSortBy] = useState<"title_asc" | "title_desc" | "availability_desc" | "availability_asc">("title_asc");
  
  // Edit State
  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleEditClick = (book: Book) => {
    setBookToEdit(book);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    window.location.reload(); 
  };
  
  const filteredBooks = useMemo(() => {
    const searched = books.filter(b => 
      b.title.toLowerCase().includes(search.toLowerCase()) || 
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.isbn?.toLowerCase().includes(search.toLowerCase())
    );

    const stockFiltered = searched.filter((b) => {
      if (stockFilter === "in") return b.available_copies > 0;
      if (stockFilter === "out") return b.available_copies === 0;
      if (stockFilter === "low") return b.available_copies > 0 && b.available_copies <= 2;
      return true;
    });

    const sorted = [...stockFiltered].sort((a, b) => {
      if (sortBy === "title_desc") return b.title.localeCompare(a.title);
      if (sortBy === "availability_desc") return b.available_copies - a.available_copies;
      if (sortBy === "availability_asc") return a.available_copies - b.available_copies;
      return a.title.localeCompare(b.title);
    });

    return sorted;
  }, [books, search, sortBy, stockFilter]);

  const quickFilters = useMemo(
    () => [
      { key: "all" as const, label: "All", count: books.length },
      { key: "in" as const, label: "In Stock", count: books.filter((b) => b.available_copies > 0).length },
      { key: "out" as const, label: "Out", count: books.filter((b) => b.available_copies === 0).length },
      { key: "low" as const, label: "Low (<=2)", count: books.filter((b) => b.available_copies > 0 && b.available_copies <= 2).length },
    ],
    [books],
  );

  const stats = useMemo(() => {
    const totalTitles = books.length;
    const totalUnits = books.reduce((acc, b) => acc + (b.total_copies || 0), 0);
    const availableUnits = books.reduce((acc, b) => acc + b.available_copies, 0);
    const outOfStock = books.filter(b => b.available_copies === 0 && (b.total_copies || 0) > 0).length;

    return [
      { label: "Total Asset Titles", val: totalTitles, icon: Archive, color: "text-indigo-500", bg: "bg-indigo-500/10" },
      { label: "Physical Units", val: totalUnits, icon: Package, color: "text-violet-500", bg: "bg-violet-500/10" },
      { label: "Live Availability", val: availableUnits, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-500/10" },
      { label: "Stock Deficits", val: outOfStock, icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10" },
    ];
  }, [books]);

  // Dynamic distribution based on 'section'
  const distribution = useMemo(() => {
    const sections: Record<string, number> = {};
    books.forEach(b => {
      const s = b.section || "General / Unassigned";
      sections[s] = (sections[s] || 0) + 1;
    });
    return Object.entries(sections)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [books]);

  const lowStock = books.filter(b => b.available_copies === 0 && (b.total_copies || 0) > 0);

  return (
    <div className="flex flex-col gap-6 md:gap-10 pb-24 max-w-[1600px] mx-auto w-full px-2 sm:px-0">
      
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white dark:bg-zinc-900 md:bg-white/80 md:dark:bg-zinc-900/80 md:backdrop-blur-xl p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl shadow-zinc-200/5">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="h-12 w-12 md:h-16 md:w-16 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
            <Box size={28} className="md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-2">Inventory Hub</h1>
            <div className="flex items-center gap-2 md:gap-3">
               <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-[10px] md:text-xs font-black text-zinc-400 uppercase tracking-[0.1em] md:tracking-[0.2em]">Real-time Asset Control</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
           <div className="relative w-full sm:w-[280px] md:w-[320px] group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <Input 
              placeholder="Search by title, author, or ISBN..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 md:h-14 bg-zinc-50 dark:bg-zinc-800/50 border-none focus:ring-4 focus:ring-indigo-500/5 rounded-xl md:rounded-2xl text-sm md:text-base w-full"
            />
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2 rounded-xl md:rounded-2xl border border-zinc-200/70 bg-zinc-50 p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
              className="h-9 rounded-lg px-3"
            >
              <Rows3 className="mr-1.5 h-4 w-4" />
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => setViewMode("grid")}
              className="h-9 rounded-lg px-3"
            >
              <LayoutGrid className="mr-1.5 h-4 w-4" />
              Grid
            </Button>
          </div>
          <Link href="/protected/catalog/add" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-12 md:h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl md:rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 font-black text-[10px] md:text-xs uppercase tracking-widest transition-transform active:scale-95">
              <Plus size={18} />
              Register Asset
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((item, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={i} 
            className="bg-white dark:bg-zinc-900 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-3 md:gap-4 group hover:bg-zinc-50 transition-colors"
          >
            <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl ${item.bg} flex items-center justify-center ${item.color} group-hover:rotate-12 transition-transform shrink-0`}>
              <item.icon size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[8px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">{item.label}</p>
              <p className="text-sm md:text-xl font-bold text-zinc-900 dark:text-white leading-tight">{item.val}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-8 md:gap-12">
        {/* Main Content Areas */}
        <div className="flex-1 space-y-8 md:space-y-10">
          
          {/* Critical Alerts - Only shown if there are deficits */}
          {lowStock.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                <AlertCircle size={14} />
                Critical Stock Deficit
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 font-bold">
                {lowStock.slice(0, 4).map(book => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={book.id} 
                    className="bg-orange-50/30 dark:bg-orange-900/10 border border-orange-200/30 dark:border-orange-500/20 p-4 rounded-xl md:rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                       <div className="h-9 w-9 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 shrink-0">
                          <Package size={16} />
                       </div>
                       <p className="text-xs md:text-sm font-bold text-zinc-900 dark:text-white truncate">{book.title}</p>
                    </div>
                    <Link href={`/protected/catalog/${book.id}`} className="shrink-0">
                      <Button variant="ghost" size="sm" className="rounded-full text-orange-600 hover:bg-orange-100 h-8 text-[10px]">
                        Restock
                      </Button>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Catalog Controls */}
          <div className="space-y-4 border-b border-zinc-100 dark:border-zinc-800 pb-4 md:pb-6">
            <div className="flex items-center justify-between">
             <h2 className="text-lg md:text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2 md:gap-4">
                Active Collection
                <Badge variant="outline" className="text-[10px] py-0">{filteredBooks.length}</Badge>
              </h2>
              <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold outline-none"
                >
                  <option value="title_asc">Title A-Z</option>
                  <option value="title_desc">Title Z-A</option>
                  <option value="availability_desc">Most Available</option>
                  <option value="availability_asc">Least Available</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {quickFilters.map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant={stockFilter === filter.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStockFilter(filter.key)}
                  className="h-8 rounded-full px-3 text-[11px]"
                >
                  {filter.label} ({filter.count})
                </Button>
              ))}

              <div className="md:hidden ml-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none"
                >
                  <option value="title_asc">Title A-Z</option>
                  <option value="title_desc">Title Z-A</option>
                  <option value="availability_desc">Most Available</option>
                  <option value="availability_asc">Least Available</option>
                </select>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div 
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {viewMode === "list" ? (
                <>
                  {filteredBooks.map((book) => (
                    <ModernBookListItem key={book.id} book={book} onDelete={onDelete} onEdit={handleEditClick} />
                  ))}
                  {filteredBooks.length === 0 && (
                    <div className="text-center py-20 text-zinc-400">No assets found matching your query.</div>
                  )}
                </>
              ) : (
                <InventoryGrid books={filteredBooks} onDelete={onDelete} onEdit={handleEditClick} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sidebar Context - Stack on mobile, side on desktop */}
        <div className="xl:w-[380px] space-y-6 md:space-y-8">
           <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group border border-white/10">
              <div className="relative z-10">
                 <div className="h-12 w-12 md:h-14 md:w-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                    <Activity size={24} className="md:w-7 md:h-7" />
                 </div>
                 <h4 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 tracking-tight">Standard Protocol</h4>
                 <p className="text-indigo-100/80 text-xs md:text-sm leading-relaxed mb-6 md:mb-8 font-medium">
                   All physical units are verified against the primary catalog. Scan the internal QR code on decommission for safe disposal or archiving.
                 </p>
                 <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between p-3 md:p-4 bg-white/10 rounded-xl md:rounded-2xl border border-white/10 backdrop-blur-sm">
                       <span className="text-[10px] md:text-xs font-bold text-indigo-200">System Accuracy</span>
                       <span className="text-[10px] md:text-xs font-black">100% Verified</span>
                    </div>
                    <div className="flex items-center justify-between p-3 md:p-4 bg-white/10 rounded-xl md:rounded-2xl border border-white/10 backdrop-blur-sm">
                       <span className="text-[10px] md:text-xs font-bold text-indigo-200">Catalog Version</span>
                       <span className="text-[10px] md:text-xs font-black">v2.4.0</span>
                    </div>
                 </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 md:w-80 h-64 md:h-80 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-[10s]" />
           </div>

           <div className="bg-zinc-50 dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-zinc-200/60 dark:border-zinc-800/60">
              <h4 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.15em] mb-6 md:mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4 flex items-center gap-2">
                <MapPin size={12} />
                Top Storage Sections
              </h4>
              <div className="space-y-5 md:space-y-6">
                 {distribution.length > 0 ? distribution.map((zone, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center text-xs md:text-sm">
                         <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate pr-2">{zone.name}</span>
                         <span className="font-mono text-[10px] text-zinc-400 font-black shrink-0">{zone.count} Asset(s)</span>
                      </div>
                      <div className="h-1 md:h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                         <motion.div 
                           initial={{ width: 0 }}
                           whileInView={{ width: `${(zone.count / Math.max(...distribution.map(d => d.count))) * 100}%` }}
                           className="h-full bg-indigo-500 rounded-full" 
                         />
                      </div>
                   </div>
                 )) : (
                   <p className="text-xs text-zinc-400 text-center py-4 italic">No distribution data available.</p>
                 )}
              </div>
           </div>
        </div>
      </div>
      <EditBookMetadataDialog 
        book={bookToEdit}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}

