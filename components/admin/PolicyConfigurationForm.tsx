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

  const borrowKeys = ["default_loan_period_days", "max_borrow_limit", "max_renewal_count", "max_reservations_per_student", "hold_expiry_days", "renewal_period_days"];
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
      <Card key={key} className="border-border bg-card p-4 shadow-sm">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-foreground">{labelText}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{config.description}</p>
          </div>
          
          {isSlider ? (
            <div className="flex items-center gap-4">
              <Slider
                max={15}
                step={1}
                value={[parseInt(formData[key] || "0")]}
                onValueChange={(vals) => handleChange(key, vals[0].toString())}
                disabled={loading || !canEdit}
                className="flex-1"
              />
              <span className="w-8 text-right text-sm font-medium">{formData[key] || "0"}</span>
            </div>
          ) : isFaqA ? (
            <Textarea
              value={formData[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={loading || !canEdit}
              className="min-h-[80px]"
              placeholder={config.value}
            />
          ) : (
            <div className="relative">
              {isCurrency && (
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <Input
                type={isCurrency || isDays ? "number" : "text"}
                step={isCurrency ? "0.01" : "1"}
                min={isCurrency ? "0" : "1"}
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={loading || !canEdit}
                className={`h-9 rounded-md w-full ${isCurrency ? "pl-9" : ""}`}
                placeholder={config.value}
              />
            </div>
          )}
        </div>
      </Card>
    );
  };

  const actionHeader = (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted px-4 py-3">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          <p className="mb-0.5 font-semibold text-foreground">System Policies</p>
          <p>
            {canEdit
              ? "Modify the core rules and limits. Changes take effect immediately."
              : "Read-only access. Only admins can modify policy values."}
          </p>
        </div>
      </div>
      {canEdit && (
        <Button
          onClick={handleSaveAll}
          disabled={loading || changedKeys.length === 0}
          className="h-9 rounded-md px-4 text-sm font-medium"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {actionHeader}

      {error && (
        <div className="status-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="status-success flex items-center gap-2 rounded-lg px-4 py-3 text-sm">
          <Check className="h-4 w-4" />
          Policies updated successfully.
        </div>
      )}

      <Tabs defaultValue="borrow" className="w-full">
        <TabsList className="mb-4 inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="borrow" className="rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow">Borrow Rules</TabsTrigger>
          <TabsTrigger value="fines" className="rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow">Fines & Penalties</TabsTrigger>
          <TabsTrigger value="faqs" className="rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow">Student FAQs</TabsTrigger>
        </TabsList>

        <TabsContent value="borrow" className="focus-visible:outline-none">
          <div className="grid gap-4 sm:grid-cols-2">
            {borrowKeys.map((key) => renderField(key))}
          </div>
        </TabsContent>

        <TabsContent value="fines" className="focus-visible:outline-none">
          <div className="grid gap-4 sm:grid-cols-2">
            {fineKeys.map((key) => renderField(key))}
          </div>
        </TabsContent>

        <TabsContent value="faqs" className="focus-visible:outline-none">
          <div className="grid gap-4 sm:grid-cols-2">
            {faqKeys.map((key) => renderField(key))}
          </div>
        </TabsContent>
      </Tabs>
      
      {canEdit && changedKeys.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background p-2 shadow-lg sm:left-auto sm:right-6 sm:-translate-x-0">
          <div className="flex items-center gap-3 px-2">
            <span className="text-sm font-medium text-foreground">Unsaved policies ({changedKeys.length})</span>
            <Button
              onClick={handleSaveAll}
              disabled={loading}
              size="sm"
              className="rounded-full px-4"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

