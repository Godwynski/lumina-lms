"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, BookCopy, RotateCw, History, Clock, Ticket, HelpCircle, MessageSquare, User, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { IdentityListManager } from "./IdentityListManager";
import { SupportFAQManager } from "./SupportFAQManager";

const ICONS = {
  Calendar,
  BookCopy,
  RotateCw,
  History,
  Clock,
  Ticket,
  HelpCircle,
  MessageSquare,
  User
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
  const isIdentityList = config.category === "identity";
  const isSupportFAQ = config.category === "support" && policyKey === "student_faq_list";
  
  const labelText = ('label' in config ? config.label : undefined) || policyKey.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace("Loan", "Borrow");

  return (
    <TooltipProvider>
      <Card className={cn(
        "group relative border-border/40 bg-card/30 p-4 shadow-none transition-all hover:bg-card/50 hover:border-primary/10 rounded-2xl",
        isSupportFAQ && "md:col-span-1"
      )}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-7 w-7 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-colors shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/70">{labelText}</Label>
                  {'example' in config && config.example && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/40 hover:text-primary cursor-help transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px] text-[10px] font-medium leading-relaxed rounded-xl border-border/40 shadow-xl p-3">
                        {config.example}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/80">{config.description}</p>
              </div>
            </div>
          
          <div className="pt-1">
            {isSlider ? (
              <div className="flex items-center gap-4">
                <Slider
                  max={15}
                  step={1}
                  value={[parseInt(value || "0")]}
                  onValueChange={(vals) => onChange(vals[0].toString())}
                  disabled={loading || disabled}
                  className="flex-1 h-6 hover:cursor-pointer"
                />
                <span className="min-w-[2rem] text-right text-xs font-black text-primary">{value || "0"}</span>
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
            ) : (
              <div className="relative">
                <Input
                  type={isDays ? "number" : "text"}
                  value={value || ""}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={loading || disabled}
                  className="h-11 rounded-xl border-border/40 bg-muted/10 text-xs font-black text-primary focus:bg-background transition-all px-4 pr-12"
                />
                {isDays && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-muted-foreground pointer-events-none">Days</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </Card>
    </TooltipProvider>
  );
}
