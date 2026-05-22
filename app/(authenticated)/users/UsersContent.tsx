"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useCallback, use } from "react";
import { Search, Filter } from "lucide-react";
import { sanitizeFilterInput } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RoleBadge } from "@/components/common/RoleBadge";
import { mapProfileToUser } from "@/lib/utils/mappers";
import { bustAvatarCache } from "@/lib/utils/avatar-cache";
import type { UserRole } from "@/lib/auth-helpers";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "super_admin" | "librarian" | "student_assistant" | "student";
  status: string;
  department: string;
  joined: string;
  student_id: string | null;
  address: string | null;
  phone: string | null;
  updatedAt: string | null;
  onboarding_completed?: boolean;
  library_card?: {
    card_number: string;
    status: string;
    expires_at: string | null;
  } | null;
  permissions?: Record<string, boolean>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
  department: string | null;
  created_at: string | null;
};


interface UsersContentProps {
  usersPromise: Promise<{ users: User[]; count: number }>;
  currentRole: UserRole;
}

export function UsersContent({ usersPromise, currentRole }: UsersContentProps) {
  const router = useRouter();
  const initialData = use(usersPromise);
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<User[]>(initialData.users);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalUsers, setTotalUsers] = useState(initialData.count);
  const [activeTab, setActiveTab] = useState<"all" | "super_admin" | "librarian" | "student_assistant" | "student" | "review" | "archived">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const pageSize = 12;

  const isLibrarian = currentRole === "librarian";

  const roleFilterLabels: Record<string, string> = {
    all: "All",
    review: "Pending Review",
    super_admin: "Super Admin",
    librarian: "Librarian",
    student_assistant: "Student Assistant",
    student: "Student",
    archived: "Archived",
  };

  // If librarian, remove 'super_admin' from filter options
  const filterOptions = ["all", "review", "super_admin", "librarian", "student_assistant", "student", "archived"] as const;
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

  const isInitialMount = React.useRef(true);

  const loadUsers = useCallback(async (isInitial = false) => {
    if (isInitial && isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setIsLoadingUsers(true);
    setLoadError(null);
    try {
      let queryBuilder = supabase
        .from("profiles")
        .select("*", { count: "exact" });

      if (activeTab === "review") {
        queryBuilder = queryBuilder.eq("status", "PENDING");
      } else if (activeTab === "archived") {
        queryBuilder = queryBuilder.eq("status", "ARCHIVED");
      } else if (activeTab !== "all") {
        queryBuilder = queryBuilder.eq("role", activeTab).neq("status", "ARCHIVED");
      } else {
        // "all" tab: exclude archived
        queryBuilder = queryBuilder.neq("status", "ARCHIVED");
      }

      // Librarian Restriction: Hide super admins
      if (isLibrarian) {
        queryBuilder = queryBuilder.neq("role", "super_admin");
      }

      if (debouncedSearch) {
        const safe = sanitizeFilterInput(debouncedSearch);
        queryBuilder = queryBuilder.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await queryBuilder
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const nextUsers = ((data ?? []) as ProfileRow[]).map(mapProfileToUser);
      setUsers(nextUsers);
      setTotalUsers(count ?? 0);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [supabase, currentPage, debouncedSearch, activeTab, pageSize, isLibrarian]);

  useEffect(() => {
    void loadUsers(true);
  }, [loadUsers]);

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

  const handleUserClick = useCallback((u: User) => {
    router.push(`/users/${u.id}`);
  }, [router]);

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
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      )
    },
    {
      header: "ID",
      className: "w-[120px]",
      cell: (user) => <span className="font-mono text-xs font-medium">{user.student_id || "No ID"}</span>
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
          <>
            <div className="relative w-full sm:max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or email"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 px-3 gap-2">
                  <Filter size={14} />
                  <span className="hidden sm:inline">Filter</span>
                  {activeTab !== "all" && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] min-w-5 justify-center">
                      {roleFilterLabels[activeTab]}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Filter Users</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 py-4">
                  {visibleTabs.map((tab) => (
                    <Button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setIsFilterModalOpen(false);
                      }}
                      variant={activeTab === tab ? "default" : "outline"}
                      className="justify-start h-10 px-4 text-sm"
                    >
                      {roleFilterLabels[tab]}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <div className="flex-1" />
          </>
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
          onRowClick={handleUserClick}
          noBorder
          renderMobileRow={(user) => (
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={bustAvatarCache(user.avatarUrl, user.updatedAt)} alt={user.name} className="object-cover" />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-foreground text-sm">{user.name}</p>
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

