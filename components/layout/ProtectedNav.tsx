"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
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
  CreditCard,
  ChevronsUpDown,
  LogOut,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { SWRConfig } from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

type Role = "student" | "staff" | "librarian" | "admin" | null;

interface Profile {
  full_name?: string | null;
  avatar_url?: string | null;
}

const ROLE_RANKS: Record<Exclude<Role, null>, number> = {
  student: 1,
  staff: 2,
  librarian: 3,
  admin: 4,
};

function hasPermission(userRole: Role, minRole?: Exclude<Role, null>, exactRoles?: Exclude<Role, null>[]): boolean {
  if (exactRoles && exactRoles.length > 0 && userRole) {
    return exactRoles.includes(userRole);
  }
  if (!minRole) return true;
  if (!userRole) return false;
  return ROLE_RANKS[userRole] >= ROLE_RANKS[minRole];
}

type NavItem = {
  href: string;
  label: string;
  icon?: React.ElementType;
  minRole?: Exclude<Role, null>;
  exactRoles?: Exclude<Role, null>[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  minRole?: Exclude<Role, null>;
  exactRoles?: Exclude<Role, null>[];
  children: NavItem[];
};

const DASHBOARD_LINK: NavItem = {
  href: "/protected",
  label: "Dashboard",
  icon: LayoutDashboard,
  minRole: "student",
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "library",
    label: "Library",
    icon: Library,
    minRole: "student",
    children: [
      { href: "/protected/catalog", label: "Inventory", icon: Library, minRole: "staff" },
      { href: "/protected/student-catalog", label: "Catalog", icon: Library, exactRoles: ["student"] },
      { href: "/protected/resources", label: "Digital Assets", icon: BookOpen, minRole: "student" },
      { href: "/protected/circulation", label: "Circulation", icon: History, minRole: "staff" },
    ],
  },
  {
    id: "management",
    label: "Administration",
    icon: Users,
    minRole: "librarian",
    children: [
      { href: "/protected/admin/approvals", label: "Card Approvals", icon: ShieldCheck, minRole: "librarian" },
      { href: "/protected/users", label: "User Directory", icon: Users, minRole: "librarian" },
      { href: "/protected/reports", label: "Analytics", icon: BarChart2, minRole: "staff" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    icon: Server,
    minRole: "librarian",
    children: [
      { href: "/protected/settings?tab=policies", label: "System Policies", icon: Settings, minRole: "librarian" },
      { href: "/protected/audit", label: "Audit Logs", icon: History, minRole: "admin" },
      { href: "/protected/settings?tab=operations", label: "Operations", icon: LayoutDashboard, minRole: "admin" },
      { href: "/protected/settings?tab=gdpr", label: "Compliance", icon: AlertTriangle, minRole: "admin" },
    ],
  },
  {
    id: "account",
    label: "Personal",
    icon: History,
    minRole: "student",
    children: [
      { href: "/protected/my-card", label: "Library Card", icon: CreditCard, minRole: "student" },
      { href: "/protected/history", label: "Borrow History", icon: History, minRole: "student" },
      { href: "/protected/violations", label: "Violations", icon: AlertTriangle, minRole: "student" },
    ]
  }
];

const SETTINGS_GROUP: NavGroup = {
  id: "settings",
  label: "Settings",
  icon: Settings,
  minRole: "student",
  children: [
    { href: "/protected/settings?tab=profile", label: "Profile" },
    { href: "/protected/settings?tab=preferences", label: "Preferences" },
    { href: "/protected/settings?tab=security", label: "Security" },
  ]
};

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

// Prefetch helper
const prefetch = (router: ReturnType<typeof useRouter>, href: string) => {
  if (href && !href.includes("?")) {
    router.prefetch(href);
  }
};

// Optimized sub-menu item to prevent re-renders when other items change
const NavSubItem = memo(({ 
  item, 
  isActive, 
  onMouseEnter 
}: { 
  item: NavItem; 
  isActive: boolean; 
  onMouseEnter: (href: string) => void;
}) => (
  <SidebarMenuSubItem>
    <SidebarMenuSubButton asChild isActive={isActive}>
      <Link 
        href={item.href} 
        className="flex items-center gap-2"
        onMouseEnter={() => onMouseEnter(item.href)}
      >
        <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isActive ? "bg-sidebar-primary" : "bg-sidebar-border")} />
        <span className={cn("truncate", isActive && "font-semibold text-sidebar-primary")}>{item.label}</span>
      </Link>
    </SidebarMenuSubButton>
  </SidebarMenuSubItem>
));
NavSubItem.displayName = "NavSubItem";

// Memoized group item to prevent heavy DOM reconciliations on parent state change
const NavGroupItem = memo(({ 
  group, 
  isOpen, 
  onToggle, 
  isActive,
  onMouseEnter
}: { 
  group: NavGroup; 
  isOpen: boolean; 
  onToggle: (id: string) => void;
  isActive: (href: string) => boolean;
  onMouseEnter: (href: string) => void;
}) => {
  const isGroupActive = group.children.some(child => isActive(child.href));

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={() => onToggle(group.id)}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={group.label}
            isActive={isGroupActive}
            onMouseEnter={() => {
              if (!isOpen) onToggle(group.id);
            }}
            onClick={(e) => {
              e.preventDefault();
              onToggle(group.id);
            }}
          >
            <group.icon />
            <span>{group.label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down px-2">
          <SidebarMenuSub>
            {group.children.map((item) => (
              <NavSubItem 
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                onMouseEnter={onMouseEnter}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
});

NavGroupItem.displayName = "NavGroupItem";

export function ProtectedNav({
  role,
  user,
  profile,
}: {
  role?: string | null;
  user?: User | null;
  profile?: Profile | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    setLogoutDialogOpen(false);
    router.refresh();
    router.push("/auth/login");
  };

  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentTab = searchParams.get("tab") || "profile";
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() as Role : null;

  const isActive = useCallback((href: string) => {
    if (href === "/protected") return pathname === href;
    const pathWithoutQuery = pathname.split("?")[0];
    const hrefBase = href.split("?")[0];

    if (href.includes("?tab=")) {
      const hrefTab = href.split("?tab=")[1].split("&")[0];
      return pathWithoutQuery === hrefBase && currentTab === hrefTab;
    }

    return pathWithoutQuery.startsWith(hrefBase);
  }, [pathname, currentTab]);

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      children: group.children.filter(child => hasPermission(normalizedRole, child.minRole, child.exactRoles))
    })).filter(group => {
      const canSeeGroup = hasPermission(normalizedRole, group.minRole, group.exactRoles);
      const hasVisibleChildren = group.children.length > 0;
      return canSeeGroup && hasVisibleChildren;
    });
  }, [normalizedRole]);

  const allVisibleGroups = useMemo(() => {
    const settingsGroupFiltered = {
      ...SETTINGS_GROUP,
      children: SETTINGS_GROUP.children.filter(child => hasPermission(normalizedRole, child.minRole, child.exactRoles))
    };
    return [settingsGroupFiltered, ...filteredGroups];
  }, [filteredGroups, normalizedRole]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allVisibleGroups.forEach(group => {
      if (group.children.some(child => isActive(child.href))) {
        initial[group.id] = true;
      }
    });
    return initial;
  });

  // Track if we need to expand a group because of a new pathname
  useEffect(() => {
    let changed = false;
    const nextOpenGroups = { ...openGroups };

    allVisibleGroups.forEach((group) => {
      if (group.children.some((child) => isActive(child.href)) && !openGroups[group.id]) {
        nextOpenGroups[group.id] = true;
        changed = true;
      }
    });

    if (changed) {
      setOpenGroups(nextOpenGroups);
    }
  }, [pathname, allVisibleGroups, isActive, openGroups]);

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const dashboardActive = isActive(DASHBOARD_LINK.href);
  const settingsGroupProps = useMemo(() => ({
    ...SETTINGS_GROUP,
    children: SETTINGS_GROUP.children.filter(child => hasPermission(normalizedRole, child.minRole, child.exactRoles))
  }), [normalizedRole]);

  const handlePrefetch = useCallback((href: string) => {
    prefetch(router, href);
  }, [router]);

  return (
    <SWRConfig 
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
      }}
    >
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="flex h-20 shrink-0 items-center px-4">
        <Link href="/protected" className="flex items-center gap-3 group" aria-label="Lumina LMS Dashboard">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent shadow-sm transition-all duration-200 group-hover:border-sidebar-ring" aria-hidden="true">
            <LuminaLogo size={20} />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="leading-none text-base font-bold tracking-tight text-sidebar-foreground">Lumina</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">LMS Platform</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <nav className="flex flex-col gap-4" aria-label="Main Navigation">
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={dashboardActive}
                  tooltip={DASHBOARD_LINK.label}
                >
                  <Link href={DASHBOARD_LINK.href}>
                    {DASHBOARD_LINK.icon && <DASHBOARD_LINK.icon />}
                    <span>{DASHBOARD_LINK.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <NavGroupItem 
                group={settingsGroupProps}
                isOpen={openGroups[settingsGroupProps.id] || false}
                onToggle={toggleGroup}
                isActive={isActive}
                onMouseEnter={handlePrefetch}
              />
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarMenu>
              {filteredGroups.map(group => (
                <NavGroupItem 
                  key={group.id}
                  group={group}
                  isOpen={openGroups[group.id] || false}
                  onToggle={toggleGroup}
                  isActive={isActive}
                  onMouseEnter={handlePrefetch}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={avatarUrl || ""} alt={name} />
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1.8 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={avatarUrl || ""} alt={name} />
                      <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{name}</span>
                      <span className="truncate text-xs text-muted-foreground">{email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/protected/settings" className="flex w-full cursor-pointer items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer font-semibold text-red-600 focus:text-red-600"
                  onSelect={(event) => {
                    event.preventDefault();
                    setLogoutDialogOpen(true);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <DialogContent className="max-w-sm rounded-xl p-5">
            <DialogHeader>
              <DialogTitle className="text-base">Log out?</DialogTitle>
              <DialogDescription>
                You will be signed out of your current session.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="h-9 rounded-lg" onClick={() => setLogoutDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-9 rounded-lg"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out..." : "Log out"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    </SWRConfig>
  );
}
