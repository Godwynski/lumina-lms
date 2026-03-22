"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";

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

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
        <div className="flex gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-xs text-muted-foreground">
          <p className="mb-0.5 font-semibold text-foreground">Policy settings</p>
          <p>
            {canEdit
              ? "These settings control the core library management behavior system-wide."
              : "Read-only access. Only admins can modify policy values."}
          </p>
        </div>
        </div>
        {canEdit && (
          <Button
            onClick={handleSaveAll}
            disabled={loading || changedKeys.length === 0}
            className="h-8 rounded-md px-3 text-xs"
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        )}
      </div>

      {error && (
        <div className="status-danger rounded-lg px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {saved && (
        <div className="status-success flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs">
          <Check className="h-3.5 w-3.5" />
          Settings updated.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(DEFAULT_POLICIES).map(([key, config]) => (
          <Card
            key={key}
            className="border-border bg-card p-3 shadow-sm"
          >
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-semibold text-foreground">
                  {key
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{config.description}</p>
              </div>

              <Input
                type={
                  key.includes("days") || key.includes("limit") || key.includes("count") || key.includes("years")
                    ? "number"
                    : key.includes("fine")
                    ? "number"
                    : "text"
                }
                step={key.includes("fine") ? "0.01" : "1"}
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={loading || !canEdit}
                className="h-9 rounded-md"
                placeholder={config.value}
              />
            </div>
          </Card>
        ))}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveAll}
            disabled={loading || changedKeys.length === 0}
            className="h-8 rounded-md px-3 text-xs"
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
