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
    <div className="w-full pb-20 md:pb-8">
      <NavigationGuard isDirty={isDirty} />
      
      <div className="grid w-full grid-cols-1 items-start gap-4 lg:gap-6">
        {/* Plain div: the app shell already provides the page's <main> landmark. */}
        <div className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
