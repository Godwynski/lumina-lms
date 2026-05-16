"use client";

import { use, useMemo, useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  ShieldCheck, 
  History, 
  Ticket, 
  HelpCircle, 
  User, 
  RefreshCw,
  Megaphone,
  Tag
} from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { cn } from "@/lib/utils";
import { PolicyCommitModal } from "../PolicyCommitModal";
import { CategoryManagement } from "../CategoryManagement";
import { PolicySimulationPanel } from "../PolicySimulationPanel";
import { PolicyField } from "./PolicyField";
import { AnnualResetTool, RunMaintenanceTool, TestEmailTool } from "../../settings/SettingsShared";
import { SystemAnnouncement } from "../system-announcement";

import { TooltipProvider } from "@/components/ui/tooltip";

const CATEGORY_MAP: Record<string, { label: string; icon: React.ElementType; group: string }> = {
  circulation: { label: "Circulation", icon: History, group: "System Core" },
  reservations: { label: "Reservations", icon: Ticket, group: "System Core" },
  identity: { label: "Identity", icon: User, group: "System Data" },
  categories: { label: "Categories", icon: Tag, group: "System Data" },
  broadcasts: { label: "Broadcasts", icon: Megaphone, group: "Communication" },
  support: { label: "Support", icon: HelpCircle, group: "Communication" },
  lifecycle: { label: "Lifecycle", icon: RefreshCw, group: "Operations" },
};

import { PolicySetting, Category } from "@/types/admin";

export function PolicyLayout({
  settings,
  canEdit,
  role,
  categoriesPromise,
}: {
  settings: PolicySetting[];
  canEdit: boolean;
  role: string;
  categoriesPromise: Promise<Category[]> | PromiseLike<Category[]>;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("circulation");
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);

  // Realtime synchronization
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('policies-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings' },
        () => {
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

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
  const sidebarItems = useMemo(() => {
    const items = [
      { id: "circulation", ...CATEGORY_MAP.circulation },
      { id: "reservations", ...CATEGORY_MAP.reservations },
      { id: "identity", ...CATEGORY_MAP.identity },
      { id: "categories", ...CATEGORY_MAP.categories },
      { id: "broadcasts", ...CATEGORY_MAP.broadcasts },
      { id: "support", ...CATEGORY_MAP.support },
    ];

    if (role === "admin" || role === "librarian") {
      items.push({ id: "lifecycle", ...CATEGORY_MAP.lifecycle });
    }

    return items;
  }, [role]);

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
          <div className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 px-4 py-2 text-[10px] font-bold text-primary/80">
            <ShieldCheck size={14} />
            Changes synchronized
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr] items-start">
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
        <aside className="hidden lg:block space-y-8 sticky top-12">
          {Object.entries(groupedSidebar).map(([group, items]) => (
            <div key={group} className="space-y-2">
              <p className="px-4 text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveCategory(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all group relative",
                      activeCategory === item.id 
                        ? "text-primary font-semibold bg-primary/5" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    {activeCategory === item.id && (
                      <div className="absolute left-0 w-1 h-4 bg-primary rounded-r-full" />
                    )}
                    <item.icon size={16} className={cn(
                      "shrink-0 transition-colors",
                      activeCategory === item.id ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
                    )} />
                    <span className="flex-1 text-left font-bold uppercase tracking-widest text-[10px]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* ── Content ───────────────────────────────────────────── */}
        <main className="min-w-0">
           <div className="max-w-3xl">
             <TooltipProvider>
              {activeCategory === "broadcasts" ? (
                <div className="space-y-12">
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Megaphone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Global Announcement</h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Broadcast an immediate notification message to all student dashboards.</p>
                      </div>
                    </div>
                    <div className="p-6 rounded-2xl border border-border/40 bg-muted/5 shadow-sm">
                      <SystemAnnouncement />
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Trigger Policies</h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Set the rules for automated system alerts and borrowing reminders.</p>
                      </div>
                    </div>
                    <div className="space-y-0">
                      {activeKeys.map(key => (
                        <PolicyField 
                          key={key}
                          policyKey={key}
                          value={formData[key]}
                          initialValue={initialValues[key]}
                          onChange={(val) => handleChange(key, val)}
                          disabled={!canEdit}
                          loading={loading}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              ) : activeCategory === "categories" ? (
                <div className="space-y-6">
                  <Suspense fallback={<div className="h-48 w-full animate-pulse bg-muted/40 rounded-xl" />}>
                     <CategoryManagementWrapper promise={categoriesPromise} />
                  </Suspense>
                </div>
              ) : activeCategory === "lifecycle" ? (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl border border-border/40 bg-muted/5">
                    <AnnualResetTool />
                  </div>
                  <div className="p-6 rounded-2xl border border-border/40 bg-muted/5">
                    <RunMaintenanceTool />
                  </div>
                  <div className="p-6 rounded-2xl border border-border/40 bg-muted/5">
                    <TestEmailTool />
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {activeKeys.map(key => (
                    <PolicyField 
                      key={key}
                      policyKey={key}
                      value={formData[key]}
                      initialValue={initialValues[key]}
                      onChange={(val) => handleChange(key, val)}
                      disabled={!canEdit}
                      loading={loading}
                    />
                  ))}
                  {activeCategory === "reservations" && (
                    <div className="mt-12 pt-12 border-t border-border/40">
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-foreground">Simulation Engine</h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Preview the impact of reservation policies on system throughput.</p>
                      </div>
                      <PolicySimulationPanel formData={formData} />
                    </div>
                  )}
                </div>
              )}
             </TooltipProvider>
           </div>
        </main>


      </div>

      {/* ── Floating Review Bar ───────────────────────────────── */}
      {canEdit && changedKeys.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-background/90 p-2 pl-5 shadow-2xl backdrop-blur-xl">
             <div className="flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
                  {changedKeys.length} unsaved changes
                </span>
             </div>
             <Button
                onClick={() => setIsCommitModalOpen(true)}
                className="h-9 rounded-xl px-5 text-[10px] font-bold uppercase tracking-widest shadow-sm active:scale-[0.98] transition-all"
             >
                Review Changes
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

function CategoryManagementWrapper({ promise }: { promise: Promise<Category[]> | PromiseLike<Category[]> }) {
  const categories = use(promise);
  return <CategoryManagement initialCategories={Array.isArray(categories) ? categories : []} />;
}


