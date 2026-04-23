"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle, Calendar, BookCopy, RotateCw, History, Clock, Ticket, HelpCircle, MessageSquare, ChevronRight, ShieldCheck } from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { PolicySimulationPanel } from "./PolicySimulationPanel";
import { PolicyCommitModal } from "./PolicyCommitModal";

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
  MessageSquare
};

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
    const config = DEFAULT_POLICIES[key as keyof typeof DEFAULT_POLICIES];
    const Icon = ICONS[config.icon as keyof typeof ICONS] || HelpCircle;
    const isSlider = key === "max_borrow_limit" || key === "max_renewal_count";
    const isDays = key.includes("days");
    const labelText = key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace("Loan", "Borrow");

    return (
      <Card key={key} className="group relative border-border/50 bg-card/40 p-6 shadow-none transition-all hover:bg-card hover:border-primary/20 rounded-3xl">
        <div className="flex items-start gap-4">
          <div className="mt-1 h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-colors">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground/80">{labelText}</Label>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{config.description}</p>
            </div>
            
            {isSlider ? (
              <div className="flex items-center gap-4 pt-2">
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
            ) : config.category === 'support' && key.includes('_a') ? (
              <Input
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={loading || !canEdit}
                className="h-11 rounded-xl border-border/40 bg-muted/10 text-xs font-medium focus:bg-background transition-all px-4"
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
      </Card>
    );
  };

  const activeKeys = Object.keys(DEFAULT_POLICIES).filter(k => DEFAULT_POLICIES[k as keyof typeof DEFAULT_POLICIES].category === activeCategory);

  return (
    <div className="w-full max-w-7xl mx-auto pb-32">
      {/* ── Status Messages ────────────────────────────────────── */}
      <div className="mb-8 space-y-4">
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-4 text-xs font-bold text-destructive animate-in fade-in slide-in-from-top-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-4 text-xs font-bold text-emerald-600 animate-in fade-in slide-in-from-top-4">
            <ShieldCheck size={16} />
            System policies synchronized successfully.
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr_320px] items-start">
        {/* ── Navigation ────────────────────────────────────────── */}
        <aside className="space-y-1">
          <p className="px-3 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Categories</p>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all",
                activeCategory === cat 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
          <div className="flex items-center justify-between gap-6 rounded-3xl border border-border/80 bg-background/80 p-2.5 pl-6 shadow-2xl backdrop-blur-xl">
             <div className="flex items-center gap-3">
               <div className="relative">
                 <div className="h-2 w-2 rounded-full bg-primary animate-ping absolute inset-0" />
                 <div className="h-2 w-2 rounded-full bg-primary relative" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground">
                 {changedKeys.length} Unsaved Changes
               </span>
             </div>
             <Button
                onClick={() => setIsCommitModalOpen(true)}
                className="h-11 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all"
             >
                Review Changes
             </Button>
          </div>
        </div>
      )}

      {/* ── Commit Dialog ─────────────────────────────────────── */}
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

