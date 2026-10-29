"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PersonalInfoFormProps {
  role: string;
  initialProfile: {
    full_name: string | null;
    student_id: string | null;
    email: string | null;
    status: string;
  };
  addressValue: string;
  phoneValue: string;
  departmentValue: string;
}

function InfoLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs font-bold text-foreground/80">{children}</Label>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/40 hover:text-foreground transition-colors p-0.5" aria-label={`${children} info`}>
              <HelpCircle className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function PersonalInfoForm({
  role,
  initialProfile,
  addressValue,
  phoneValue,
  departmentValue,
}: PersonalInfoFormProps) {
  return (
    <TooltipProvider>
      <div className="flex-1 space-y-6">
        {/* Info: Full Name */}
        <div className="space-y-2">
          <InfoLabel>Full Name</InfoLabel>
          <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-bold text-foreground/80 shadow-sm overflow-hidden">
            <span className="truncate w-full">{initialProfile.full_name || "Not Set"}</span>
          </div>
        </div>

        {/* Info: ID / Email / Status row */}
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <InfoLabel tooltip="Official identification number verified by the school administration.">Student ID</InfoLabel>
            <div className="h-11 rounded-xl bg-primary/5 border border-primary/10 px-4 flex items-center text-sm font-mono font-bold text-primary shadow-sm overflow-hidden">
              <span className="truncate w-full">{initialProfile.student_id || "NOT-ASSIGNED"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <InfoLabel tooltip="Your institutional email address used for borrowing and notification emails.">Official Email</InfoLabel>
            <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-semibold text-foreground/70 shadow-sm overflow-hidden">
              <span className="truncate w-full">{initialProfile.email || "No Email"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <InfoLabel tooltip="Shows whether your library borrowing privileges are currently active or on hold.">Account Status</InfoLabel>
            <div className={cn(
              "h-11 rounded-xl border border-border/20 px-4 flex items-center text-[11px] font-black uppercase tracking-widest shadow-sm",
              initialProfile.status?.toUpperCase() === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            )}>
              {initialProfile.status}
            </div>
          </div>
        </div>

        {/* Info: Contact / Address */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <InfoLabel>Contact Number</InfoLabel>
            <div className="h-11 rounded-xl bg-muted/10 border border-border/40 px-4 flex items-center text-sm font-medium text-foreground/80 shadow-sm overflow-hidden">
              <span className="truncate w-full">{phoneValue || "Not Set"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <InfoLabel>Residential Address</InfoLabel>
            <div className="h-11 rounded-xl bg-muted/10 border border-border/40 px-4 flex items-center text-sm font-medium text-foreground/80 shadow-sm overflow-hidden">
              <span className="truncate w-full">{addressValue || "Not Set"}</span>
            </div>
          </div>
        </div>

        {/* Info: Academic Program (students only) */}
        {role === 'student' && (
          <div className="space-y-2">
            <InfoLabel tooltip="The college degree program or course currently recorded on your student profile.">Academic Program</InfoLabel>
            <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-bold text-foreground/80 shadow-sm overflow-hidden">
              <span className="truncate w-full">{departmentValue || <span className="text-muted-foreground/50 font-medium">Not Assigned</span>}</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
