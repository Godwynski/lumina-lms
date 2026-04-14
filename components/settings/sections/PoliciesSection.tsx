"use client";

import { use, Suspense } from "react";
import { Settings2 } from "lucide-react";
import { Section } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";
import { PolicyConfigurationForm } from "@/components/admin/PolicyConfigurationForm";

type PolicySetting = { id: string; key: string; value: string; description?: string };

interface PoliciesSectionProps {
  role: string;
  settingsPromise: Promise<PolicySetting[]> | PromiseLike<PolicySetting[]>;
}

export function PoliciesSection({ role, settingsPromise }: PoliciesSectionProps) {
  const isSuperAdmin = role === "admin";

  return (
    <SettingsShell 
      title="System Policies" 
      description="Manage system-wide rules and limits" 
      role={role}
    >
      <Section title="Policy Control Center" icon={Settings2} hideHeaderOnMobile>
        <Suspense fallback={<div className="h-32 w-full animate-pulse bg-muted rounded-xl" />}>
           <PolicyStreamWrapper promise={settingsPromise} canEdit={isSuperAdmin} />
        </Suspense>
      </Section>
    </SettingsShell>
  );
}

function PolicyStreamWrapper({ promise, canEdit }: { promise: Promise<PolicySetting[]> | PromiseLike<PolicySetting[]>, canEdit: boolean }) {
  const data = use(promise) as PolicySetting[];
  return <PolicyConfigurationForm settings={data} canEdit={canEdit} />;
}
