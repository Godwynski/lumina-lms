"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  LayoutDashboard,
  Settings,
  Library,
  BookOpen,
  RotateCcw,
  Users,
  ShieldCheck,
  BarChart2,
  History,
  CreditCard,
  BookMarked,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
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

type GroupSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: Exclude<Role, null>[];
  children: NavItem[];
};

type NavGroup = {
  label: string;
  roles: Exclude<Role, null>[];
  sections: GroupSection[];
};

const DASHBOARD_LINK: NavItem = {
  href: "/protected",
  label: "Dashboard",
  icon: LayoutDashboard,
  roles: ["admin", "librarian", "staff", "student"],
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Library Operations",
    roles: ["admin", "librarian", "staff", "student"],
    sections: [
      {
        id: "catalog",
        label: "Catalog",
        icon: Library,
        roles: ["admin", "librarian", "staff", "student"],
        children: [
          { href: "/protected/catalog", label: "Inventory", icon: Library, roles: ["admin", "librarian", "staff"] },
          { href: "/protected/student-catalog", label: "Book Catalog", icon: Library, roles: ["student"] },
          { href: "/protected/resources", label: "Digital Assets", icon: BookOpen, roles: ["admin", "librarian", "staff", "student"] },
        ],
      },
    ]
  },
  {
    label: "Management",
    roles: ["admin", "librarian", "staff"],
    sections: [
      {
        id: "people",
        label: "Resources",
        icon: Users,
        roles: ["admin", "librarian", "staff"],
        children: [
          { href: "/protected/users", label: "Users & Roles", icon: Users, roles: ["admin", "librarian", "staff"] },
          { href: "/protected/admin/approvals", label: "Card Approvals", icon: ShieldCheck, roles: ["admin", "librarian"] },
          { href: "/protected/reports", label: "Analytics", icon: BarChart2, roles: ["admin", "librarian", "staff"] },
        ],
      }
    ]
  },
  {
    label: "Account",
    roles: ["admin", "librarian", "staff", "student"],
    sections: [
      {
        id: "activity",
        label: "Activity",
        icon: History,
        roles: ["admin", "librarian", "staff", "student"],
        children: [
          { href: "/protected/history", label: "Loan History", icon: History, roles: ["admin", "librarian", "staff", "student"] },
          { href: "/protected/my-card", label: "Library Card", icon: CreditCard, roles: ["staff", "student"] },
          { href: "/protected/fines", label: "Fines & Dues", icon: BookMarked, roles: ["admin", "librarian", "staff", "student"] },
        ],
      },
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
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() as Role : null;

  const filteredGroups = React.useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      sections: group.sections.filter(section => {
        const canSeeSection = normalizedRole && section.roles.includes(normalizedRole);
        const hasVisibleChildren = section.children.some(child => normalizedRole && child.roles.includes(normalizedRole));
        return canSeeSection && hasVisibleChildren;
      }).map(section => ({
        ...section,
        children: section.children.filter(child => normalizedRole && child.roles.includes(normalizedRole))
      }))
    })).filter(group => group.sections.length > 0 && (!normalizedRole || group.roles.includes(normalizedRole)));
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
        <SidebarGroup>
          <SidebarMenu>
            {normalizedRole && ["admin", "librarian", "staff"].includes(normalizedRole) && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/protected/circulation')}
                  tooltip="Circulation Desk"
                >
                  <Link href="/protected/circulation">
                    <RotateCcw />
                    <span>Circulation Desk</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
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
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === "/protected/settings"}
                tooltip="Settings"
              >
                <Link href="/protected/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.sections.map((section) => (
                <Collapsible
                  key={section.id}
                  asChild
                  defaultOpen={section.children.some(child => isActive(child.href))}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={section.label}>
                        <section.icon />
                        <span>{section.label}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.children.map((item) => (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                              <Link href={item.href}>
                                <span>{item.label}</span>
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
        ))}
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
