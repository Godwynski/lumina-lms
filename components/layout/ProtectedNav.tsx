"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Settings,
  BookOpen,
  BookMarked,
  Users,
  RefreshCw,
  ScrollText,
  ChevronsUpDown,
  LogOut,
  Loader2,
  UserCheck,
  History,
  BarChart3,
} from "lucide-react";




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
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useSearchParamsLite } from "@/hooks/use-search-params-lite";
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

import { Role, Profile, NavItem, hasPermission } from "@/lib/auth/permissions";

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: "student" },
  { href: "/student-catalog", label: "Catalog", icon: BookOpen, minRole: "student", excludeRoles: ["super_admin", "librarian"] },
  { href: "/inventory", label: "Inventory", icon: BookMarked, minRole: "student_assistant", permissionKey: "view_admin_dashboard" },
  { href: "/circulation", label: "Circulation Desk", icon: RefreshCw, minRole: "student_assistant", permissionKey: "manage_circulation" },
  { href: "/history", label: "Borrow History", icon: History, minRole: "student" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { href: "/users", label: "User Directory", icon: Users, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { href: "/attendance", label: "Attendance Logs", icon: UserCheck, minRole: "student" },
  { href: "/policies", label: "Settings & Policies", icon: Settings, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { href: "/audit", label: "Audit Logs", icon: ScrollText, minRole: "super_admin", permissionKey: "view_admin_dashboard" },
];
const SETTINGS_PATHS = ["/profile", "/preferences", "/security", "/policies"];

export function ProtectedNav({
  role: _initialRole,
  user,
  profile: _initialProfile,
  preferences: _initialPreferences,
}: {
  role?: string | null;
  user?: User | null;
  profile?: Profile | null;
  preferences?: Record<string, unknown>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParamsLite();
  const { role, profile } = usePreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentRole = role as Role;
  const currentProfile = profile as Profile | null;
  const { logout, isLoggingOut } = useLogout();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);


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


  const userData = useMemo(() => ({
    name,
    email,
    avatarUrl,
    initials
  }), [name, email, avatarUrl, initials]);

  const isActive = useCallback((href: string) => {
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
  }, [pathname, currentTab]);

  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      // Core Permission Check (Role Rank + Specific Permission Key)
      return hasPermission(currentRole, item, currentProfile);
    });
  }, [currentRole, currentProfile]);

  const handlePrefetch = useCallback((_href: string) => {
    // Next.js Link already handles prefetching on hover
  }, []);

  // ── Memoised nav-item list (previously an un-memoised IIFE) ─────────────
  const viewParam = mounted ? searchParams.get("view") : null;

  const hasAttendancePerm = currentRole === "super_admin" ||
    currentRole === "librarian" ||
    (currentRole === "student_assistant" && !!currentProfile?.permissions?.manage_attendance && currentProfile?.status?.toUpperCase() === 'ACTIVE');

  const hasCirculationPerm = currentRole === "super_admin" ||
    currentRole === "librarian" ||
    (currentRole === "student_assistant" && !!currentProfile?.permissions?.manage_circulation && currentProfile?.status?.toUpperCase() === 'ACTIVE');

  const navItemsToRender = useMemo(() => {
    const items: Array<{
      href: string;
      label: string;
      icon: NavItem["icon"];
      isActive: boolean;
    }> = [];

    visibleItems.forEach(item => {
      if (item.href === "/history") {
        const isStaffUser = currentRole === "super_admin" || currentRole === "librarian";
        
        if (isStaffUser) {
          // Staff gets ONLY Borrowing Logs
          items.push({
            href: "/history?view=logs",
            label: "Borrowing Logs",
            icon: item.icon,
            isActive: pathname === "/history"
          });
        } else {
          const isSAWithCirculation = currentRole === "student_assistant" && hasCirculationPerm;
          if (isSAWithCirculation) {
            // Authorized Student Assistants get BOTH My Borrowing and Borrowing Logs
            items.push({
              href: "/history",
              label: "My Borrowing",
              icon: item.icon,
              isActive: pathname === "/history" && viewParam !== "logs"
            });
            items.push({
              href: "/history?view=logs",
              label: "Borrowing Logs",
              icon: item.icon,
              isActive: pathname === "/history" && viewParam === "logs"
            });
          } else {
            // Regular students (and SAs without circulation permission) get ONLY My Borrowing
            items.push({
              href: "/history",
              label: "My Borrowing",
              icon: item.icon,
              isActive: pathname === "/history"
            });
          }
        }
      } else if (item.href === "/attendance") {
        if (currentRole === "student_assistant" && hasAttendancePerm) {
          // Student Assistant with attendance permission gets BOTH My Attendance and Attendance Logs
          items.push({
            href: "/attendance",
            label: "My Attendance",
            icon: item.icon,
            isActive: pathname === "/attendance" && viewParam !== "logs"
          });
          items.push({
            href: "/attendance?view=logs",
            label: "Attendance Logs",
            icon: item.icon,
            isActive: pathname === "/attendance" && viewParam === "logs"
          });
        } else {
          const isStaffUser = currentRole === "super_admin" || currentRole === "librarian";
          items.push({
            href: isStaffUser ? "/attendance?view=logs" : "/attendance",
            label: hasAttendancePerm ? "Attendance Logs" : "My Attendance",
            icon: item.icon,
            isActive: pathname === "/attendance"
          });
        }
      } else {
        items.push({
          href: item.href,
          label: item.label,
          icon: item.icon,
          isActive: isActive(item.href)
        });
      }
    });

    return items;
  }, [visibleItems, currentRole, hasCirculationPerm, hasAttendancePerm, pathname, viewParam, isActive]);


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
              {navItemsToRender.map(item => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.isActive}
                    tooltip={item.label}
                  >
                    <Link 
                      href={item.href} 
                      className="flex items-center w-full group-data-[collapsible=icon]:justify-center" 
                      onClick={(e) => {
                        e.currentTarget.blur();
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
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>My Profile</span>
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
  );
}
