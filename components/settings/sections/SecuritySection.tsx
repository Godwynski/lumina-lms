"use client";

import { Lock, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountTabs } from "../AccountTabs";

interface SecuritySectionProps {
  role: string;
}

export function SecuritySection({ role }: SecuritySectionProps) {
  return (
    <TooltipProvider>
      <div className="w-full max-w-3xl pb-12 space-y-6">
        <AccountTabs active="security" />

        <div className="grid gap-6">
          {/* Identity & Access Card */}
          <Card className="group relative border-border/60 bg-card p-6 shadow-xs transition-colors hover:border-primary/20 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 h-10 w-10 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-foreground">
                    Identity &amp; Access
                  </h2>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="grid size-6 place-items-center text-muted-foreground hover:text-foreground transition-colors rounded" aria-label="Identity & Access info">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs">
                      Account authentication and role permissions are synchronized with the central institution directory.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground max-w-xl">
                  {role === "patron"
                    ? "Your account credentials are managed by the school system. Contact the administrator for security concerns."
                    : "Your account credentials and access permissions are managed by the system. Contact an administrator if you need changes."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
