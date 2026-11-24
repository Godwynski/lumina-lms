"use client";

import * as React from "react";
import Link, { useLinkStatus } from "next/link";
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
import { useState, useMemo, useEffect, useRef } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { bustAvatarCache } from "@/lib/utils/avatar-cache";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { Role, Profile, NavItem, hasPermission } from "@/lib/auth/permissions";
import { getReportDatasets } from "@/lib/auth/report-access";

type NavGroupKey = "daily" | "records" | "manage" | "admin";

type GroupedNavItem = NavItem & {
  group: NavGroupKey;
};

const NAV_GROUPS: Array<{ key: NavGroupKey; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "records", label: "Records" },
  { key: "manage", label: "Manage" },
  { key: "admin", label: "Admin" },
];

const NAV_ITEMS: GroupedNavItem[] = [
  { group: "daily", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: "patron" },
  { group: "daily", href: "/student-catalog", label: "Catalog", icon: BookOpen, minRole: "patron" },
  { group: "daily", href: "/circulation", label: "Circulation Desk", icon: RefreshCw, minRole: "library_staff", permissionKey: "manage_circulation" },
  { group: "records", href: "/history", label: "My Borrowing", icon: History, minRole: "patron" },
  { group: "records", href: "/attendance", label: "Attendance Logs", icon: UserCheck, minRole: "patron" },
  { group: "manage", href: "/inventory", label: "Inventory", icon: BookMarked, minRole: "library_staff", permissionKey: "manage_inventory" },
  { group: "manage", href: "/users", label: "User Directory", icon: Users, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { group: "admin", href: "/analytics", label: "Analytics", icon: BarChart3, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { group: "admin", href: "/policies", label: "System Policies", icon: Settings, minRole: "librarian", permissionKey: "view_admin_dashboard" },
  { group: "admin", href: "/audit", label: "Audit Logs", icon: ScrollText, minRole: "librarian", permissionKey: "view_admin_dashboard" },
];
function NavLinkStatus() {
  const { pending } = useLinkStatus();

  return (
    <span
      role="status"
      className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:bottom-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:size-3"
    >
      {pending && (
        <>
          <Loader2 aria-hidden="true" className="size-full motion-safe:animate-spin" />
          <span className="sr-only">Loading page</span>
        </>
      )}
    </span>
  );
}

export function ProtectedNav({ user }: { user?: User | null }) {
  const { isMobile, setOpenMobile } = useSidebar();
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
  const [accountFooter, setAccountFooter] = useState<HTMLDivElement | null>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);

  const name = currentProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const rawAvatarUrl = currentProfile?.avatar_url || user?.user_metadata?.avatar_url;
  const avatarUrl = bustAvatarCache(rawAvatarUrl, profile?.updated_at);
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const userData = useMemo(() => ({
    name,
    email,
    avatarUrl,
    initials
  }), [name, email, avatarUrl, initials]);

  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.href === "/analytics") return getReportDatasets(currentRole, currentProfile).length > 0;
      // Core Permission Check (Role Rank + Specific Permission Key)
      return hasPermission(currentRole, item, currentProfile);
    });
  }, [currentRole, currentProfile]);

  // ── Memoised nav-item list (previously an un-memoised IIFE) ─────────────
  const viewParam = mounted ? searchParams.get("view") : null;

  const hasAttendancePerm = currentRole === "super_admin" ||
    currentRole === "librarian" ||
    (currentRole === "library_staff" && !!currentProfile?.permissions?.manage_attendance && currentProfile?.status?.toUpperCase() === 'ACTIVE');

  const hasCirculationPerm = currentRole === "super_admin" ||
    currentRole === "librarian" ||
    (currentRole === "library_staff" && !!currentProfile?.permissions?.manage_circulation && currentProfile?.status?.toUpperCase() === 'ACTIVE');

  const navGroupsToRender = useMemo(() => {
    const items: Array<{
      group: NavGroupKey;
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
            group: item.group,
            href: "/history?view=logs",
            label: "Borrowing Logs",
            icon: item.icon,
            isActive: pathname === "/history"
          });
        } else {
          const isSAWithCirculation = currentRole === "library_staff" && hasCirculationPerm;
          if (isSAWithCirculation) {
            // Authorized Student Assistants get BOTH My Borrowing and Borrowing Logs
            items.push({
              group: item.group,
              href: "/history",
              label: "My Borrowing",
              icon: item.icon,
              isActive: pathname === "/history" && viewParam !== "logs"
            });
            items.push({
              group: item.group,
              href: "/history?view=logs",
              label: "Borrowing Logs",
              icon: item.icon,
              isActive: pathname === "/history" && viewParam === "logs"
            });
          } else {
            // Regular students (and SAs without circulation permission) get ONLY My Borrowing
            items.push({
              group: item.group,
              href: "/history",
              label: "My Borrowing",
              icon: item.icon,
              isActive: pathname === "/history"
            });
          }
        }
      } else if (item.href === "/attendance") {
        if (currentRole === "library_staff" && hasAttendancePerm) {
          // Student Assistant with attendance permission gets BOTH My Attendance and Attendance Logs
          items.push({
            group: item.group,
            href: "/attendance",
            label: "My Attendance",
            icon: item.icon,
            isActive: pathname === "/attendance" && viewParam !== "logs"
          });
          items.push({
            group: item.group,
            href: "/attendance?view=logs",
            label: "Attendance Logs",
            icon: item.icon,
            isActive: pathname === "/attendance" && viewParam === "logs"
          });
        } else {
          const isStaffUser = currentRole === "super_admin" || currentRole === "librarian";
          items.push({
            group: item.group,
            href: isStaffUser ? "/attendance?view=logs" : "/attendance",
            label: hasAttendancePerm ? "Attendance Logs" : "My Attendance",
            icon: item.icon,
            isActive: pathname === "/attendance"
          });
        }
      } else {
        items.push({
          group: item.group,
          href: item.href,
          label: item.label,
          icon: item.icon,
          isActive: pathname === item.href ||
            (item.href !== "/dashboard" && item.href !== "/policies" && pathname.startsWith(`${item.href}/`))
        });
      }
    });

    return NAV_GROUPS
      .map(group => ({
        key: group.key,
        label: group.label,
        items: items.filter(i => i.group === group.key),
      }))
      .filter(group => group.items.length > 0);
  }, [visibleItems, currentRole, hasCirculationPerm, hasAttendancePerm, pathname, viewParam]);


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

        >
          <Logo size={20} className="scale-90 shrink-0" />
          <div className="flex flex-col whitespace-nowrap">
            <span className="leading-none text-base font-bold tracking-tight text-sidebar-foreground">Lumina</span>
            <span className="mt-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">LMS Platform</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 flex-1">
        <nav className="flex flex-col h-full gap-1" aria-label="Main Navigation">
          {navGroupsToRender.map(group => (
            <SidebarGroup key={group.key} className="py-1.5">
              <SidebarGroupLabel className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.isActive}
                      tooltip={item.label}
                    >
                      <Link 
                        href={item.href}
                        aria-label={item.label}
                        aria-current={item.isActive ? (pathname === item.href.split('?')[0] ? 'page' : 'location') : undefined}
                        className="relative flex items-center w-full group-data-[collapsible=icon]:justify-center"
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        {item.icon && <item.icon className="shrink-0" />}
                        <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                        <NavLinkStatus />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter ref={isMobile ? setAccountFooter : undefined} className="mt-auto border-t border-sidebar-border bg-sidebar p-2 flex">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  ref={accountTrigger}
                  size="lg"
                  closeOnMobile={false}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar aria-hidden="true" className="h-8 w-8 rounded-lg">
                    <AvatarImage src={userData.avatarUrl || ""} alt="" fetchPriority="high" />
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-bold">
                      {userData.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{userData.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{userData.email}</span>
                  </div>
                  <span className="sr-only">Account menu for {userData.name}</span>
                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                portalContainer={isMobile ? accountFooter : undefined}
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
                onCloseAutoFocus={(event) => {
                  if (logoutDialogOpen) event.preventDefault();
                }}
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
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
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
                  onSelect={() => setLogoutDialogOpen(true)}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <Dialog
          open={logoutDialogOpen}
          onOpenChange={(open) => {
            if (!isLoggingOut) setLogoutDialogOpen(open);
          }}
        >
          <DialogContent
            portalContainer={isMobile ? accountFooter : undefined}
            showCloseButton={!isLoggingOut}
            onCloseAutoFocus={(event) => {
              if (accountTrigger.current) {
                event.preventDefault();
                accountTrigger.current.focus();
              }
            }}
            className="max-w-sm rounded-xl p-5"
          >
            {isLoggingOut ? (
              <DialogHeader className="items-center py-4 text-center">
                <Loader2 aria-hidden="true" className="mb-2 size-8 text-primary motion-safe:animate-spin" />
                <DialogTitle>Logging out...</DialogTitle>
                <DialogDescription>Ending your current session.</DialogDescription>
              </DialogHeader>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">Log out?</DialogTitle>
                  <DialogDescription>You will be signed out of your current session.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" className="h-11 rounded-lg sm:h-9" onClick={() => setLogoutDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" className="h-11 rounded-lg sm:h-9" onClick={logout}>
                    Log out
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
