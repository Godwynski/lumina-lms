"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  LayoutDashboard,
  Settings,
  Library,
  BookOpen,
  Users,
  ShieldCheck,
  BarChart2,
  History,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Role = "admin" | "librarian" | "staff" | "student" | null;

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Exclude<Role, null>[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: Exclude<Role, null>[];
  children: NavItem[];
};

const DASHBOARD_LINK: NavItem = {
  href: "/protected",
  label: "Dashboard",
  icon: LayoutDashboard,
  roles: ["admin", "librarian", "staff", "student"],
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "library-ops",
    label: "Catalog",
    icon: Library,
    roles: ["admin", "librarian", "staff", "student"],
    children: [
      { href: "/protected/catalog", label: "Inventory", icon: Library, roles: ["admin", "librarian", "staff"] },
      { href: "/protected/resources", label: "Digital Assets", icon: BookOpen, roles: ["admin", "librarian", "staff", "student"] },
    ],
  },
  {
    id: "management",
    label: "Resources",
    icon: Users,
    roles: ["admin", "librarian", "staff"],
    children: [
      { href: "/protected/users", label: "Users & Roles", icon: Users, roles: ["admin", "librarian", "staff"] },
      { href: "/protected/admin/approvals", label: "Card Approvals", icon: ShieldCheck, roles: ["admin", "librarian"] },
      { href: "/protected/reports", label: "Analytics", icon: BarChart2, roles: ["admin", "librarian", "staff"] },
    ],
  },
  {
    id: "account",
    label: "Activity",
    icon: History,
    roles: ["admin", "librarian", "staff", "student"],
    children: [
      { href: "/protected/history", label: "Loan History", icon: History, roles: ["admin", "librarian", "staff", "student"] },
      { href: "/protected/violations", label: "Violations", icon: AlertTriangle, roles: ["admin", "librarian", "staff", "student"] },
    ]
  }
];

function LuminaLogo({ size = 20 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative z-10 text-sidebar-foreground"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <circle cx="12" cy="12" r="3" className="fill-sidebar-foreground/10" />
      </svg>
    </div>
  );
}

export function ProtectedNav({
  authNode,
  role,
}: {
  authNode?: React.ReactNode;
  role?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "profile";
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() as Role : null;

  const settingsLinks = React.useMemo(() => {
    const links = [
      { id: "profile", label: "Profile" },
      { id: "preferences", label: "Preferences" },
      { id: "security", label: "Security" },
    ];
    if (normalizedRole === "admin" || normalizedRole === "librarian") {
      links.push(
        { id: "policies", label: "Policies" },
        { id: "categories", label: "Categories" }
      );
    }
    if (normalizedRole === "admin") {
      links.push(
        { id: "operations", label: "Operations" },
        { id: "audit", label: "Audit Logs" },
        { id: "gdpr", label: "GDPR" }
      );
    }
    return links;
  }, [normalizedRole]);

  const isSettingsActive = pathname === "/protected/settings";

  const filteredGroups = React.useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      children: group.children.filter(child => normalizedRole && child.roles.includes(normalizedRole))
    })).filter(group => {
      const canSeeGroup = normalizedRole && group.roles.includes(normalizedRole);
      const hasVisibleChildren = group.children.length > 0;
      return canSeeGroup && hasVisibleChildren;
    });
  }, [normalizedRole]);

  const isActive = (href: string) => {
    if (href === "/protected") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="flex h-20 shrink-0 items-center px-4">
        <Link href="/protected" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent shadow-sm transition-all duration-200 group-hover:border-sidebar-ring">
            <LuminaLogo size={20} />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="leading-none text-base font-bold tracking-tight text-sidebar-foreground">Lumina</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">LMS Platform</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <nav className="flex flex-col gap-4">
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(DASHBOARD_LINK.href)}
                  tooltip={DASHBOARD_LINK.label}
                >
                  <Link href={DASHBOARD_LINK.href}>
                    <DASHBOARD_LINK.icon />
                    <span>{DASHBOARD_LINK.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Collapsible defaultOpen={isSettingsActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Settings" isActive={isSettingsActive}>
                      <Settings />
                      <span>Settings</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsLinks.map((item) => {
                        const href = `/protected/settings?tab=${item.id}`;
                        const isSubActive = isSettingsActive && currentTab === item.id;
                        return (
                          <SidebarMenuSubItem key={item.id}>
                            <SidebarMenuSubButton asChild isActive={isSubActive}>
                              <Link href={href} className="flex items-center gap-2">
                                <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isSubActive ? "bg-sidebar-primary" : "bg-transparent")} />
                                <span className={cn("truncate", isSubActive && "font-semibold text-sidebar-primary")}>{item.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarMenu>
              {filteredGroups.map((group) => (
                <Collapsible
                  key={group.id}
                  asChild
                  defaultOpen={group.children.some(child => isActive(child.href))}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={group.label} isActive={group.children.some(child => isActive(child.href))}>
                        <group.icon />
                        <span>{group.label}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {group.children.map((item) => (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                              <Link href={item.href} className="flex items-center gap-2">
                                {isActive(item.href) ? (
                                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                                ) : (
                                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-transparent" />
                                )}
                                <span className={cn("truncate", isActive(item.href) && "font-semibold text-sidebar-primary")}>{item.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-4">
        <div className="group-data-[collapsible=icon]:hidden">
          {authNode}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
