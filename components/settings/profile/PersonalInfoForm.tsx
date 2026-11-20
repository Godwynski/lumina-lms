"use client";

import { cn } from "@/lib/utils";
import { HelpCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PersonalInfoFormProps {
  role: string;
  initialProfile: {
    full_name: string | null;
    student_id: string | null;
    email: string | null;
    status: string;
    patron_type?: string | null;
  };
  addressValue: string;
  phoneValue: string;
  departmentValue: string;
}

function SummaryTerm({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{children}</span>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="grid size-6 place-items-center text-muted-foreground hover:text-foreground transition-colors rounded"
              aria-label={`${children} info`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </dt>
  );
}

export function PersonalInfoForm({
  role,
  initialProfile,
  addressValue,
  phoneValue,
  departmentValue,
}: PersonalInfoFormProps) {
  const isActive = initialProfile.status?.toUpperCase() === "ACTIVE";

  return (
    <TooltipProvider>
      <div className="flex-1 min-w-0 space-y-5">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 divide-y sm:divide-y-0">
          <div className="space-y-1 sm:col-span-2 pb-4 sm:pb-0 border-b border-border/50 sm:border-b sm:pb-4">
            <SummaryTerm>Full Name</SummaryTerm>
            <dd className="text-base font-semibold text-foreground break-words">
              {initialProfile.full_name || "Not Set"}
            </dd>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0">
            <SummaryTerm tooltip="Official identification number verified by the school administration.">
              Patron ID
            </SummaryTerm>
            <dd className="text-sm font-mono font-semibold text-primary">
              {initialProfile.student_id || "NOT-ASSIGNED"}
            </dd>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0">
            <SummaryTerm tooltip="Shows whether your library borrowing privileges are currently active or on hold.">
              Account Status
            </SummaryTerm>
            <dd>
              <span
                className={cn(
                  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20"
                )}
              >
                {initialProfile.status}
              </span>
            </dd>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0 sm:col-span-2">
            <SummaryTerm tooltip="Your institutional email address used for borrowing and notification emails.">
              Official Email
            </SummaryTerm>
            <dd className="text-xs sm:text-sm font-medium text-foreground break-words">
              {initialProfile.email || "No Email"}
            </dd>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0">
            <SummaryTerm>Contact Number</SummaryTerm>
            <dd className="text-sm font-medium text-foreground break-words">
              {phoneValue || "Not Set"}
            </dd>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0">
            <SummaryTerm>Residential Address</SummaryTerm>
            <dd className="text-sm font-medium text-foreground break-words">
              {addressValue || "Not Set"}
            </dd>
          </div>

          {role === "patron" && initialProfile.patron_type !== "faculty" && (
            <div className="space-y-1 pt-3 sm:pt-0 sm:col-span-2">
              <SummaryTerm tooltip="The college degree program or course currently recorded on your student profile.">
                Academic Program
              </SummaryTerm>
              <dd className="text-sm font-semibold text-foreground break-words">
                {departmentValue || <span className="text-muted-foreground font-medium">Not Assigned</span>}
              </dd>
            </div>
          )}
        </dl>

        <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
          <p className="leading-relaxed">
            These institutional details are read-only and synced from the school directory. Contact a librarian or administrator to request updates.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
