"use client";

import { useState, useTransition } from "react";
import { updateUiPreference } from "@/lib/actions/preferences";
import { Layout, User, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DashboardModeToggleProps {
  currentMode: "staff" | "student";
}

export function DashboardModeToggle({ currentMode: initialMode }: DashboardModeToggleProps) {
  const [mode, setMode] = useState<"staff" | "student">(initialMode);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (newMode: "staff" | "student") => {
    if (newMode === mode) return;

    startTransition(async () => {
      const result = await updateUiPreference({
        key: "preferred_dashboard_view",
        value: newMode,
      });

      if (result.success) {
        setMode(newMode);
        toast.success(`Switched to ${newMode === "staff" ? "Staff" : "Student"} mode`, {
          description: "Your dashboard layout has been updated.",
        });
      } else {
        toast.error("Failed to update preference");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 p-6 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-sm relative overflow-hidden group">
      {/* Background Decorative Element */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-background/50 shadow-sm backdrop-blur-md">
            <Layout className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Dashboard View Mode
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            </h3>
            <p className="text-xs text-muted-foreground/80 font-medium">
              Choose how you want to experience the library dashboard.
            </p>
          </div>
        </div>
        
        {isPending && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
        <button
          onClick={() => handleToggle("student")}
          disabled={isPending}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-300",
            mode === "student"
              ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]"
              : "bg-background/40 text-muted-foreground border-border/40 hover:bg-background/60 hover:border-primary/30"
          )}
        >
          <User className={cn("h-5 w-5", mode === "student" ? "text-primary-foreground" : "text-primary/70")} />
          <span className="text-sm font-bold uppercase tracking-tight">Student Mode</span>
          <span className="text-[10px] opacity-70 font-medium leading-tight text-center">
            Cleaner, student-centric browsing & history
          </span>
          {mode === "student" && (
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </button>

        <button
          onClick={() => handleToggle("staff")}
          disabled={isPending}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-300",
            mode === "staff"
              ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]"
              : "bg-background/40 text-muted-foreground border-border/40 hover:bg-background/60 hover:border-primary/30"
          )}
        >
          <Layout className={cn("h-5 w-5", mode === "staff" ? "text-primary-foreground" : "text-primary/70")} />
          <span className="text-sm font-bold uppercase tracking-tight">Staff Mode</span>
          <span className="text-[10px] opacity-70 font-medium leading-tight text-center">
            Full management & inventory tools
          </span>
          {mode === "staff" && (
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
}
