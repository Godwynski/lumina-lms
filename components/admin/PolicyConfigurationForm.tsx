"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle, Check, Loader2, DollarSign } from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface PolicySetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export function PolicyConfigurationForm({
  settings,
  canEdit,
}: {
  settings: PolicySetting[];
  canEdit: boolean;
}) {
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

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const handleSaveAll = async () => {
    if (!canEdit) {
      setError("You have read-only access to policies.");
      return;
    }

    if (changedKeys.length === 0) {
      return;
    }

    for (const key of changedKeys) {
      if (!formData[key]) {
        setError(`${key} cannot be empty`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      for (const key of changedKeys) {
        const value = formData[key];
        const description = DEFAULT_POLICIES[key as keyof typeof DEFAULT_POLICIES]?.description;

        const response = await fetch("/api/admin/policy-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value, description }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "Failed to save settings");
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const borrowKeys = ["loan_period_days", "max_borrow_limit", "max_renewal_count", "max_reservations_per_student", "hold_expiry_days", "renewal_period_days"];
  const fineKeys = ["overdue_fine_per_day", "fine_cap_amount"];
  const faqKeys = Object.keys(DEFAULT_POLICIES).filter(k => k.startsWith("faq_"));

  const renderField = (key: string) => {
    const config = DEFAULT_POLICIES[key as keyof typeof DEFAULT_POLICIES];
    const isSlider = key === "max_borrow_limit" || key === "max_renewal_count";
    const isCurrency = key.includes("fine");
    const isDays = key.includes("days");
    const isFaqA = key.includes("_a");
    const labelText = key
      .replace("loan", "borrow") // Changed from loan to borrow
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return (
      <Card key={key} className="border-border bg-card p-5 shadow-sm transition-all hover:border-primary/20">
        <div className="space-y-4">
          <div>
            <Label className="text-[11px] font-bold uppercase tracking-wider text-foreground">{labelText}</Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{config.description}</p>
          </div>
          
          {isSlider ? (
            <div className="flex items-center gap-5 pt-2">
              <Slider
                max={15}
                step={1}
                value={[parseInt(formData[key] || "0")]}
                onValueChange={(vals) => handleChange(key, vals[0].toString())}
                disabled={loading || !canEdit}
                className="flex-1"
              />
              <span className="min-w-[2rem] text-right text-sm font-black text-primary">{formData[key] || "0"}</span>
            </div>
          ) : isFaqA ? (
            <Textarea
              value={formData[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={loading || !canEdit}
              className="min-h-[100px] resize-none border-border/50 bg-muted/20 text-xs leading-relaxed focus:bg-background transition-all"
              placeholder={config.value}
            />
          ) : (
            <div className="relative pt-1">
              {isCurrency && (
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              )}
              <Input
                type={isCurrency || isDays ? "number" : "text"}
                step={isCurrency ? "0.01" : "1"}
                min={isCurrency ? "0" : "1"}
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={loading || !canEdit}
                className={cn(
                  "h-10 rounded-lg w-full text-xs font-medium border-border/50 bg-muted/20 focus:bg-background transition-all",
                  isCurrency ? "pl-9" : "px-3"
                )}
                placeholder={config.value}
              />
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Feedback Messages */}
      <div className="space-y-4">
        {error && (
          <div className="status-danger flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} className="shrink-0" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {saved && (
          <div className="status-success flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm animate-in fade-in slide-in-from-top-2 text-emerald-700">
            <Check size={18} className="shrink-0" />
            <p className="font-semibold">All policies updated successfully.</p>
          </div>
        )}
      </div>

      <Tabs defaultValue="borrow" className="w-full">
        <div className="flex justify-start">
          <TabsList className="mb-6 h-11 items-center rounded-2xl bg-muted/50 p-1 border border-border/40">
            <TabsTrigger value="borrow" className="rounded-xl px-5 py-1.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">Borrow Rules</TabsTrigger>
            <TabsTrigger value="fines" className="rounded-xl px-5 py-1.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">Fines & Penalties</TabsTrigger>
            <TabsTrigger value="faqs" className="rounded-xl px-5 py-1.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">Student FAQs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="borrow" className="focus-visible:outline-none">
          <div className="grid gap-6 sm:grid-cols-2">
            {borrowKeys.map((key) => renderField(key))}
          </div>
        </TabsContent>

        <TabsContent value="fines" className="focus-visible:outline-none">
          <div className="grid gap-6 sm:grid-cols-2">
            {fineKeys.map((key) => renderField(key))}
          </div>
        </TabsContent>

        <TabsContent value="faqs" className="focus-visible:outline-none">
          <div className="grid gap-6 sm:grid-cols-2">
            {faqKeys.map((key) => renderField(key))}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Floating Save Indicator */}
      {canEdit && changedKeys.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex items-center gap-4 rounded-3xl border border-border bg-background/95 p-2 px-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 pl-3">
               <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
               <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                 {changedKeys.length} Modified Rules
               </span>
            </div>
            <Button
              onClick={handleSaveAll}
              disabled={loading || changedKeys.length === 0}
              size="sm"
              className="h-10 rounded-xl px-4 text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />}
              {loading ? "Committing..." : "Commit Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

