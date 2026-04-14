"use client";

import { RefreshCw } from "lucide-react";
import { Section, AnnualResetTool } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";

interface OperationsSectionProps {
  role: string;
}

export function OperationsSection({ role }: OperationsSectionProps) {
  return (
    <SettingsShell 
      title="Operations" 
      description="System maintenance and bulk tasks" 
      role={role}
    >
      <Section title="Fleet Maintenance" icon={RefreshCw} hideHeaderOnMobile>
        <AnnualResetTool />
      </Section>
    </SettingsShell>
  );
}
