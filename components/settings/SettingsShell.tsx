"use client";

import * as React from "react";
import { NavigationGuard } from "@/components/layout/NavigationGuard";

interface SettingsShellProps {
  isDirty?: boolean;
  children: React.ReactNode;
  // Deprecated redundant props
  title?: string;
  description?: string;
  role?: string;
}

export function SettingsShell({ 
  isDirty = false, 
  children 
}: SettingsShellProps) {
  return (
    <div className="w-full pb-20 md:pb-8">
      <NavigationGuard isDirty={isDirty} />
      
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-4 lg:gap-6">
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
