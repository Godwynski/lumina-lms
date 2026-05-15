"use client";

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Calendar, 
  BookCopy, 
  RotateCw, 
  History, 
  Clock, 
  Ticket, 
  HelpCircle, 
  MessageSquare, 
  User, 
  Mail, 
  Megaphone,

  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_POLICIES, type PolicyConfig } from "@/lib/actions/policy-constants";
import { IdentityListManager } from "./IdentityListManager";
import { SupportFAQManager } from "./SupportFAQManager";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ICONS = {
  Calendar,
  BookCopy,
  RotateCw,
  History,
  Clock,
  Ticket,
  HelpCircle,
  MessageSquare,
  User,
  Mail,
  Megaphone
};


/**
 * Individual policy field component with high-fidelity administrative styling.
 * Supports various input types (Sliders, Switches, Custom Managers) based on policy key.
 */
export function PolicyField({
  policyKey,
  value,
  initialValue,
  onChange,
  disabled,
  loading
}: {
  policyKey: string;
  value: string;
  initialValue: string;
  onChange: (val: string) => void;
  disabled: boolean;
  loading: boolean;
}) {
  const config = DEFAULT_POLICIES[policyKey] as PolicyConfig;
  const Icon = ICONS[config.icon as keyof typeof ICONS] || HelpCircle;
  
  // Type detection logic
  const validation = config.validation;
  const isSlider = validation?.type === "number" && validation?.max !== undefined && validation.max <= 50;
  const isDays = policyKey.includes("days") || policyKey.includes("period");
  const isToggle = config.value === "true" || config.value === "false" || policyKey.includes("enable") || policyKey.includes("required");
  const isSupportFAQ = policyKey === "support_faqs" || policyKey === "student_faq_list";
  const isIdentityList = (config.category === "identity" || policyKey.includes("list") || policyKey.includes("identities") || (value || config.value).startsWith("[")) && !isSupportFAQ;
  const isComplex = isIdentityList || isSupportFAQ;

  const labelText = config.label.replace(/_/g, ' ');

  const handleNumericChange = (val: string) => {
    if (validation?.type === "number") {
      const num = parseInt(val);
      if (isNaN(num)) {
        onChange("0");
        return;
      }
      // Enforce limits immediately in the UI if it's a number
      let clamped = num;
      if (validation.min !== undefined) clamped = Math.max(validation.min, clamped);
      if (validation.max !== undefined) clamped = Math.min(validation.max, clamped);
      onChange(clamped.toString());
    } else {
      onChange(val);
    }
  };

  return (
    <div className="py-8 first:pt-0 border-b border-border/5 last:border-0 group animate-in fade-in slide-in-from-top-1 duration-500">
      <div className={cn(
        "flex flex-col gap-8",
        !isComplex && "md:flex-row md:items-start justify-between"
      )}>
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted/15 flex items-center justify-center text-muted-foreground/60 group-hover:text-primary group-hover:bg-primary/15 transition-all duration-300 border border-border/5 group-hover:border-primary/20 shadow-sm">
              <Icon size={18} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground leading-none">{labelText}</h3>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/40 hover:text-primary transition-colors focus:outline-none cursor-help mb-0.5">
                      <HelpCircle size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] p-0 overflow-hidden rounded-2xl border-border/20 shadow-2xl backdrop-blur-xl bg-background/95">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/10">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">Information</span>
                      </div>
                      <p className="text-[11px] font-medium text-foreground/80 leading-relaxed">{config.description}</p>
                      {validation?.type === "number" && (
                        <p className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">
                          Limit: {validation.min ?? 0} - {validation.max ?? '∞'}
                        </p>
                      )}
                      {config.example && (
                        <div className="bg-muted/10 p-3 rounded-lg border border-border/10">
                          <p className="text-[9px] text-muted-foreground/60 leading-relaxed italic font-medium">&ldquo;{config.example}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] truncate">{policyKey}</p>
            </div>

            {value !== initialValue && (
              <div className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 animate-in zoom-in-95 duration-500">
                <Zap className="h-2.5 w-2.5 text-primary" />
                <span className="text-[8px] font-bold uppercase text-primary tracking-widest">Modified</span>
              </div>
            )}
          </div>
        </div>

        <div className={cn(
          "shrink-0",
          !isComplex ? "md:w-48" : "pt-4"
        )}>
          {isSlider ? (
            <div className="flex items-center gap-5 px-1">
              <Slider
                min={validation?.min ?? 0}
                max={validation?.max ?? 50}
                step={validation?.step ?? 1}
                value={[parseInt(value || "0")]}
                onValueChange={(vals) => onChange(vals[0].toString())}
                disabled={loading || disabled}
                className="flex-1"
              />
              <div className="h-10 w-14 rounded-lg bg-muted/10 flex items-center justify-center border border-border/40">
                <span className="text-[11px] font-black tabular-nums text-primary">
                  {value || "0"}
                </span>
              </div>
            </div>
          ) : isIdentityList ? (
            <IdentityListManager
              value={value || ""}
              initialValue={initialValue || ""}
              onChange={(val) => onChange(val)}
              disabled={loading || disabled}
            />
          ) : isSupportFAQ ? (
            <SupportFAQManager
              value={value || ""}
              initialValue={initialValue || ""}
              onChange={(val) => onChange(val)}
              disabled={loading || disabled}
            />
          ) : isToggle ? (
            <div className="flex justify-end pr-2">
              <Switch
                checked={value === "true"}
                onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
                disabled={loading || disabled}
                className="scale-110 data-[state=checked]:bg-primary"
              />
            </div>
          ) : (
            <div className="relative group/input">
              <Input
                type={validation?.type === "number" ? "number" : "text"}
                min={validation?.min}
                max={validation?.max}
                value={value || ""}
                onChange={(e) => handleNumericChange(e.target.value)}
                disabled={loading || disabled}
                className="h-10 rounded-lg border-border/40 bg-muted/5 text-[11px] font-black tracking-widest uppercase focus:ring-0 pr-12 transition-all shadow-sm"
              />
              {isDays && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[7px] font-bold text-muted-foreground/20 pointer-events-none uppercase tracking-widest border-l border-border/5 pl-2.5">
                  Days
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
