"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronRight, ShieldCheck } from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { cn } from "@/lib/utils";
import { PolicySimulationPanel } from "../PolicySimulationPanel";
import { PolicyCommitModal } from "../PolicyCommitModal";
import { PolicyField } from "./PolicyField";
import { PreferencesPanel } from "./PreferencesPanel";

interface PolicySetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export function PolicyLayout({
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

  // Add the preferences category
  const allCategories = [...categories, "preferences"];

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
          <p className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Configuration Engine</p>
          {allCategories.map(cat => (
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
              {activeCategory === "preferences" ? (
                <PreferencesPanel />
              ) : (
                activeKeys.map(key => (
                  <PolicyField 
                    key={key}
                    policyKey={key}
                    value={formData[key]}
                    onChange={(val) => handleChange(key, val)}
                    disabled={!canEdit}
                    loading={loading}
                  />
                ))
              )}
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
