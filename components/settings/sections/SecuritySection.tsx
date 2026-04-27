"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Archive, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AnnualResetTool } from "../SettingsShared";
import { SelfDeleteAccountDialog } from "@/components/account/SelfDeleteAccountDialog";

interface SecuritySectionProps {
  role: string;
}

export function SecuritySection({ role }: SecuritySectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isAdmin = role === "admin";

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
                  Identity & Access
                </Label>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80 max-w-lg">
                  {role === "student" 
                    ? "Your account credentials are managed by the school system. Contact the administrator for security concerns."
                    : "Protect your account by regularly updating your credentials."}
                </p>
              </div>
              
              {role !== "student" && (
                <div className="pt-2">
                  <Button asChild variant="outline" className="h-9 gap-2 rounded-xl border-border/40 px-5 text-xs font-bold hover:bg-background transition-colors">
                    <Link href="/auth/update-password">
                      Update Password
                      <ChevronRight className="h-3 w-3 text-muted-foreground/70" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* System Operations Card (Admin Only) */}
        {isAdmin && (
          <Card className="group relative border-border/40 bg-card/30 p-5 shadow-none transition-all hover:bg-card/50 hover:border-primary/10 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-colors shrink-0">
                <Settings className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/70">
                    System Operations
                  </Label>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80 max-w-lg">
                    Manage critical system-wide operations.
                  </p>
                </div>
                <div className="pt-2">
                  <AnnualResetTool />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Danger Zone Card */}
        <Card className="group relative border-destructive/20 bg-destructive/5 p-5 shadow-none transition-all hover:bg-destructive/10 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive group-hover:bg-destructive/20 transition-colors shrink-0">
              <Archive className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-destructive">
                  Account Archive
                </Label>
                <p className="mt-1 text-[11px] leading-relaxed text-destructive/80 max-w-lg">
                  Archive your profile to restrict access while preserving data according to system policy.
                </p>
              </div>
              <div className="pt-2 flex">
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="h-9 rounded-xl gap-2 bg-destructive hover:bg-destructive/90 text-xs font-bold px-5 shadow-md"
                >
                  <Archive size={14} />
                  Archive Profile
                </Button>
              </div>
            </div>
          </div>
        </Card>

      </div>

      <SelfDeleteAccountDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
