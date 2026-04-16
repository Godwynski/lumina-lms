"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";
import { SelfDeleteAccountDialog } from "@/components/account/SelfDeleteAccountDialog";

interface SecuritySectionProps {
  role: string;
}

export function SecuritySection({ role: _role }: SecuritySectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <SettingsShell>
      <div className="grid gap-6">
        <Section title="Account Security" icon={Lock} hideHeaderOnMobile>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Authentication Credentials</p>
                <p className="text-xs text-muted-foreground">Manage your secure entry and identity validation methods.</p>
              </div>
              <Button asChild variant="outline" className="h-10 gap-3 rounded-lg border-border px-6 font-bold shadow-sm hover:bg-background">
                <Link href="/auth/update-password">
                  <Lock size={14} />
                  Update Password
                  <ChevronRight size={14} className="text-muted-foreground" />
                </Link>
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Privacy & Termination" icon={Trash2} danger>
          <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
              <div className="max-w-md">
                <p className="text-sm font-bold text-red-900">Permanent Account Deletion</p>
                <p className="text-xs text-red-700/80 leading-relaxed mt-1">
                  Permanently remove your profile from the library system. Some transaction logs will remain for institutional compliance.
                </p>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setDeleteDialogOpen(true)}
                className="h-10 rounded-lg gap-2 bg-red-600 hover:bg-red-700 font-bold px-6 shadow-md"
              >
                <Trash2 size={16} />
                Delete Profile
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <SelfDeleteAccountDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </SettingsShell>
  );
}
