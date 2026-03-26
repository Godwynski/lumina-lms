"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
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
import { useState } from "react";
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
} from "@/components/ui/collapsible";

type Role = "admin" | "librarian" | "staff" | "student" | null;
interface Profile {
  full_name?: string | null;
  avatar_url?: string | null;
}

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
    id: "library",
    label: "Library",
    icon: Library,
    roles: ["admin", "librarian", "staff", "student"],
    children: [
      { href: "/protected/catalog", label: "Inventory", icon: Library, roles: ["admin", "librarian", "staff"] },
      { href: "/protected/student-catalog", label: "Catalog", icon: Library, roles: ["student"] },
      { href: "/protected/resources", label: "Digital Assets", icon: BookOpen, roles: ["admin", "librarian", "staff", "student"] },
      { href: "/protected/circulation", label: "Circulation", icon: History, roles: ["admin", "librarian", "staff"] },
    ],
  },
  {
    id: "management",
    label: "Administration",
    icon: Users,
    roles: ["admin", "librarian"],
    children: [
      { href: "/protected/admin/approvals", label: "Card Approvals", icon: ShieldCheck, roles: ["admin", "librarian"] },
      { href: "/protected/users", label: "User Directory", icon: Users, roles: ["admin", "librarian"] },
      { href: "/protected/reports", label: "Analytics", icon: BarChart2, roles: ["admin", "librarian", "staff"] },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    icon: Server,
    roles: ["admin", "librarian"],
    children: [
      { href: "/protected/settings?tab=policies", label: "System Policies", icon: Settings, roles: ["admin", "librarian"] },
      { href: "/protected/settings?tab=audit", label: "Audit Logs", icon: History, roles: ["admin"] },
      { href: "/protected/settings?tab=operations", label: "Operations", icon: LayoutDashboard, roles: ["admin"] },
      { href: "/protected/settings?tab=gdpr", label: "Compliance", icon: AlertTriangle, roles: ["admin"] },
    ],
  },
  {
    id: "account",
    label: "Personal",
    icon: History,
    roles: ["admin", "librarian", "staff", "student"],
    children: [
      { href: "/protected/my-card", label: "Library Card", icon: CreditCard, roles: ["admin", "librarian", "staff", "student"] },
      { href: "/protected/history", label: "Borrow History", icon: History, roles: ["admin", "librarian", "staff", "student"] },
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

  const settingsLinks = React.useMemo(() => {
    return [
      { id: "profile", label: "Profile" },
      { id: "preferences", label: "Preferences" },
      { id: "security", label: "Security" },
    ];
  }, []);

  const settingsTabIds = ["profile", "preferences", "security"];
  const isSettingsActive = pathname === "/protected/settings" && settingsTabIds.includes(currentTab);

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
    const pathWithoutQuery = pathname.split("?")[0];
    const hrefBase = href.split("?")[0];

    if (href.includes("?tab=")) {
      const hrefTab = href.split("?tab=")[1].split("&")[0];
      return pathWithoutQuery === hrefBase && currentTab === hrefTab;
    }

    return pathWithoutQuery.startsWith(hrefBase);
  };

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    filteredGroups.forEach(group => {
      initial[group.id] = group.children.some(child => isActive(child.href));
    });
    if (isSettingsActive) initial["settings"] = true;
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="flex h-20 shrink-0 items-center px-4">
        <Link href="/protected" className="flex items-center gap-3 group" aria-label="Lumina LMS Dashboard">
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
        <nav className="flex flex-col gap-4" aria-label="Main Navigation">
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
              <Collapsible
                  open={openGroups["settings"]}
                  onOpenChange={() => toggleGroup("settings")}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Settings"
                        isActive={isSettingsActive}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleGroup("settings");
                        }}
                      >
                        <Settings />
                        <span>Settings</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <AnimatePresence mode="wait">
                      {openGroups["settings"] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                          <SidebarMenuSub>
                            {settingsLinks.map((item) => {
                              const href = `/protected/settings?tab=${item.id}`;
                              const isSubActive = isSettingsActive && currentTab === item.id;
                              return (
                                <SidebarMenuSubItem key={item.id}>
                                  <SidebarMenuSubButton asChild isActive={isSubActive}>
                                    <Link href={href} className="flex items-center gap-2">
                                      <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isSubActive ? "bg-sidebar-primary" : "bg-sidebar-border")} />
                                      <span className={cn("truncate", isSubActive && "font-semibold text-sidebar-primary")}>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SidebarMenuItem>
                </Collapsible>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarMenu>
              {filteredGroups.map((group) => (
                <Collapsible
                  key={group.id}
                  open={openGroups[group.id]}
                  onOpenChange={() => toggleGroup(group.id)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={group.label}
                        isActive={group.children.some(child => isActive(child.href))}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleGroup(group.id);
                        }}
                      >
                        <group.icon />
                        <span>{group.label}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <AnimatePresence mode="wait">
                      {openGroups[group.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                          <SidebarMenuSub>
                            {group.children.map((item) => (
                              <SidebarMenuSubItem key={item.href}>
                                <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                                  <Link href={item.href} className="flex items-center gap-2">
                                    <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isActive(item.href) ? "bg-sidebar-primary" : "bg-sidebar-border")} />
                                    <span className={cn("truncate", isActive(item.href) && "font-semibold text-sidebar-primary")}>{item.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SidebarMenuItem>
                </Collapsible>
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
                    <AvatarImage src={avatarUrl} alt={name} />
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
                      <AvatarImage src={avatarUrl} alt={name} />
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
  );
}
