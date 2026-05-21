"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Search, 
  Settings, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Edit2, 
  Trash2, 
  ArrowLeft, 
  Loader2, 
  AlertTriangle, 
  ShieldAlert, 
  Terminal, 
  Copy,
  CheckCircle2,
  ListTodo
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { m, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface ChecklistItem {
  id: string;
  problem: string;
  explanation: string | null;
  user_role: string | null;
  module: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface DropdownOption {
  id: string;
  type: string;
  value: string;
  created_at: string;
}

type ActionType = 
  | "seed" 
  | "clear" 
  | "seed-catalog" 
  | "clear-catalog" 
  | "seed-logs-borrows" 
  | "clear-logs-borrows";

const ACTIONS_CONFIG = {
  "seed-catalog": {
    title: "Seed Catalog Only",
    confirmText: "Seed Catalog Only: This clears categories/books and seeds catalog copies as AVAILABLE.",
    type: "seed" as const
  },
  "clear-catalog": {
    title: "Wipe Catalog Only",
    confirmText: "Wipe Catalog Only: This deletes all library categories, books, and borrowing history.",
    type: "clear" as const
  },
  "seed-logs-borrows": {
    title: "Seed Logs & History",
    confirmText: "Seed Logs & History: This clears operational logs and seeds active/returned borrows and reservations.",
    type: "seed" as const
  },
  "clear-logs-borrows": {
    title: "Wipe Logs & History",
    confirmText: "Wipe Logs & History Only: This resets all copies to AVAILABLE and clears borrowing records.",
    type: "clear" as const
  },
  "seed": {
    title: "Complete System Seed",
    confirmText: "Complete System Seed: This runs a full database purge and seeds the entire starting test dataset.",
    type: "seed" as const
  },
  "clear": {
    title: "Complete System Purge",
    confirmText: "Complete System Purge: This wipes all transactional data, catalog items, and files in storage. Preserves user profiles.",
    type: "clear" as const
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.02 }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } }
} as const;

export default function SheeshPage() {
  const [supabase] = useState(() => createClient());

  // Database States
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'completed', 'active'

  // Expand State
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Auto-Expanding Inline Form States
  const [isAddFocused, setIsAddFocused] = useState(false);
  const [newProblem, setNewProblem] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newCustomRole, setNewCustomRole] = useState("");
  const [newModule, setNewModule] = useState("");
  const [newCustomModule, setNewCustomModule] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit States
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [editProblem, setEditProblem] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editCustomRole, setEditCustomRole] = useState("");
  const [editModule, setEditModule] = useState("");
  const [editCustomModule, setEditCustomModule] = useState("");

  // Dev Control Panel States (Legacy sandbox center actions)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRunningDevAction, setIsRunningDevAction] = useState(false);
  const [devActionType, setDevActionType] = useState<ActionType | null>(null);
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [devStatus, setDevStatus] = useState<"IDLE" | "RUNNING" | "SUCCESS" | "FAILED">("IDLE");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load & Realtime Subscriptions
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);

        const { data: fetchedItems, error: itemsErr } = await supabase
          .from("checklist_items")
          .select("*")
          .order("created_at", { ascending: false });

        if (itemsErr) throw itemsErr;
        setItems(fetchedItems || []);

        const { data: fetchedOptions, error: optionsErr } = await supabase
          .from("checklist_dropdown_options")
          .select("*")
          .order("value", { ascending: true });

        if (optionsErr) throw optionsErr;
        setOptions(fetchedOptions || []);

      } catch (err) {
        console.error("Initial load error:", err);
        toast.error("Failed to load checklist data");
      } finally {
        setLoading(false);
      }
    }

    initData();

    const itemsChannel = supabase
      .channel("realtime-checklist-items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_items" },
        (payload) => {
          const { eventType, new: newItem, old: oldItem } = payload;
          if (eventType === "INSERT") {
            setItems(prev => {
              if (prev.some(item => item.id === newItem.id)) return prev;
              return [newItem as ChecklistItem, ...prev];
            });
          } else if (eventType === "UPDATE") {
            setItems(prev => prev.map(item => item.id === newItem.id ? (newItem as ChecklistItem) : item));
          } else if (eventType === "DELETE") {
            setItems(prev => prev.filter(item => item.id !== oldItem.id));
          }
        }
      )
      .subscribe((status, err) => {
        console.info(`Realtime checklist-items status: ${status}`, err || "");
      });

    const optionsChannel = supabase
      .channel("realtime-checklist-options")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_dropdown_options" },
        (payload) => {
          const { eventType, new: newOpt, old: oldOpt } = payload;
          if (eventType === "INSERT") {
            setOptions(prev => {
              if (prev.some(o => o.id === newOpt.id)) return prev;
              return [...prev, newOpt as DropdownOption].sort((a, b) => a.value.localeCompare(b.value));
            });
          } else if (eventType === "DELETE") {
            setOptions(prev => prev.filter(o => o.id !== oldOpt.id));
          }
        }
      )
      .subscribe((status, err) => {
        console.info(`Realtime checklist-options status: ${status}`, err || "");
      });

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(optionsChannel);
    };
  }, [supabase]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [devLogs]);

  // Option Helper
  const ensureDropdownOption = async (type: "user_role" | "module", val: string): Promise<string> => {
    const cleanVal = val.trim();
    if (!cleanVal) return "";
    
    const match = options.find(o => o.type === type && o.value.toLowerCase() === cleanVal.toLowerCase());
    if (match) return match.value;

    const { data, error } = await supabase
      .from("checklist_dropdown_options")
      .insert({ type, value: cleanVal })
      .select()
      .single();

    if (error) {
      if (!error.message.includes("duplicate key")) {
        console.error("Error inserting custom option:", error);
      }
    } else if (data) {
      setOptions(prev => {
        if (prev.some(o => o.id === data.id)) return prev;
        return [...prev, data as DropdownOption].sort((a, b) => a.value.localeCompare(b.value));
      });
    }
    return data ? data.value : cleanVal;
  };

  // Actions
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProblem.trim()) {
      toast.error("Please specify a problem description");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalRole = newRole;
      let finalModule = newModule;

      if (newRole === "custom") {
        if (!newCustomRole.trim()) {
          toast.error("Please type a custom user role");
          setIsSubmitting(false);
          return;
        }
        finalRole = await ensureDropdownOption("user_role", newCustomRole);
      }

      if (newModule === "custom") {
        if (!newCustomModule.trim()) {
          toast.error("Please type a custom module");
          setIsSubmitting(false);
          return;
        }
        finalModule = await ensureDropdownOption("module", newCustomModule);
      }

      const { data: newItem, error } = await supabase
        .from("checklist_items")
        .insert({
          problem: newProblem.trim(),
          explanation: newExplanation.trim() || null,
          user_role: finalRole || null,
          module: finalModule || null,
          is_completed: false
        })
        .select()
        .single();

      if (error) throw error;

      if (newItem) {
        setItems(prev => {
          if (prev.some(item => item.id === newItem.id)) return prev;
          return [newItem as ChecklistItem, ...prev];
        });
      }

      toast.success("Problem logged!");
      
      setNewProblem("");
      setNewExplanation("");
      setNewRole("");
      setNewCustomRole("");
      setNewModule("");
      setNewCustomModule("");
      setIsAddFocused(false);
    } catch (err) {
      console.error("Add item error:", err);
      toast.error("Failed to add checklist item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: ChecklistItem) => {
    try {
      const nextStatus = !item.is_completed;
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: nextStatus } : i));

      const { error } = await supabase
        .from("checklist_items")
        .update({ is_completed: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", item.id);

      if (error) throw error;
    } catch (err) {
      console.error("Toggle item error:", err);
      toast.error("Failed to update status");
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: item.is_completed } : i));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editProblem.trim()) {
      toast.error("Problem title cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalRole = editRole;
      let finalModule = editModule;

      if (editRole === "custom") {
        if (!editCustomRole.trim()) {
          toast.error("Please specify custom user role");
          setIsSubmitting(false);
          return;
        }
        finalRole = await ensureDropdownOption("user_role", editCustomRole);
      }

      if (editModule === "custom") {
        if (!editCustomModule.trim()) {
          toast.error("Please specify custom module");
          setIsSubmitting(false);
          return;
        }
        finalModule = await ensureDropdownOption("module", editCustomModule);
      }

      const { data: updatedItem, error } = await supabase
        .from("checklist_items")
        .update({
          problem: editProblem.trim(),
          explanation: editExplanation.trim() || null,
          user_role: finalRole || null,
          module: finalModule || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingItem.id)
        .select()
        .single();

      if (error) throw error;

      if (updatedItem) {
        setItems(prev => prev.map(item => item.id === updatedItem.id ? (updatedItem as ChecklistItem) : item));
      }

      toast.success("Problem updated!");
      setEditingItem(null);
    } catch (err) {
      console.error("Update item error:", err);
      toast.error("Failed to save changes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this log?")) return;

    const previousItems = items;
    setItems(prev => prev.filter(item => item.id !== id));

    try {
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Item deleted");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete item");
      setItems(previousItems);
    }
  };

  const handleEditClick = (item: ChecklistItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setEditProblem(item.problem);
    setEditExplanation(item.explanation || "");
    
    const roleExists = options.some(o => o.type === "user_role" && o.value === item.user_role);
    if (item.user_role && !roleExists) {
      setEditRole("custom");
      setEditCustomRole(item.user_role);
    } else {
      setEditRole(item.user_role || "");
      setEditCustomRole("");
    }

    const moduleExists = options.some(o => o.type === "module" && o.value === item.module);
    if (item.module && !moduleExists) {
      setEditModule("custom");
      setEditCustomModule(item.module);
    } else {
      setEditModule(item.module || "");
      setEditCustomModule("");
    }
  };

  const handleCopyItem = (item: ChecklistItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `${item.problem}\nWhere: ${item.module || "N/A"}\nWho: ${item.user_role || "N/A"}`;
    navigator.clipboard.writeText(textToCopy);
    toast.success("Details copied to clipboard!");
  };

  // Dev Sandbox Control Actions
  const handleDevActionClick = (type: ActionType) => {
    setDevActionType(type);
    setShowConfirmModal(true);
  };

  const executeDevAction = async () => {
    if (!devActionType) return;
    
    const config = ACTIONS_CONFIG[devActionType];
    setShowConfirmModal(false);
    setIsRunningDevAction(true);
    setDevStatus("RUNNING");
    setDevLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 Running: ${config.title}...`]);
    
    try {
      const response = await fetch("/api/sheesh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: devActionType }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.logs && Array.isArray(data.logs)) {
          setDevLogs((prev) => [...prev, ...data.logs, `[${new Date().toLocaleTimeString()}] 🎉 Done!`]);
        } else {
          setDevLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 Done!`]);
        }
        setDevStatus("SUCCESS");
        toast.success(`Success!`);

        const { data: refreshedItems } = await supabase.from("checklist_items").select("*").order("created_at", { ascending: false });
        const { data: refreshedOpts } = await supabase.from("checklist_dropdown_options").select("*").order("value", { ascending: true });
        setItems(refreshedItems || []);
        setOptions(refreshedOpts || []);
      } else {
        const errMsg = data.error || "An error occurred.";
        setDevLogs((prev) => [...prev, `❌ Error: ${errMsg}`]);
        setDevStatus("FAILED");
        toast.error(`Error: ${errMsg}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Failed to contact endpoint";
      setDevLogs((prev) => [...prev, `❌ Network Error: ${errMsg}`]);
      setDevStatus("FAILED");
      toast.error(`Network error: ${errMsg}`);
    } finally {
      setIsRunningDevAction(false);
      setDevActionType(null);
    }
  };

  // Calculations
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.explanation && item.explanation.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = filterRole === "all" || item.user_role === filterRole;
    const matchesModule = filterModule === "all" || item.module === filterModule;
    
    let matchesStatus = true;
    if (filterStatus === "completed") matchesStatus = item.is_completed;
    if (filterStatus === "active") matchesStatus = !item.is_completed;

    return matchesSearch && matchesRole && matchesModule && matchesStatus;
  });

  const totalCount = items.length;
  const completedCount = items.filter(i => i.is_completed).length;
  const activeCount = totalCount - completedCount;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const roleOptions = options.filter(o => o.type === "user_role");
  const moduleOptions = options.filter(o => o.type === "module");

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden pb-20 font-sans">
      {/* Subtle Radial Grid */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] opacity-[0.15] [background-size:20px_20px] pointer-events-none"></div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 pt-10">
        
        {/* Simple Minimalist Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <ListTodo className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Checklist
              </h1>
              <p className="text-xs text-muted-foreground">Log, filter, and track system issues in real-time.</p>
            </div>
          </div>
          <Link 
            href="/dashboard" 
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/40 bg-card/45 hover:bg-card/85"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit Dashboard
          </Link>
        </div>

        {/* Compact Metrics Dashboard Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="border border-border/50 bg-card/25 rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Tasks</span>
            <span className="text-xl font-extrabold text-foreground">{totalCount}</span>
          </div>
          <div className="border border-border/50 bg-card/25 rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active</span>
            <span className="text-xl font-extrabold text-amber-500">{activeCount}</span>
          </div>
          <div className="border border-border/50 bg-card/25 rounded-xl p-3.5 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completed</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-emerald-500">{completedCount}</span>
              <span className="text-[10px] font-semibold text-muted-foreground/70">({completionPercentage}%)</span>
            </div>
          </div>
        </div>

        {/* Quick inline insert field (always visible at top of list) */}
        <div className="border border-border bg-card/20 rounded-xl p-4 mb-6 focus-within:border-primary/45 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
          <div className="flex gap-3 items-center">
            <Plus className="w-5 h-5 text-muted-foreground/60 shrink-0" />
            <input 
              type="text" 
              value={newProblem}
              onChange={(e) => {
                setNewProblem(e.target.value);
                if (!isAddFocused) setIsAddFocused(true);
              }}
              onFocus={() => setIsAddFocused(true)}
              placeholder="Log a new issue or task description..."
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none py-0.5"
            />
            {!isAddFocused && (
              <span className="text-xs text-muted-foreground/40 hidden sm:inline select-none whitespace-nowrap">
                Click to expand details
              </span>
            )}
          </div>

          {isAddFocused && (
            <m.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mt-4 pt-4 border-t border-border/30 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* User Role */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">User Role</label>
                  <select 
                    value={newRole}
                    onChange={(e) => {
                      setNewRole(e.target.value);
                      if (e.target.value !== "custom") setNewCustomRole("");
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="">None</option>
                    {roleOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.value}</option>
                    ))}
                    <option value="custom" className="text-primary font-bold">+ Custom Role...</option>
                  </select>
                  {newRole === "custom" && (
                    <input 
                      type="text" 
                      value={newCustomRole}
                      onChange={(e) => setNewCustomRole(e.target.value)}
                      placeholder="Custom role name..."
                      className="w-full h-10 mt-2 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    />
                  )}
                </div>

                {/* Module */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1.5">Module / Feature Area</label>
                  <select 
                    value={newModule}
                    onChange={(e) => {
                      setNewModule(e.target.value);
                      if (e.target.value !== "custom") setNewCustomModule("");
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="">None</option>
                    {moduleOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.value}</option>
                    ))}
                    <option value="custom" className="text-primary font-bold">+ Custom Module...</option>
                  </select>
                  {newModule === "custom" && (
                    <input 
                      type="text" 
                      value={newCustomModule}
                      onChange={(e) => setNewCustomModule(e.target.value)}
                      placeholder="Custom module name..."
                      className="w-full h-10 mt-2 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    />
                  )}
                </div>
              </div>



              <div className="flex gap-2 justify-end pt-1">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    setIsAddFocused(false);
                    setNewProblem("");
                    setNewExplanation("");
                    setNewRole("");
                    setNewCustomRole("");
                    setNewModule("");
                    setNewCustomModule("");
                  }}
                  className="h-9 px-4 text-xs font-semibold rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/10"
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={handleAdd}
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 px-4 rounded-lg shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Add Issue
                </Button>
              </div>
            </m.div>
          )}
        </div>

        {/* Compressed Filtering & Search */}
        <div className="rounded-xl border border-border/50 bg-card/20 p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs/descriptions..."
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/40"
              />
            </div>
            <div>
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/40"
              >
                <option value="all">All Roles</option>
                {roleOptions.map(opt => (
                  <option key={opt.id} value={opt.value}>{opt.value}</option>
                ))}
              </select>
            </div>
            <div>
              <select 
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/40"
              >
                <option value="all">All Modules</option>
                {moduleOptions.map(opt => (
                  <option key={opt.id} value={opt.value}>{opt.value}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-border/30">
            {[
              { label: "All Tasks", value: "all" },
              { label: "Active", value: "active" },
              { label: "Completed", value: "completed" }
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                className={`px-3.5 py-1.5 text-xs font-semibold tracking-wider rounded-lg transition-all ${
                  filterStatus === tab.value 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/10 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Minimalist Checklist Board */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-xs font-semibold uppercase tracking-wider">Streaming public DB...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card/20 py-16 px-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground/35 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">All Clear</h4>
            <p className="text-xs text-muted-foreground mt-1">No logged issues match current criteria.</p>
          </div>
        ) : (
          <m.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {filteredItems.map((item) => {
              const isExpanded = expandedItemId === item.id;
              
              return (
                <m.div
                  key={item.id}
                  variants={itemVariants}
                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  className={`group rounded-xl border transition-all cursor-pointer overflow-hidden ${
                    item.is_completed 
                      ? "border-emerald-500/20 bg-emerald-500/[0.02]" 
                      : isExpanded 
                        ? "border-primary/45 bg-card/35 shadow-sm" 
                        : "border-border bg-card/15 hover:border-border-hover hover:bg-card/25"
                  }`}
                >
                  <div className="flex items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Checkbox */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(item);
                        }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          item.is_completed 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        {item.is_completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      {/* Summary */}
                      <div className="min-w-0">
                        <span className={`text-sm sm:text-base font-semibold transition-all break-words ${
                          item.is_completed 
                            ? "text-muted-foreground/50 line-through decoration-muted-foreground/30" 
                            : "text-foreground"
                        }`}>
                          {item.problem}
                        </span>
                        
                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {item.module && (
                            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                              {item.module}
                            </span>
                          )}
                          {item.user_role && (
                            <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full border border-border/80">
                              {item.user_role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action controls */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={(e) => handleCopyItem(item, e)}
                          className="p-1.5 hover:bg-muted/70 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy Details"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleEditClick(item, e)}
                          className="p-1.5 hover:bg-muted/70 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="p-1.5 hover:bg-rose-500/15 rounded-lg text-muted-foreground hover:text-rose-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-muted-foreground/50">
                        {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Notes */}
                  {isExpanded && (
                    <m.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="px-4 pb-4 pt-2 border-t border-border/25 bg-background/20"
                    >

                      
                      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground/50 border-t border-border/20 pt-2">
                        <span>Logged: {new Date(item.created_at).toLocaleString()}</span>
                        {item.updated_at !== item.created_at && (
                          <span>Updated: {new Date(item.updated_at).toLocaleString()}</span>
                        )}
                      </div>

                      {/* Small mobile action triggers */}
                      <div className="flex sm:hidden justify-end gap-2 mt-3.5 pt-2 border-t border-border/20">
                        <button
                          onClick={(e) => handleCopyItem(item, e)}
                          className="text-xs font-semibold px-3 py-1 border border-border/50 rounded-lg hover:bg-muted/40 flex items-center gap-1.5"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        <button
                          onClick={(e) => handleEditClick(item, e)}
                          className="text-xs font-semibold px-3 py-1 border border-border/50 rounded-lg hover:bg-muted/40 flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-xs font-semibold px-3 py-1 border border-rose-500/20 text-rose-500 rounded-lg hover:bg-rose-500/5 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </m.div>
                  )}
                </m.div>
              );
            })}
          </m.div>
        )}
      </div>

      {/* Dialog: Edit Checklist Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <m.div 
            key="edit-modal-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
              onClick={() => setEditingItem(null)}
            />
            
            <m.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl z-10"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">Edit Task</h3>
                <button onClick={() => setEditingItem(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Problem Description</label>
                  <input 
                    type="text" 
                    value={editProblem}
                    onChange={(e) => setEditProblem(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">User Role</label>
                    <select 
                      value={editRole}
                      onChange={(e) => {
                        setEditRole(e.target.value);
                        if (e.target.value !== "custom") setEditCustomRole("");
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="">None</option>
                      {roleOptions.map(opt => (
                        <option key={opt.id} value={opt.value}>{opt.value}</option>
                      ))}
                      <option value="custom" className="text-primary font-bold">+ Custom...</option>
                    </select>
                    {editRole === "custom" && (
                      <input 
                        type="text" 
                        value={editCustomRole}
                        onChange={(e) => setEditCustomRole(e.target.value)}
                        placeholder="Custom role..."
                        className="w-full h-10 mt-2 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Module</label>
                    <select 
                      value={editModule}
                      onChange={(e) => {
                        setEditModule(e.target.value);
                        if (e.target.value !== "custom") setEditCustomModule("");
                      }}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="">None</option>
                      {moduleOptions.map(opt => (
                        <option key={opt.id} value={opt.value}>{opt.value}</option>
                      ))}
                      <option value="custom" className="text-primary font-bold">+ Custom...</option>
                    </select>
                    {editModule === "custom" && (
                      <input 
                        type="text" 
                        value={editCustomModule}
                        onChange={(e) => setEditCustomModule(e.target.value)}
                        placeholder="Custom module..."
                        className="w-full h-10 mt-2 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                      />
                    )}
                  </div>
                </div>



                <div className="flex gap-2 justify-end pt-1">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setEditingItem(null)}
                    className="h-9 px-4 text-xs rounded-lg font-semibold text-muted-foreground hover:bg-muted/10"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 px-4 rounded-lg shadow-none"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Save Changes
                  </Button>
                </div>
              </form>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Floating Action Settings Gear (Developer Sandbox Modal Trigger) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            setIsSettingsOpen(true);
            setDevStatus("IDLE");
            setDevLogs([]);
          }}
          className="w-12 h-12 rounded-full border border-border bg-card/90 text-muted-foreground hover:text-foreground flex items-center justify-center shadow-lg transition-all hover:scale-105"
          title="Sandbox System Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Modal (Developer Console Dashboard fallback) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <m.div 
            key="settings-modal-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
              onClick={() => { if (!isRunningDevAction) setIsSettingsOpen(false); }}
            />
            
            <m.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl z-10 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-500" />
                  <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">Sandbox Controls</h3>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  disabled={isRunningDevAction}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                Developer sandbox data operations. Delete data, reseed templates, or sync options.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
                <Button 
                  onClick={() => handleDevActionClick("seed")}
                  disabled={isRunningDevAction}
                  className="h-9 text-xs font-semibold uppercase tracking-wider rounded bg-primary hover:bg-primary/90 text-primary-foreground shadow-none"
                >
                  Full Seed
                </Button>
                <Button 
                  onClick={() => handleDevActionClick("clear")}
                  disabled={isRunningDevAction}
                  variant="outline"
                  className="h-9 text-xs font-semibold uppercase tracking-wider rounded border-rose-500/25 text-rose-500 hover:bg-rose-500/5 shadow-none"
                >
                  Purge All
                </Button>
                <Button 
                  onClick={() => handleDevActionClick("seed-catalog")}
                  disabled={isRunningDevAction}
                  variant="outline"
                  className="h-9 text-xs font-semibold uppercase tracking-wider rounded border-border text-foreground hover:bg-muted/40 shadow-none"
                >
                  Seed Catalog
                </Button>
                <Button 
                  onClick={() => handleDevActionClick("clear-catalog")}
                  disabled={isRunningDevAction}
                  variant="outline"
                  className="h-9 text-xs font-semibold uppercase tracking-wider rounded border-border text-foreground hover:bg-muted/40 shadow-none"
                >
                  Wipe Catalog
                </Button>
                <Button 
                  onClick={() => handleDevActionClick("seed-logs-borrows")}
                  disabled={isRunningDevAction}
                  variant="outline"
                  className="h-9 text-xs font-semibold uppercase tracking-wider rounded border-border text-foreground hover:bg-muted/40 shadow-none"
                >
                  Seed History
                </Button>
                <Button 
                  onClick={() => handleDevActionClick("clear-logs-borrows")}
                  disabled={isRunningDevAction}
                  variant="outline"
                  className="h-9 text-xs font-semibold uppercase tracking-wider rounded border-border text-foreground hover:bg-muted/40 shadow-none"
                >
                  Wipe History
                </Button>
              </div>

              {/* Console Log terminal inside settings */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col">
                <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-400">Stdout logs</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                      devStatus === "IDLE" ? "bg-zinc-800 text-zinc-400" :
                      devStatus === "RUNNING" ? "bg-indigo-950 text-indigo-300 animate-pulse" :
                      devStatus === "SUCCESS" ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"
                    }`}>
                      {devStatus}
                    </span>
                  </div>
                </div>
                <div 
                  ref={logContainerRef}
                  className="p-4 h-[160px] overflow-y-auto font-mono text-[10px] leading-relaxed text-zinc-400 bg-zinc-950 space-y-1.5"
                >
                  {devLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-700 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-35 font-mono">Console Idle</p>
                    </div>
                  ) : (
                    devLogs.map((log, index) => {
                      const isError = log.includes("❌") || log.includes("⚠️") || log.includes("Error");
                      const isSuccess = log.includes("✅") || log.includes("✨") || log.includes("🎉");
                      
                      let color = "text-zinc-300";
                      if (isError) color = "text-rose-400";
                      else if (isSuccess) color = "text-emerald-400";
                      else if (log.includes("🚀")) color = "text-indigo-400";

                      return <div key={index} className={`${color} whitespace-pre-wrap break-all`}>{log}</div>;
                    })
                  )}
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dev Action Modal */}
      <AnimatePresence>
        {showConfirmModal && devActionType && (
          <m.div 
            key="confirm-modal-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
              onClick={() => setShowConfirmModal(false)}
            />
            
            <m.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl z-10"
            >
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">Confirm Sandbox Action</h3>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                {ACTIONS_CONFIG[devActionType].confirmText}
                <br /><br />
                <span className="text-rose-500 font-bold">This operation deletes database records and cannot be undone.</span>
              </p>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowConfirmModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs font-semibold h-8 px-3"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={executeDevAction}
                  className={ACTIONS_CONFIG[devActionType].type === "seed" 
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold h-8 px-4 shadow-none"
                    : "bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-8 px-4 shadow-none"
                  }
                >
                  Execute
                </Button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

    </div>
  );
}
