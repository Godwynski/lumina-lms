"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Settings,
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
import { createClient } from "@/lib/supabase/client";


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
  role?: string | null;
  permissions?: {
    manage_circulation?: boolean;
    manage_attendance?: boolean;
    view_admin_dashboard?: boolean;
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
  const isDeactivatedSA = userRole === "student_assistant" && profile?.status?.toUpperCase() !== "ACTIVE";

  // 1. Exact role match (highest priority)
  if (exactRoles && exactRoles.length > 0) {
    if (userRole && exactRoles.includes(userRole)) return true;
    // If exactRoles is specified and no match, and no minRole fallback, deny access
    if (!minRole) return false;
  }

  // 2. Minimum rank check
  if (!userRole) return false;
  const roleRank = ROLE_RANKS[userRole];
  const minRank = minRole ? ROLE_RANKS[minRole] : 0;

  if (roleRank < minRank) return false;

  // 3. Specific permission requirement for staff/admin tools
  if (permissionKey) {
    if (userRole === "admin" || userRole === "librarian") return true;
    const permissions = profile?.permissions;
    if (!permissions || !permissions[permissionKey as keyof typeof permissions]) {
      return false;
    }
  }

  // 4. Deactivation check
  if (isDeactivatedSA && (minRole !== "student" || permissionKey)) {
    return false;
  }

  return true;
}

type NavItem = {
  href: string;
  label: string;
  icon?: React.ElementType;
  minRole?: Exclude<Role, null>;
  exactRoles?: Exclude<Role, null>[];
  excludeRoles?: Exclude<Role, null>[];
  permissionKey?: "manage_circulation" | "manage_attendance" | "view_admin_dashboard";
};



const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: "student" },
  { href: "/student-catalog", label: "Catalog", icon: BookOpen, minRole: "student", excludeRoles: ["admin", "librarian", "student_assistant"] },
  { href: "/circulation", label: "Circulation Desk", icon: RefreshCw, minRole: "student_assistant", permissionKey: "manage_circulation" },
  { href: "/history", label: "Borrow History", icon: History, minRole: "student" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { href: "/users", label: "User Directory", icon: Users, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { href: "/attendance", label: "Attendance", icon: UserCheck, minRole: "student" },
  { href: "/policies", label: "Settings & Policies", icon: Settings, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { href: "/audit", label: "Audit Logs", icon: ScrollText, minRole: "librarian", permissionKey: "view_admin_dashboard" },
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
  const [supabase] = useState(() => createClient());
  const [currentRole, setCurrentRole] = useState<Role>(normalizedRole);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(profile ?? null);
  const [currentPrefs, setCurrentPrefs] = useState<Record<string, unknown>>(preferences || {});

  // Sync state if props change (e.g. initial server load)
  useEffect(() => {
    setCurrentRole(normalizedRole);
    setCurrentProfile(profile ?? null);
    setCurrentPrefs(preferences || {});
  }, [normalizedRole, profile, preferences]);

  // Real-time subscription for profile and permission changes
  useEffect(() => {
    if (!user?.id) return;

    const profileChannel = supabase
      .channel(`nav-profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newProfile = payload.new as Profile;
          setCurrentProfile(newProfile);
          if (newProfile.role) {
            setCurrentRole(newProfile.role.toLowerCase() as Role);
          }
        }
      )
      .subscribe();

    const prefsChannel = supabase
      .channel(`nav-prefs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ui_preferences",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const nextPrefs = (payload.new as { preferences?: Record<string, unknown> })?.preferences || {};
          setCurrentPrefs(nextPrefs);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(prefsChannel);
    };
  }, [user?.id, supabase]);

  const { logout, isLoggingOut } = useLogout();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isPending, startTransition] = React.useTransition();

  const isDeactivatedSA = currentRole === "student_assistant" && 
    currentProfile?.status?.toUpperCase() !== "ACTIVE";

  const hasAnyPermission = currentRole === "student_assistant"
    ? !!(currentProfile?.permissions?.manage_circulation || currentProfile?.permissions?.manage_attendance || currentProfile?.permissions?.view_admin_dashboard)
    : true;

  const currentMode = (isDeactivatedSA || (currentRole === "student_assistant" && !hasAnyPermission))
    ? "student" 
    : (currentRole === "admin" || currentRole === "librarian")
      ? "staff"
      : ((currentPrefs?.preferred_dashboard_view as "student" | "staff") || 
         (currentRole === "student" ? "student" : "staff"));

  const handleToggleMode = () => {
    const newMode = currentMode === "staff" ? "student" : "staff";
    
    // Update local state immediately for instant UI feedback
    setCurrentPrefs(prev => ({
      ...prev,
      preferred_dashboard_view: newMode
    }));

    startTransition(async () => {
      const result = await updateUiPreference({
        key: "preferred_dashboard_view",
        value: newMode,
      });

      if (result.success) {
        const viewLabel = newMode === "staff" 
          ? (currentRole === "admin" ? "Admin" : currentRole === "librarian" ? "Librarian" : "Staff")
          : "Personal";
        toast.success(`Switched to ${viewLabel} View`);
      } else {
        // Revert on failure
        setCurrentPrefs(prev => ({
          ...prev,
          preferred_dashboard_view: currentMode
        }));
        toast.error("Failed to switch mode");
      }
    });
  };


  const handleSignOut = async () => {
    setLogoutDialogOpen(false);
    await logout();
  };

  const name = currentProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const avatarUrl = currentProfile?.avatar_url || user?.user_metadata?.avatar_url;
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
      // 1. Core Permission Check (Role Rank + Specific Permission Key)
      if (!hasPermission(currentRole, item, currentProfile)) return false;

      // 2. View Mode Filtering
      if (currentMode === "staff") {
        // Staff View: Hide purely student-facing modules
        const studentOnly = ["/student-catalog", "/history"];
        if (studentOnly.includes(item.href)) return false;

        // Special case: Attendance only shows in staff view if you have manage permission
        // otherwise it stays in Personal View to avoid confusion with the management table
        if (item.href === "/attendance" && currentRole === "student_assistant") {
           const hasAttendancePerm = currentProfile?.permissions?.manage_attendance;
           if (!hasAttendancePerm) return false;
        }

        // Apply explicit exclusions
        if (currentRole && item.excludeRoles?.includes(currentRole)) return false;
      } else {
        // Personal/Student View: Only show basic personal modules
        const personalModules = ["/dashboard", "/student-catalog", "/attendance", "/history"];
        return personalModules.includes(item.href);
      }

      return true;
    });
  }, [currentRole, currentProfile, currentMode]);

  const handlePrefetch = useCallback((_href: string) => {
    // Next.js Link already handles prefetching on hover
  }, []);


  return (
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

                  {(currentRole === "student_assistant" && !isDeactivatedSA && hasAnyPermission) && (
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
                          <span>Switch to Staff View</span>
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
  );
}
