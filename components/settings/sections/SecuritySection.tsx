"use client";

import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface SecuritySectionProps {
  role: string;
}

export function SecuritySection({ role }: SecuritySectionProps) {
  return (
    <div className="w-full max-w-4xl mx-auto pb-12">
      <div className="grid gap-6">

        {/* Identity & Access Card */}
        <Card className="group relative border-border/40 bg-card/30 p-5 shadow-none transition-all hover:bg-card/50 hover:border-primary/10 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-colors shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/70">
                  Identity &amp; Access
                </Label>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80 max-w-lg">
                  {role === "student"
                    ? "Your account credentials are managed by the school system. Contact the administrator for security concerns."
                    : "Your account credentials and access permissions are managed by the system. Contact an administrator if you need changes."}
                </p>
              </div>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
