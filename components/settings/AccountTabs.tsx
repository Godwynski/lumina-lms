"use client";

import Link from "next/link";
import { User, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountTabsProps {
  active: "profile" | "security";
}

export function AccountTabs({ active }: AccountTabsProps) {
  const tabs = [
    { id: "profile" as const, label: "My Profile", href: "/profile", icon: User },
    { id: "security" as const, label: "Security", href: "/security", icon: Lock },
  ];

  return (
    <nav
      aria-label="Account settings"
      className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
