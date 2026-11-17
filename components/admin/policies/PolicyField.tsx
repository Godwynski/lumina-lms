"use client";

import { useId, useState } from "react";
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
  onInvalidChange,
  disabled,
  loading
}: {
  policyKey: string;
  value: string;
  initialValue: string;
  onChange: (val: string) => void;
  /** Told whether the box currently holds an out-of-range draft, so the parent can block saving. */
  onInvalidChange?: (invalid: boolean) => void;
  disabled: boolean;
  loading: boolean;
}) {
  const config = DEFAULT_POLICIES[policyKey] as PolicyConfig;
  const Icon = ICONS[config.icon as keyof typeof ICONS] || HelpCircle;
  
  // Type detection logic
  const validation = config.validation;
  const isCorePolicy = config.category === "circulation" || config.category === "reservations";
  const isSlider = !isCorePolicy && validation?.type === "number" && validation?.max !== undefined && validation.max <= 50;
  const isDays = policyKey.includes("days") || policyKey.includes("period");
  const unit = isDays
    ? "Days"
    : policyKey.includes("fine")
      ? "PHP / Day"
      : isCorePolicy && validation?.type === "number"
        ? "Books"
        : null;
  const isToggle = config.value === "true" || config.value === "false" || policyKey.includes("enable") || policyKey.includes("required");
  const isSupportFAQ = policyKey === "support_faqs" || policyKey === "student_faq_list";
  const isIdentityList = (config.category === "identity" || policyKey.includes("list") || policyKey.includes("identities") || (value || config.value).startsWith("[")) && !isSupportFAQ;
  const isComplex = isIdentityList || isSupportFAQ;

  const labelText = config.label.replace(/_/g, ' ');

  // The user's in-progress text for number fields. Only valid integers in range
  // are sent to the parent, so an invalid draft (e.g. an empty box) can never be
  // committed. An invalid draft stays visible with its error (and blocks saving
  // via onInvalidChange) until the user fixes it.
  const [draft, setDraft] = useState<string | null>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  const validateNumber = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed === "") return "Enter a value.";
    if (!/^\d+$/.test(trimmed)) return "Enter a whole number.";
    const num = Number(trimmed);
    if (validation?.min !== undefined && num < validation.min) return `Minimum is ${validation.min}.`;
    if (validation?.max !== undefined && num > validation.max) return `Only up to ${validation.max} allowed`;
    return null;
  };

  const validateTime = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed === "") return "Enter a time in HH:MM format.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      return "Use 24-hour HH:MM format (00:00–23:59).";
    }
    return null;
  };

  const fieldError =
    draft === null
      ? null
      : validation?.type === "number"
        ? validateNumber(draft)
        : validation?.type === "time"
          ? validateTime(draft)
          : null;

  const handleValueChange = (val: string) => {
    if (validation?.type === "number") {
      setDraft(val);
      const valid = validateNumber(val) === null;
      onInvalidChange?.(!valid);
      if (valid) onChange(String(Number(val.trim())));
      return;
    }
    if (validation?.type === "time") {
      setDraft(val);
      const valid = validateTime(val) === null;
      onInvalidChange?.(!valid);
      if (valid) onChange(val.trim());
      return;
    }
    onChange(val);
  };

  if (isIdentityList) {
    return (
      <div className="py-1 animate-in fade-in slide-in-from-top-1 duration-500">
        <IdentityListManager
          value={value || ""}
          initialValue={initialValue || ""}
          onChange={(val) => onChange(val)}
          disabled={loading || disabled}
        />
      </div>
    );
  }

  return (
    <div className="py-6 first:pt-0 border-b border-border/50 last:border-0 group animate-in fade-in slide-in-from-top-1 duration-500">
      <div className={cn(
        "flex flex-col gap-6",
        !isComplex && "md:flex-row md:items-start justify-between"
      )}>
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors border border-border/50 group-hover:border-primary/20 shrink-0">
              <Icon size={18} />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-snug">{labelText}</h3>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label={`About ${labelText}`} className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-primary cursor-help">
                        <HelpCircle size={13} />
                      </button>
                    </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] p-0 overflow-hidden rounded-xl border-border shadow-xl bg-background">
                    <div className="p-3.5 space-y-2.5">
                      <div className="pb-1.5 border-b border-border/50">
                        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Policy guidance</span>
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed">{config.description}</p>
                      {validation?.type === "number" && (
                        <p className="text-xs font-semibold text-primary">
                          Allowed range: {validation.min ?? 0} – {validation.max ?? '∞'}
                        </p>
                      )}
                      {validation?.type === "time" && (
                        <p className="text-xs font-semibold text-primary">
                          Format: 24-hour HH:MM
                        </p>
                      )}
                      {config.example && (
                        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                          <p className="text-xs text-muted-foreground leading-relaxed">{config.example}</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                </div>
                {value !== initialValue && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 animate-in zoom-in-95 duration-300">
                    <Zap className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-primary">Modified</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">{config.description}</p>
            </div>
          </div>
        </div>

        <div className={cn(
          "shrink-0",
          !isComplex ? "md:w-52" : "pt-2"
        )}>
          {isSlider ? (
            <div className="flex items-center gap-4 px-1">
              <Slider
                min={validation?.min ?? 0}
                max={validation?.max ?? 50}
                step={validation?.step ?? 1}
                value={[parseInt(value || "0")]}
                onValueChange={(vals) => onChange(vals[0].toString())}
                aria-label={labelText}
                disabled={loading || disabled}
                className="flex-1"
              />
              <div className="h-10 w-14 rounded-lg bg-muted/30 flex items-center justify-center border border-border/60">
                <span className="text-xs font-semibold tabular-nums text-primary">
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
                aria-label={labelText}
                disabled={loading || disabled}
                className="scale-110 data-[state=checked]:bg-primary"
              />
            </div>
          ) : (
            <div className="relative group/input">
              <Input
                id={fieldId}
                aria-label={unit ? `${labelText} (${unit.toLowerCase()})` : labelText}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? errorId : undefined}
                type={validation?.type === "number" ? "number" : validation?.type === "time" ? "time" : "text"}
                inputMode={validation?.type === "number" ? "numeric" : undefined}
                placeholder={validation?.type === "time" ? "17:00" : undefined}
                min={validation?.min}
                max={validation?.max}
                step={validation?.type === "number" ? 1 : undefined}
                value={draft ?? value ?? ""}
                onChange={(e) => handleValueChange(e.target.value)}
                onBlur={() => { if (!fieldError) setDraft(null); }}
                disabled={loading || disabled}
                className={cn(
                  "h-10 rounded-lg border-border bg-background text-sm font-medium transition-all shadow-xs",
                  unit ? "pr-20" : "pr-3",
                  fieldError && "border-destructive focus-visible:ring-destructive/30"
                )}
              />
              {unit && (
                <span aria-hidden="true" className="absolute right-8 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                  {unit}
                </span>
              )}
              {fieldError && (
                <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                  {fieldError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
