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

export function SecuritySection({ role }: SecuritySectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <SettingsShell 
      title="Security" 
      description="Password and data privacy" 
      role={role}
    >
      <div className="space-y-5">
        <Section title="Account Security" icon={Lock} hideHeaderOnMobile>
          <p className="mb-3 text-sm text-muted-foreground">Manage your authentication methods and login credentials.</p>
          <Button asChild variant="outline" className="h-11 w-full gap-3 rounded-lg border-border sm:w-auto px-6 font-semibold shadow-sm">
            <Link href="/auth/update-password">
              <Lock size={16} />
              Update password
              <ChevronRight size={16} className="text-muted-foreground" />
            </Link>
          </Button>
        </Section>

        <Section title="Privacy Control" icon={Trash2} danger>
          <p className="mb-4 text-sm text-red-700/80 leading-relaxed">
            Permanently delete your profile. Note that some transaction history and library logs will be kept for compliance and record-keeping.
          </p>
          <Button 
            variant="destructive" 
            onClick={() => setDeleteDialogOpen(true)}
            className="h-10 rounded-lg gap-3 bg-red-600 hover:bg-red-700 font-bold px-6 shadow-sm"
          >
            <Trash2 size={16} />
            Permanently Delete My Account
          </Button>
        </Section>
      </div>

      <SelfDeleteAccountDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </SettingsShell>
  );
}
