"use client";

import * as React from "react";
import { NavigationGuard } from "@/components/layout/NavigationGuard";

interface SettingsShellProps {
  isDirty?: boolean;
  children: React.ReactNode;
}

export function SettingsShell({ 
  isDirty = false, 
  children 
}: SettingsShellProps) {
  return (
    <div className="min-w-0">
      <NavigationGuard isDirty={isDirty} />
      {children}
    </div>
  );
}
