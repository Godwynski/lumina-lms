"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useCallback, use } from "react";
import { Search, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RoleBadge, ROLE_LABELS } from "@/components/common/RoleBadge";
import { bustAvatarCache } from "@/lib/utils/avatar-cache";
import type { UserRole } from "@/lib/auth-helpers";
import type { User } from "@/lib/types";
import { getUsers } from "@/lib/actions/users";
export type { User };


interface UsersContentProps {
  usersPromise: Promise<{ users: User[]; count: number }>;
  currentRole: UserRole;
}

export function UsersContent({ usersPromise, currentRole }: UsersContentProps) {
  const initialData = use(usersPromise);
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<User[]>(initialData.users);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalUsers, setTotalUsers] = useState(initialData.count);
  const [activeTab, setActiveTab] = useState<"all" | "super_admin" | "librarian" | "library_staff" | "patron" | "review" | "archived">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const pageSize = 12;

  const isLibrarian = currentRole === "librarian";
  const roleFilterLabels: Record<string, string> = {
    all: "All",
    review: "Pending Review",
    super_admin: ROLE_LABELS.super_admin,
    librarian: ROLE_LABELS.librarian,
    library_staff: ROLE_LABELS.library_staff,
    patron: ROLE_LABELS.patron,
    archived: "Archived",
  };

  // If librarian, remove 'super_admin' from filter options
  const filterOptions = ["all", "review", "super_admin", "librarian", "library_staff", "patron", "archived"] as const;
  const visibleTabs = filterOptions.filter(t => {
    if (isLibrarian && t === "super_admin") return false;
    if (t === "archived" && !["super_admin", "librarian"].includes(currentRole)) return false;
    return true;
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeTab]);

  const queryKey = JSON.stringify([activeTab, debouncedSearch, currentPage]);
  const lastLoadedKeyRef = React.useRef(JSON.stringify(["all", "", 1]));
  const loadRequestRef = React.useRef(0);

  const loadUsers = useCallback(async () => {
    // Only the latest request may update the list; slower older ones are dropped.
    const requestId = ++loadRequestRef.current;
    setIsLoadingUsers(true);
    setLoadError(null);
    try {
      const res = await getUsers({
        tab: activeTab,
        search: debouncedSearch,
        page: currentPage,
        pageSize,
      });
      if (requestId !== loadRequestRef.current) return;

      setUsers(res.users);
      setTotalUsers(res.total);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      if (requestId === loadRequestRef.current) setIsLoadingUsers(false);
    }
  }, [currentPage, debouncedSearch, activeTab, pageSize]);

  useEffect(() => {
    if (queryKey === lastLoadedKeyRef.current) return;
    lastLoadedKeyRef.current = queryKey;
    void loadUsers();
  }, [queryKey, loadUsers]);

  const loadUsersRef = React.useRef(loadUsers);
  useEffect(() => {
    loadUsersRef.current = loadUsers;
  }, [loadUsers]);

  // Realtime subscription
  useEffect(() => {
    const channelId = `users-realtime-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' }, 
        (payload) => {
          console.info('Realtime change received for profiles:', payload);
          void loadUsersRef.current();
        }
      )
      .subscribe((status) => {
        console.info(`Subscription status for ${channelId}:`, status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const columns = useMemo<LuminaColumn<User>[]>(() => [
    {
      header: "User",
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={bustAvatarCache(user.avatarUrl, user.updatedAt)} alt={user.name} className="object-cover" />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link href={`/users/${user.id}`} className="block truncate font-medium text-foreground underline-offset-2 hover:underline after:absolute after:inset-0">{user.name}</Link>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      )
    },
    {
      header: "ID",
      className: "whitespace-nowrap",
      cell: (user) => <span className="font-mono text-xs font-medium whitespace-nowrap">{user.student_id || "No ID"}</span>
    },
    {
      header: "Role",
      cell: (user) => <RoleBadge role={user.role} />
    },
    {
      header: "Status",
      cell: (user) => <StatusBadge status={user.status} />
    },
    {
      header: "Academic Program",
      className: "text-xs text-muted-foreground",
      cell: (user) => (
        <span className="text-xs text-muted-foreground">{user.department || "No Program"}</span>
      )
    }
  ], []);

  return (
    <>
      <AdminTableShell
        className="min-h-[calc(100vh-120px)]"
        feedback={
          loadError ? <div className="status-danger rounded-lg px-3 py-2 text-sm">{loadError}</div> : null
        }
        controls={(
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1 min-w-0 sm:max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search users by name or email"
                placeholder="Search by name or email"
                className="h-11 sm:h-10 pl-9 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Sheet open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 shrink-0 gap-2 rounded-xl px-3.5 lg:hidden"
                  aria-label={activeTab !== "all" ? `Filter users (${roleFilterLabels[activeTab]})` : "Filter users"}
                >
                  <Filter size={14} aria-hidden="true" />
                  <span>Filter</span>
                  {activeTab !== "all" && (
                    <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[11px]">1</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" responsiveBottom className="sm:max-w-[400px] p-0 overflow-hidden flex flex-col">
                <SheetHeader className="p-5 pb-3 border-b border-border/10">
                  <SheetTitle>Filter Users</SheetTitle>
                  <SheetDescription>
                    Filter the user directory by role, pending review, or archive status.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-2 p-5 overflow-y-auto">
                  {visibleTabs.map((tab) => (
                    <Button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setIsFilterModalOpen(false);
                      }}
                      variant={activeTab === tab ? "default" : "outline"}
                      aria-pressed={activeTab === tab}
                      className="justify-start h-11 sm:h-10 px-4 text-sm rounded-xl"
                    >
                      {roleFilterLabels[tab]}
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
            <select
              aria-label="Filter users by role or status"
              className="hidden h-10 max-w-full rounded-xl border border-input bg-background px-3 text-sm lg:block"
              value={activeTab}
              onChange={(event) => {
                const tab = visibleTabs.find((value) => value === event.currentTarget.value);
                if (tab) setActiveTab(tab);
              }}
            >
              {visibleTabs.map((tab) => (
                <option key={tab} value={tab}>{roleFilterLabels[tab]}</option>
              ))}
            </select>
          </div>
        )}
        pagination={
          !isLoadingUsers && totalUsers > 0 ? (
            <CompactPagination
              page={currentPage}
              totalItems={totalUsers}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          ) : null
        }
      >
        <LuminaTable
          data={users}
          columns={columns}
          isLoading={isLoadingUsers}
          rowClassName="relative"
          noBorder
          renderMobileRow={(user) => (
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={bustAvatarCache(user.avatarUrl, user.updatedAt)} alt={user.name} className="object-cover" />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/users/${user.id}`} className="block truncate font-medium text-foreground text-sm underline-offset-2 hover:underline after:absolute after:inset-0">{user.name}</Link>
                  <StatusBadge status={user.status} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                  <RoleBadge role={user.role} />
                  <span className="opacity-40">•</span>
                  <span className="font-mono">{user.student_id || "No ID"}</span>
                  <span className="opacity-40">•</span>
                  <span className="truncate">{user.department}</span>
                </div>
              </div>
            </div>
          )}
        />
      </AdminTableShell>
    </>
  );
}

