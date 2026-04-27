"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  ChevronRight, 
  ShieldCheck, 
  History, 
  Ticket, 
  HelpCircle, 
  User, 
  Settings, 
  RefreshCw
} from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { cn } from "@/lib/utils";
import { PolicySimulationPanel } from "../PolicySimulationPanel";
import { PolicyCommitModal } from "../PolicyCommitModal";
import { PolicyField } from "./PolicyField";
import { PreferencesPanel } from "./PreferencesPanel";
import { AnnualResetTool } from "../../settings/SettingsShared";

const CATEGORY_MAP: Record<string, { label: string; icon: React.ElementType; group: string }> = {
  circulation: { label: "Circulation", icon: History, group: "System Core" },
  reservations: { label: "Reservations", icon: Ticket, group: "System Core" },
  identity: { label: "Identity", icon: User, group: "System Data" },
  support: { label: "Support", icon: HelpCircle, group: "Customer Experience" },
  preferences: { label: "Preferences", icon: Settings, group: "Customer Experience" },
  lifecycle: { label: "Lifecycle", icon: RefreshCw, group: "Maintenance" },
};

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



  // Defined the full set of categories in order
  const sidebarItems = useMemo(() => [
    { id: "circulation", ...CATEGORY_MAP.circulation },
    { id: "reservations", ...CATEGORY_MAP.reservations },
    { id: "identity", ...CATEGORY_MAP.identity },
    { id: "support", ...CATEGORY_MAP.support },
    { id: "preferences", ...CATEGORY_MAP.preferences },
    { id: "lifecycle", ...CATEGORY_MAP.lifecycle },
  ], []);

  const groupedSidebar = useMemo(() => {
    const groups: Record<string, typeof sidebarItems> = {};
    sidebarItems.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [sidebarItems]);

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

      <div className="grid gap-8 lg:grid-cols-[200px_1fr_280px] items-start">
        {/* Mobile Category Navigation */}
        <div className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar pb-2">
          <div className="flex gap-2 min-w-max">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveCategory(item.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border",
                  activeCategory === item.id 
                    ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                    : "bg-card/50 text-muted-foreground border-border/40 hover:border-primary/20"
                )}
              >
                <item.icon size={12} className="shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block space-y-6">
          {Object.entries(groupedSidebar).map(([group, items]) => (
            <div key={group} className="space-y-2">
              <p className="px-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 border-l-2 border-primary/20 ml-1">
                {group}
              </p>
              <div className="space-y-1">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveCategory(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all group",
                      activeCategory === item.id 
                        ? "bg-primary/10 text-primary shadow-sm" 
                        : "text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <item.icon size={14} className={cn(
                      "shrink-0 transition-colors",
                      activeCategory === item.id ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
                    )} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {activeCategory === item.id && <ChevronRight className="h-3 w-3 animate-in fade-in slide-in-from-left-1" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* ── Content ───────────────────────────────────────────── */}
        <main className="min-w-0 space-y-6">
           <div className="grid gap-4">
              {activeCategory === "preferences" ? (
                <PreferencesPanel />
              ) : activeCategory === "lifecycle" ? (
                <div className="rounded-2xl border border-border/40 bg-card/30 p-6 shadow-none">
                  <AnnualResetTool />
                </div>
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

        {/* ── Simulation (Hidden on mobile by grid/aside) ───────── */}
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
