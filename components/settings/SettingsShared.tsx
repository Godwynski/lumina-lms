"use client";

import * as React from "react";
import { memo, useState } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
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
  title?: string; 
  icon?: LucideIcon; 
  children: React.ReactNode; 
  danger?: boolean; 
  hideHeaderOnMobile?: boolean 
}) => {
  return (
    <div className={cn("space-y-4", hideHeaderOnMobile && "md:mt-4")}>
      {title && Icon && (
        <div className={cn(
          "flex items-center gap-2 border-b border-border/40 pb-3",
          hideHeaderOnMobile && "hidden md:flex"
        )}>
          <Icon size={16} className={cn(danger ? "text-red-500" : "text-muted-foreground/60")} />
          <h2 className={cn("text-sm font-medium", danger ? "text-red-600" : "text-foreground")}>{title}</h2>
        </div>
      )}
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-400">{children}</div>
    </div>
  );
});
Section.displayName = "Section";

export const FieldGroup = memo(({ label, children }: { label: string; children: React.ReactNode }) => {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
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
    <div
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between py-4 border-b border-border/40 last:border-0 group"
    >
      <div className="max-w-[80%] space-y-0.5">
        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{title}</h4>
        <p className="text-xs text-muted-foreground leading-normal">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} onClick={(e) => e.stopPropagation()} />
    </div>
  );
});
PremiumToggle.displayName = "PremiumToggle";

export function AnnualResetTool() {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm("This will suspend all student accounts. Proceed?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/annual-reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Reset complete.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Batch Account Reset</h4>
        <p className="text-xs text-muted-foreground">
          Suspends all student accounts for the new academic year.
        </p>
      </div>
      <Button 
        onClick={handleReset} 
        disabled={isResetting}
        variant="outline"
        size="sm"
        className="h-8 rounded-lg text-xs font-medium"
      >
        {isResetting ? "Resetting..." : "Execute Reset"}
      </Button>
    </div>
  );
}

export function RunMaintenanceTool() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRun = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/notifications/maintenance", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Maintenance complete.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-foreground">Email Dispatch</h4>
        <p className="text-xs text-muted-foreground">
          Triggers overdue checks and sends notification emails.
        </p>
      </div>
      <Button 
        onClick={handleRun} 
        disabled={isProcessing}
        variant="outline"
        size="sm"
        className="h-8 rounded-lg text-xs font-medium"
      >
        {isProcessing ? "Processing..." : "Run Task"}
      </Button>
    </div>
  );
}

export function TestEmailTool() {
  const [isSending, setIsSending] = useState(false);

  const handleTest = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/test-email", { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Test email sent! Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-foreground">Configuration Test</h4>
        <p className="text-xs text-muted-foreground">
          Sends a professional test email to your account to verify SMTP.
        </p>
      </div>
      <Button 
        onClick={handleTest} 
        disabled={isSending}
        variant="secondary"
        size="sm"
        className="h-8 rounded-lg text-xs font-medium"
      >
        {isSending ? "Sending..." : "Send Test Email"}
      </Button>
    </div>
  );
}
