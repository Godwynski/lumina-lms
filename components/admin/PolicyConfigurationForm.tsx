"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle, Calendar, BookCopy, RotateCw, History, Clock, Ticket, HelpCircle, MessageSquare, ChevronRight, ShieldCheck, User, Info, Plus, X, Trash2, Edit3 } from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PolicySimulationPanel } from "./PolicySimulationPanel";
import { PolicyCommitModal } from "./PolicyCommitModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PolicySetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

const ICONS = {
  Calendar,
  BookCopy,
  RotateCw,
  History,
  Clock,
  Ticket,
  HelpCircle,
  MessageSquare,
  User
};

type PolicyKey = keyof typeof DEFAULT_POLICIES;

export function PolicyConfigurationForm({
  settings,
  canEdit,
}: {
  settings: PolicySetting[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("circulation");
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);

  const initialValues = useMemo(() => {
    const byKey = new Map(settings.map((s) => [s.key, s.value]));
    const values: Record<string, string> = {};
    for (const [key, config] of Object.entries(DEFAULT_POLICIES)) {
      values[key] = byKey.get(key) ?? config.value;
    }
    return values;
  }, [settings]);

  const [formData, setFormData] = useState<Record<string, string>>(initialValues);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changedKeys = useMemo(
    () => Object.keys(DEFAULT_POLICIES).filter((key) => (formData[key] ?? "") !== (initialValues[key] ?? "")),
    [formData, initialValues],
  );

  const categories = useMemo(() => {
    const cats = new Set(Object.values(DEFAULT_POLICIES).map(p => p.category));
    return Array.from(cats);
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const handleConfirmCommit = async (reason: string) => {
    if (!canEdit) return;

    setLoading(true);
    setError(null);
    setIsCommitModalOpen(false);

    try {
      for (const key of changedKeys) {
        const value = formData[key];
        const description = DEFAULT_POLICIES[key as keyof typeof DEFAULT_POLICIES]?.description;

        const response = await fetch("/api/admin/policy-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value, description, reason }),
        });

        if (!response.ok) {
          throw new Error("Failed to save some settings");
        }
      }

      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const renderField = (key: string) => {
    const config = DEFAULT_POLICIES[key as PolicyKey];
    const Icon = ICONS[config.icon as keyof typeof ICONS] || HelpCircle;
    
    // Type detection
    const isSlider = key === "max_borrow_limit" || key === "max_renewal_count";
    const isDays = key.includes("days");
    const isIdentityList = config.category === "identity";
    const isSupportFAQ = config.category === "support" && key === "student_faq_list";
    
    const labelText = ('label' in config ? config.label : undefined) || key.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace("Loan", "Borrow");

    return (
      <TooltipProvider key={key}>
        <Card className={cn(
          "group relative border-border/40 bg-card/30 p-4 shadow-none transition-all hover:bg-card/50 hover:border-primary/10 rounded-2xl",
          isSupportFAQ && "md:col-span-1"
        )}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-7 w-7 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-colors shrink-0">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/70">{labelText}</Label>
                    {'example' in config && config.example && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/40 hover:text-primary cursor-help transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-[10px] font-medium leading-relaxed rounded-xl border-border/40 shadow-xl p-3">
                          {config.example}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/80">{config.description}</p>
                </div>
              </div>
            
            <div className="pt-1">
              {isSlider ? (
                <div className="flex items-center gap-4">
                  <Slider
                    max={15}
                    step={1}
                    value={[parseInt(formData[key] || "0")]}
                    onValueChange={(vals) => handleChange(key, vals[0].toString())}
                    disabled={loading || !canEdit}
                    className="flex-1 h-6 hover:cursor-pointer"
                  />
                  <span className="min-w-[2rem] text-right text-xs font-black text-primary">{formData[key] || "0"}</span>
                </div>
              ) : isIdentityList ? (
                <IdentityListManager
                  value={formData[key] || ""}
                  onChange={(val) => handleChange(key, val)}
                  disabled={loading || !canEdit}
                />
              ) : isSupportFAQ ? (
                <SupportFAQManager
                  value={formData[key] || ""}
                  onChange={(val) => handleChange(key, val)}
                  disabled={loading || !canEdit}
                />
              ) : (
                <div className="relative">
                  <Input
                    type={isDays ? "number" : "text"}
                    value={formData[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    disabled={loading || !canEdit}
                    className="h-11 rounded-xl border-border/40 bg-muted/10 text-xs font-black text-primary focus:bg-background transition-all px-4 pr-12"
                  />
                  {isDays && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-muted-foreground pointer-events-none">Days</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </Card>
      </TooltipProvider>
    );
  };

  const activeKeys = Object.keys(DEFAULT_POLICIES).filter(k => DEFAULT_POLICIES[k as keyof typeof DEFAULT_POLICIES].category === activeCategory);

  return (
    <div className="w-full max-w-6xl mx-auto pb-12">
      <div className="mb-4 space-y-2">
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[10px] font-bold text-destructive">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-[10px] font-bold text-emerald-600">
            <ShieldCheck size={14} />
            Policies synchronized.
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_1fr_280px] items-start">
        <aside className="space-y-1">
          <p className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Policy Engine</p>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                activeCategory === cat 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {cat}
              {activeCategory === cat && <ChevronRight className="h-3 w-3" />}
            </button>
          ))}
        </aside>

        {/* ── Content ───────────────────────────────────────────── */}
        <main className="min-w-0 space-y-6">
           <div className="grid gap-4">
              {activeKeys.map(key => renderField(key))}
           </div>
        </main>

        {/* ── Simulation ────────────────────────────────────────── */}
        <aside className="hidden lg:block">
           <PolicySimulationPanel formData={formData} />
        </aside>
      </div>

      {/* ── Floating Review Bar ───────────────────────────────── */}
      {canEdit && changedKeys.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/90 p-1.5 pl-4 shadow-2xl backdrop-blur-xl">
             <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-foreground">
                  {changedKeys.length} Changes
                </span>
             </div>
             <Button
                onClick={() => setIsCommitModalOpen(true)}
                className="h-9 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/10"
             >
                Commit
             </Button>
          </div>
        </div>
      )}

      <PolicyCommitModal
        isOpen={isCommitModalOpen}
        onClose={() => setIsCommitModalOpen(false)}
        onConfirm={handleConfirmCommit}
        changedKeys={changedKeys}
        initialValues={initialValues}
        formData={formData}
        loading={loading}
      />
    </div>
  );
}

function IdentityListManager({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  disabled: boolean; 
}) {
  const [newItem, setNewItem] = useState("");
  
  const items = useMemo(() => {
    try {
      if (value.startsWith("[") && value.endsWith("]")) {
        return JSON.parse(value) as string[];
      }
      return value.split(",").map(i => i.trim()).filter(Boolean);
    } catch {
      return value.split(",").map(i => i.trim()).filter(Boolean);
    }
  }, [value]);

  const addItem = () => {
    if (!newItem.trim() || items.includes(newItem.trim())) return;
    const updated = [...items, newItem.trim()];
    onChange(JSON.stringify(updated));
    setNewItem("");
  };

  const removeItem = (item: string) => {
    const updated = items.filter(i => i !== item);
    onChange(JSON.stringify(updated));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge 
            key={item} 
            variant="secondary" 
            className="group/badge h-7 pl-3 pr-1 py-0 rounded-lg bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-wider"
          >
            {item}
            <button
              onClick={() => removeItem(item)}
              disabled={disabled}
              className="ml-2 h-5 w-5 rounded-md flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <X size={10} />
            </button>
          </Badge>
        ))}
        {items.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">No items added yet.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add new identity option..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          disabled={disabled}
          className="h-10 rounded-xl border-border/40 bg-muted/10 text-[11px] font-medium focus:bg-background transition-all px-4"
        />
        <Button
          type="button"
          onClick={addItem}
          disabled={disabled || !newItem.trim()}
          size="icon"
          className="h-10 w-10 rounded-xl shadow-lg shadow-primary/10"
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}

function SupportFAQManager({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  disabled: boolean; 
}) {
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const faqs = useMemo(() => {
    try {
      if (value.startsWith("[") && value.endsWith("]")) {
        return JSON.parse(value) as { question: string; answer: string }[];
      }
      return [];
    } catch {
      return [];
    }
  }, [value]);

  const addOrUpdateFAQ = () => {
    if (!newQ.trim() || !newA.trim()) return;
    
    let updated;
    if (editingIndex !== null) {
      updated = [...faqs];
      updated[editingIndex] = { question: newQ.trim(), answer: newA.trim() };
      setEditingIndex(null);
    } else {
      updated = [...faqs, { question: newQ.trim(), answer: newA.trim() }];
    }
    
    onChange(JSON.stringify(updated));
    setNewQ("");
    setNewA("");
  };

  const removeFAQ = (index: number) => {
    const updated = faqs.filter((_, i) => i !== index);
    onChange(JSON.stringify(updated));
  };

  const startEdit = (index: number) => {
    setNewQ(faqs[index].question);
    setNewA(faqs[index].answer);
    setEditingIndex(index);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        {faqs.map((faq, i) => (
          <div key={i} className="group/faq relative rounded-xl border border-border/30 bg-muted/5 p-3 transition-all hover:bg-muted/10">
            <div className="flex justify-between gap-3">
               <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-foreground/90 uppercase tracking-wider mb-0.5">Q: {faq.question}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">A: {faq.answer}</p>
               </div>
               <div className="flex gap-0.5 opacity-0 group-hover/faq:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => startEdit(i)} disabled={disabled}>
                    <Edit3 size={10} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/5" onClick={() => removeFAQ(i)} disabled={disabled}>
                    <Trash2 size={10} />
                  </Button>
               </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 space-y-3">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[9px] font-bold uppercase text-primary/60 ml-1">Question</Label>
            <Input
              placeholder="Question..."
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              disabled={disabled}
              className="h-8 rounded-lg border-border/30 bg-background text-[10px] font-medium px-3"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] font-bold uppercase text-primary/60 ml-1">Answer</Label>
            <Textarea
              placeholder="Answer..."
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              disabled={disabled}
              className="min-h-[60px] rounded-lg border-border/30 bg-background text-[10px] font-medium p-3 resize-none"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={addOrUpdateFAQ}
          disabled={disabled || !newQ.trim() || !newA.trim()}
          className="w-full h-8 rounded-lg gap-2 text-[9px] font-black uppercase tracking-widest"
        >
          {editingIndex !== null ? <ShieldCheck size={12} /> : <Plus size={12} />}
          {editingIndex !== null ? "Update Entry" : "Add Entry"}
        </Button>
        {editingIndex !== null && (
          <Button variant="ghost" className="w-full h-8 text-[10px] font-bold" onClick={() => {setEditingIndex(null); setNewQ(""); setNewA("");}}>
            Cancel Editing
          </Button>
        )}
      </div>
    </div>
  );
}
