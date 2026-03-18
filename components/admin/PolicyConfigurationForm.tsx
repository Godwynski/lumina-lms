"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-settings";

interface PolicySetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export function PolicyConfigurationForm({
  settings,
}: {
  settings: PolicySetting[];
}) {
  const [formData, setFormData] = useState<Record<string, string>>(
    settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
    setError(null);
  };

  const handleSave = async (key: string) => {
    if (!formData[key]) {
      setError(`${key} cannot be empty`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const value = formData[key];
      const description = (DEFAULT_POLICIES as any)[key]?.description;

      const response = await fetch("/api/admin/policy-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, description }),
      });

      if (!response.ok) {
        throw new Error("Failed to save setting");
      }

      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Policy Configuration</p>
          <p>These settings control the core library management behavior system-wide.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {Object.entries(DEFAULT_POLICIES).map(([key, config]) => (
          <Card
            key={key}
            className="p-6 border-zinc-200/50 hover:shadow-md transition-shadow"
          >
            <div className="space-y-3">
              <div>
                <Label className="text-base font-semibold text-zinc-900">
                  {key
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </Label>
                <p className="text-sm text-zinc-500 mt-1">{config.description}</p>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
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
                    disabled={loading}
                    className="rounded-lg"
                    placeholder={config.value}
                  />
                </div>
                <Button
                  onClick={() => handleSave(key)}
                  disabled={loading || formData[key] === settings.find((s) => s.key === key)?.value}
                  className={`rounded-lg h-10 px-4 ${
                    saved === key
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {loading && key === Object.keys(DEFAULT_POLICIES)[0] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved === key ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>

              <p className="text-xs text-zinc-400">
                Current value: <span className="font-mono font-semibold">{formData[key] || config.value}</span>
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
