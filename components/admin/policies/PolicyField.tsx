"use client";

import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Calendar, BookCopy, RotateCw, History, Clock, Ticket, HelpCircle, MessageSquare, User, Mail, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
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

type PolicyKey = keyof typeof DEFAULT_POLICIES;

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
  const config = DEFAULT_POLICIES[policyKey as PolicyKey];
  const Icon = ICONS[config.icon as keyof typeof ICONS] || HelpCircle;
  
  // Type detection
  const isSlider = policyKey === "max_borrow_limit" || policyKey === "max_renewal_count";
  const isDays = policyKey.includes("days");
  const isToggle = config.value === "true" || config.value === "false" || policyKey.includes("enable") || policyKey.includes("required");
  const isSupportFAQ = policyKey === "support_faqs" || policyKey === "student_faq_list";
  const isIdentityList = (config.category === "identity" || policyKey.includes("list") || policyKey.includes("identities") || (value || config.value).startsWith("[")) && !isSupportFAQ;
  const isComplex = isIdentityList || isSupportFAQ;

  const labelText = config.label.replace(/_/g, ' ');

  return (
    <div className="py-8 first:pt-0 border-b border-border/40 last:border-0 group">
      <div className={cn(
        "flex flex-col gap-6",
        !isComplex && "md:flex-row md:items-center justify-between"
      )}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
            <h3 className="text-sm font-medium text-foreground">{labelText}</h3>
            
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/30 hover:text-primary transition-colors focus:outline-none cursor-help">
                  <HelpCircle size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[240px] text-[11px] p-4 rounded-xl border-border/40 shadow-2xl backdrop-blur-xl bg-background/95">
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">{config.description}</p>
                  {config.example && (
                    <p className="text-muted-foreground italic border-t border-border/40 pt-2">{config.example}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>

            {value !== initialValue && (
              <span className="text-[9px] font-bold uppercase text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded-full tracking-wider animate-in fade-in zoom-in duration-300">
                Modified
              </span>
            )}
          </div>
        </div>

        <div className={cn(
          "w-full shrink-0",
          !isComplex ? "md:w-48" : "pt-2"
        )}>
          {isSlider ? (
            <div className="flex items-center gap-4">
              <Slider
                max={15}
                step={1}
                value={[parseInt(value || "0")]}
                onValueChange={(vals) => onChange(vals[0].toString())}
                disabled={loading || disabled}
                className="flex-1"
              />
              <span className="text-xs font-semibold tabular-nums text-primary min-w-[2rem] text-right">
                {value || "0"}
              </span>
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
            <div className="flex justify-end">
              <Switch
                checked={value === "true"}
                onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
                disabled={loading || disabled}
              />
            </div>
          ) : (
            <div className="relative group">
              <Input
                type={isDays ? "number" : "text"}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={loading || disabled}
                className="h-9 rounded-lg border-border/40 bg-muted/20 text-xs font-medium focus:bg-background pr-12 transition-all"
              />
              {isDays && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/60 pointer-events-none uppercase tracking-tighter">
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
