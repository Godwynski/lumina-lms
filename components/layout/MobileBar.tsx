"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Home",
    icon: LayoutDashboard,
  },
  {
    href: "/catalog",
    label: "Catalog",
    icon: Library,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
  },
];

export function MobileBar() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background/80 backdrop-blur-lg px-4 pb-safe">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon size={20} className={cn(isActive && "text-primary")} strokeWidth={isActive ? 2.5 : 2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
