"use client";

import * as React from "react";
import { m } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { NavigationGuard } from "@/components/layout/NavigationGuard";

interface SettingsShellProps {
  title: string;
  description: string;
  role: string | "student" | "staff" | "librarian" | "admin";
  isDirty?: boolean;
  children: React.ReactNode;
}

export function SettingsShell({ 
  description, 
  role, 
  isDirty = false, 
  children 
}: SettingsShellProps) {
  const isSuperAdmin = role === "admin";

  return (
    <div className="w-full pb-20 md:pb-8">
      <NavigationGuard isDirty={isDirty} />
      
      <m.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 border-b border-border pb-2 hidden md:block"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="border-border bg-muted text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {isSuperAdmin ? "Admin" : role}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </m.div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-4 lg:gap-6">
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
