"use client";

import { Section, AnnualResetTool } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";

interface OperationsSectionProps {
  role: string;
}

export function OperationsSection({ role: _role }: OperationsSectionProps) {
  return (
    <SettingsShell>
      <Section>
        <AnnualResetTool />
      </Section>
    </SettingsShell>
  );
}
