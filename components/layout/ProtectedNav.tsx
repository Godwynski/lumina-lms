"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ChevronRight,
  LayoutDashboard,
  Settings,
  Library,
  Users,
  History,
  ChevronsUpDown,
  LogOut,
  Loader2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Logo } from "@/components/layout/Logo";
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
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { useLogout } from "@/hooks/use-logout";
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
  SidebarTrigger,
  useSidebar,
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
  href: "/dashboard",
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
      { href: "/student-catalog", label: "Catalog", icon: Library, exactRoles: ["student"] },
      { href: "/circulation", label: "Circulation Desk", icon: History, minRole: "staff" },
      { href: "/history", label: "Borrow History", icon: History, minRole: "student" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Shield,
    minRole: "librarian",
    children: [
      { href: "/users", label: "User Directory", icon: Users, minRole: "librarian" },
      { href: "/policies", label: "Settings & Policies", icon: Settings, minRole: "librarian" },
      { href: "/audit", label: "Audit Logs", icon: History, minRole: "admin" },
    ],
  },
];


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
  onMouseEnter,
  onNavigate
}: { 
  item: NavItem; 
  isActive: boolean; 
  onMouseEnter: (href: string) => void;
  onNavigate: (href: string) => void;
}) => (
  <SidebarMenuSubItem>
    <SidebarMenuSubButton asChild isActive={isActive}>
      <Link 
        href={item.href} 
        className="flex items-center gap-2"
        onMouseEnter={() => onMouseEnter(item.href)}
        onClick={(e) => {
          e.currentTarget.blur();
          onNavigate(item.href);
        }}
      >
        <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isActive ? "bg-sidebar-primary animate-pulse" : "bg-sidebar-border")} />
        <span className={cn("truncate group-data-[collapsible=icon]:hidden", isActive && "font-semibold text-sidebar-primary")}>{item.label}</span>
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
  onMouseEnter,
  onNavigate
}: { 
  group: NavGroup; 
  isOpen: boolean; 
  onToggle: (id: string) => void;
  isActive: (href: string) => boolean;
  onMouseEnter: (href: string) => void;
  onNavigate: (href: string) => void;
}) => {
  const { state, setOpen } = useSidebar();
  const isGroupActive = group.children.some(child => isActive(child.href));

  return (
    <SidebarMenuItem>
      <Collapsible
        open={isOpen}
        onOpenChange={() => onToggle(group.id)}
        className="group/collapsible"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={group.label}
            isActive={isGroupActive}
            onClick={() => {
              if (state === "collapsed") {
                setOpen(true);
              }
            }}
          >
            <group.icon />
            <span className="group-data-[collapsible=icon]:hidden">{group.label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
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
                onNavigate={onNavigate}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
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

  const router = useRouter();
  const { logout, isLoggingOut } = useLogout();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleSignOut = async () => {
    setLogoutDialogOpen(false);
    await logout();
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

  const currentTab = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "profile";
  }, [pathname]);
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() as Role : null;

  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    // Pro-tip: Clear pending route when natively navigated
    setPendingRoute(null);
  }, [pathname]);

  const handleNavigate = useCallback((href: string) => {
    if (pathname === href) return;
    const pathWithoutQuery = pathname.split("?")[0];
    const hrefBase = href.split("?")[0];
    // If we're already on the base path and it's not a tab switch, we ignore to avoid flicker.
    if (pathWithoutQuery === hrefBase && !href.includes("?tab=")) return;
    
    setPendingRoute(href);
  }, [pathname]);

  // Cache user data derived from props
  const userData = useMemo(() => ({
    name,
    email,
    avatarUrl,
    initials
  }), [name, email, avatarUrl, initials]);

  const isActive = useCallback((href: string) => {
    // If we have a pending route, that is the ONLY item that can be active.
    // This immediately deselects the old item.
    if (pendingRoute !== null) {
      return pendingRoute === href;
    }

    const pathWithoutQuery = pathname.split("?")[0];
    const hrefBase = href.split("?")[0];

    if (href === "/dashboard") return pathWithoutQuery === "/dashboard";

    const SETTINGS_PATHS = ["/profile", "/preferences", "/security", "/policies"];
    if (SETTINGS_PATHS.includes(hrefBase)) {
      return pathWithoutQuery === hrefBase;
    }

    if (href.includes("?tab=")) {
      const hrefTab = href.split("?tab=")[1].split("&")[0];
      return pathWithoutQuery === hrefBase && currentTab === hrefTab;
    }

    return pathWithoutQuery.startsWith(hrefBase);
  }, [pathname, currentTab, pendingRoute]);

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

  const allVisibleGroups = filteredGroups;

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
      <SidebarHeader className="flex flex-row h-16 shrink-0 items-center gap-4 px-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
        <SidebarTrigger className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors group-data-[collapsible=icon]:flex" />
        <Link 
          href="/dashboard" 
          className="flex items-center gap-3 shrink-0 group-data-[collapsible=icon]:hidden" 
          aria-label="Lumina LMS Platform"
        >
          <Logo size={20} className="scale-90 shrink-0" />
          <div className="flex flex-col whitespace-nowrap">
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
                  <Link 
                    href={DASHBOARD_LINK.href} 
                    className="flex items-center w-full group-data-[collapsible=icon]:justify-center" 
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleNavigate(DASHBOARD_LINK.href);
                    }}
                  >
                    {DASHBOARD_LINK.icon && <DASHBOARD_LINK.icon className="shrink-0" />}
                    <span className="truncate group-data-[collapsible=icon]:hidden">{DASHBOARD_LINK.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {filteredGroups.map(group => (
                <NavGroupItem 
                  key={group.id}
                  group={group}
                  isOpen={openGroups[group.id] || false}
                  onToggle={toggleGroup}
                  isActive={isActive}
                  onMouseEnter={handlePrefetch}
                  onNavigate={handleNavigate}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-2 hidden md:flex">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={userData.avatarUrl || ""} alt={userData.name} fetchPriority="high" />
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-bold">
                      {userData.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{userData.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{userData.email}</span>
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
                    <Link 
                      href="/profile" 
                      className="flex w-full cursor-pointer items-center" 
                      onClick={(e) => {
                        e.currentTarget.blur();
                        handleNavigate("/profile");
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Profile Settings</span>
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
                disabled={isLoggingOut}
              >
                Log out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarFooter>

      {isLoggingOut && (
        <Dialog open={isLoggingOut}>
          <DialogContent className="border-none bg-transparent p-0 shadow-none outline-none ring-0 focus:ring-0 [&>button]:hidden">
            <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl animate-in fade-in duration-500">
              <div className="flex flex-col items-center gap-6 p-12 rounded-3xl bg-card border shadow-2xl scale-110 animate-in zoom-in-95 duration-300">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-primary [animation-duration:3s]" />
                </div>
                <DialogHeader className="flex flex-col items-center gap-2">
                  <DialogTitle className="text-2xl font-bold tracking-tight">Logging out...</DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground font-medium text-center balance opacity-80">
                    Ending your current session safely.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <SidebarRail />
    </Sidebar>
    </SWRConfig>
  );
}
