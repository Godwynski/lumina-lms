"use client";

import * as React from "react";
import { memo, useState } from "react";
import { LucideIcon, RefreshCw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Section = memo(({ 
  title, 
  icon: Icon, 
  children, 
  danger, 
  hideHeaderOnMobile 
}: { 
  title: string; 
  icon: LucideIcon; 
  children: React.ReactNode; 
  danger?: boolean; 
  hideHeaderOnMobile?: boolean 
}) => {
  return (
    <div className={cn("space-y-3 md:space-y-4", hideHeaderOnMobile && "md:mt-4")}>
      <div className={cn(
        "flex items-center gap-3 border-b border-border pb-2 md:pb-3",
        hideHeaderOnMobile && "hidden md:flex"
      )}>
        <div className={cn("rounded-lg p-1.5", danger ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground")}>
          <Icon size={16} />
        </div>
        <h2 className={cn("flex-1 text-base font-bold tracking-tight", danger ? "text-red-900" : "text-foreground")}>{title}</h2>
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-400">{children}</div>
    </div>
  );
});
Section.displayName = "Section";

export const FieldGroup = memo(({ label, children }: { label: string; children: React.ReactNode }) => {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold text-foreground/80">{label}</Label>
      {children}
    </div>
  );
});
FieldGroup.displayName = "FieldGroup";

export const PremiumToggle = memo(({ 
  title, 
  description, 
  checked, 
  onChange 
}: { 
  title: string; 
  description: string; 
  checked: boolean; 
  onChange: (v: boolean) => void 
}) => {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onChange(!checked);
        }
      }}
      className="group flex w-full cursor-pointer items-center justify-between rounded-xl border-border bg-card p-4 text-left shadow-sm transition-all hover:bg-muted/50"
    >
      <div className="max-w-[80%]">
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} onClick={(e) => e.stopPropagation()} />
    </Card>
  );
});
PremiumToggle.displayName = "PremiumToggle";

export function AnnualResetTool() {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm("CRITICAL ACTION: This will suspend ALL student accounts for the new school year. They will need manual activation by a librarian to regain access. Proceed?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/annual-reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Annual reset complete. Students must now show ID for re-activation.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
            <RefreshCw className={cn("h-5 w-5 text-primary", isResetting && "animate-spin")} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Annual School Year Reset</h4>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              Batch suspends all student accounts. Recommended at the start of every academic year to ensure only valid students maintain library privileges.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button 
            onClick={handleReset} 
            disabled={isResetting}
            variant="outline"
            className="h-9 gap-2 border-primary/20 text-xs font-bold hover:bg-primary/5 hover:text-primary transition-colors"
          >
            {isResetting ? "Executing Reset..." : "Execute Batch Reset"}
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
