"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Settings,
  Library,
  BookOpen,
  Users,
  RefreshCw,
  ScrollText,
  ChevronsUpDown,
  LogOut,
  Loader2,
  UserCheck,
  History,
  BarChart3,
  Layout,
  User as UserIcon,
} from "lucide-react";

import { updateUiPreference } from "@/lib/actions/preferences";
import { toast } from "sonner";


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
import { useState, useMemo, useCallback, useEffect } from "react";
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
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type Role = "student" | "student_assistant" | "librarian" | "admin" | null;

interface Profile {
  full_name?: string | null;
  avatar_url?: string | null;
  status?: string;
  permissions?: {
    manage_inventory?: boolean;
    manage_circulation?: boolean;
    manage_attendance?: boolean;
  } | null;
}

const ROLE_RANKS: Record<Exclude<Role, null>, number> = {
  student: 1,
  student_assistant: 2,
  librarian: 3,
  admin: 4,
};

function hasPermission(
  userRole: Role, 
  item: NavItem,
  profile?: Profile | null
): boolean {
  const { minRole, exactRoles, permissionKey } = item;
  
  if (exactRoles && exactRoles.length > 0 && userRole) {
    return exactRoles.includes(userRole);
  }

  if (!minRole) return true;
  if (!userRole) return false;

  const roleRank = ROLE_RANKS[userRole];
  const minRank = ROLE_RANKS[minRole];

  // If user is exactly student_assistant, check specific permissions if required
  if (userRole === "student_assistant" && permissionKey) {
    const permissions = profile?.permissions;
    if (permissions && permissions[permissionKey as keyof typeof permissions] === true) {
      return true;
    }
    // If they don't have the specific permission, they can't see it even if it's their rank
    return false;
  }

  return roleRank >= minRank;
}

type NavItem = {
  href: string;
  label: string;
  icon?: React.ElementType;
  minRole?: Exclude<Role, null>;
  exactRoles?: Exclude<Role, null>[];
  permissionKey?: "manage_inventory" | "manage_circulation" | "manage_attendance" | "manage_users" | "manage_policies" | "manage_analytics";
};



const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: "student" },
  { href: "/student-catalog", label: "Catalog", icon: BookOpen, minRole: "student", exactRoles: ["student", "student_assistant"] },
  { href: "/catalog", label: "Inventory", icon: Library, minRole: "librarian", permissionKey: "manage_inventory", exactRoles: ["student_assistant"] },
  { href: "/circulation", label: "Circulation Desk", icon: RefreshCw, minRole: "student_assistant", permissionKey: "manage_circulation" },
  { href: "/attendance", label: "Attendance", icon: UserCheck, minRole: "student", permissionKey: "manage_attendance" },
  { href: "/history", label: "Borrow History", icon: History, minRole: "student" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, minRole: "librarian", permissionKey: "manage_analytics" },
  { href: "/users", label: "User Directory", icon: Users, minRole: "librarian", permissionKey: "manage_users" },
  { href: "/policies", label: "Settings & Policies", icon: Settings, minRole: "librarian", permissionKey: "manage_policies" },
  { href: "/audit", label: "Audit Logs", icon: ScrollText, minRole: "admin" },
];
const SETTINGS_PATHS = ["/profile", "/preferences", "/security", "/policies"];

export function ProtectedNav({
  role,
  user,
  profile,
  preferences,
}: {
  role?: string | null;
  user?: User | null;
  profile?: Profile | null;
  preferences?: Record<string, unknown>;
}) {
  const pathname = usePathname();
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() as Role : null;

  const { logout, isLoggingOut } = useLogout();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isPending, startTransition] = React.useTransition();

  const isDeactivatedSA = normalizedRole === "student_assistant" && 
    profile?.status?.toUpperCase() !== "ACTIVE";

  const currentMode = isDeactivatedSA 
    ? "student" 
    : ((preferences?.preferred_dashboard_view as "student" | "staff") || 
       (normalizedRole === "student_assistant" ? "student" : "staff"));

  const handleToggleMode = () => {
    const newMode = currentMode === "staff" ? "student" : "staff";
    startTransition(async () => {
      const result = await updateUiPreference({
        key: "preferred_dashboard_view",
        value: newMode,
      });

      if (result.success) {
        const viewLabel = newMode === "staff" 
          ? (normalizedRole === "admin" ? "Admin" : normalizedRole === "librarian" ? "Librarian" : "Staff")
          : "Personal";
        toast.success(`Switched to ${viewLabel} View`);
      } else {
        toast.error("Failed to switch mode");
      }
    });
  };


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


  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    setPendingRoute(null);
  }, [pathname]);

  const handleNavigate = useCallback((href: string) => {
    if (pathname === href) return;
    const pathWithoutQuery = pathname.split("?")[0];
    const hrefBase = href.split("?")[0];
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
    if (pendingRoute !== null) {
      return pendingRoute === href;
    }

    const pathWithoutQuery = pathname.split("?")[0];
    const hrefBase = href.split("?")[0];

    if (href === "/dashboard") return pathWithoutQuery === "/dashboard";

    if (SETTINGS_PATHS.includes(hrefBase)) {
      return pathWithoutQuery === hrefBase;
    }

    if (href.includes("?tab=")) {
      const hrefTab = href.split("?tab=")[1].split("&")[0];
      return pathWithoutQuery === hrefBase && currentTab === hrefTab;
    }

    return pathWithoutQuery.startsWith(hrefBase);
  }, [pathname, currentTab, pendingRoute]);

  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      // Basic permission check
      if (!hasPermission(normalizedRole, item, profile)) return false;

      // If SA is disabled (e.g. status not ACTIVE), hide all staff-only tools
      if (isDeactivatedSA && (item.permissionKey || item.minRole === "librarian" || item.minRole === "admin")) {
        return false;
      }

      // If in Student mode, only show standard student tools
      if (currentMode === "student" && (item.permissionKey || item.minRole === "librarian" || item.minRole === "admin")) {
        if (item.href !== "/dashboard" && item.href !== "/student-catalog" && item.href !== "/attendance") {
           return false;
        }
      }

      return true;
    });
  }, [normalizedRole, profile, isDeactivatedSA, currentMode]);

  const handlePrefetch = useCallback((_href: string) => {
    // Next.js Link already handles prefetching on hover
  }, []);

  const swrValue = useMemo(() => ({
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  }), []);

  return (
    <SWRConfig value={swrValue}>
    <Sidebar 
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar"
    >
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

      <SidebarContent className="px-2 flex-1">
        <nav className="flex flex-col h-full" aria-label="Main Navigation">
          <SidebarGroup className="flex-1">
            <SidebarMenu>
              {visibleItems.map(item => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link 
                      href={item.href} 
                      className="flex items-center w-full group-data-[collapsible=icon]:justify-center" 
                      onClick={(e) => {
                        e.currentTarget.blur();
                        handleNavigate(item.href);
                      }}
                      onMouseEnter={() => handlePrefetch(item.href)}
                    >
                      {item.icon && <item.icon className="shrink-0" />}
                      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border bg-sidebar p-2 flex">
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
                      <span>My Profile</span>
                    </Link>
                  </DropdownMenuItem>

                  {(normalizedRole === "librarian" || normalizedRole === "admin" || (normalizedRole === "student_assistant" && !isDeactivatedSA)) && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggleMode();
                      }}
                      disabled={isPending}
                    >
                      {currentMode === "staff" ? (
                        <>
                          <UserIcon className="mr-2 h-4 w-4" />
                          <span>Switch to Personal View</span>
                        </>
                      ) : (
                        <>
                          <Layout className="mr-2 h-4 w-4" />
                          <span>Switch to {normalizedRole === "admin" ? "Admin" : normalizedRole === "librarian" ? "Librarian" : "Staff"} View</span>
                        </>
                      )}
                      {isPending && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
                    </DropdownMenuItem>
                  )}
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
