"use client";

import { RefreshCw } from "lucide-react";
import { Section, AnnualResetTool } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";

interface OperationsSectionProps {
  role: string;
}

export function OperationsSection({ role: _role }: OperationsSectionProps) {
  return (
    <SettingsShell>
      <Section title="Fleet Maintenance" icon={RefreshCw} hideHeaderOnMobile>
        <AnnualResetTool />
      </Section>
    </SettingsShell>
  );
}
