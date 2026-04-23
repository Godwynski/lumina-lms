"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useCallback, use } from "react";
import { Search, UserPlus } from "lucide-react";
import { sanitizeFilterInput } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { AdminTableShell } from "@/components/admin/AdminTableShell";
import { LuminaTable, type LuminaColumn } from "@/components/common/LuminaTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RoleBadge } from "@/components/common/RoleBadge";
import { mapProfileToUser } from "@/lib/utils/mappers";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "admin" | "librarian" | "staff" | "student";
  status: string;
  department: string;
  joined: string;
  student_id: string | null;
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
}

export function UsersContent({ usersPromise }: UsersContentProps) {
  const router = useRouter();
  const initialData = use(usersPromise);
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<User[]>(initialData.users);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalUsers, setTotalUsers] = useState(initialData.count);
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "librarian" | "staff" | "student">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;


  const roleFilterLabels: Record<string, string> = {
    all: "All",
    admin: "Admin",
    librarian: "Librarian",
    staff: "Staff",
    student: "Student",
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeTab]);

  const isInitialMount = React.useRef(true);

  useEffect(() => {
    const loadUsers = async () => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      setIsLoadingUsers(true);
      setLoadError(null);
      try {
        let queryBuilder = supabase
          .from("profiles")
          .select("*", { count: "exact" });

        if (activeTab !== "all") {
          queryBuilder = queryBuilder.eq("role", activeTab);
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
    };

    void loadUsers();
  }, [supabase, currentPage, debouncedSearch, activeTab, pageSize]);

  const handleUserClick = useCallback((u: User) => {
    router.push(`/users/${u.id}`);
  }, [router]);

  const columns = useMemo<LuminaColumn<User>[]>(() => [
    {
      header: "User",
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} className="object-cover" />
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
      cell: (user) => <span className="font-mono text-xs font-medium">{user.student_id || "N/A"}</span>
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
      header: "Meta",
      className: "text-xs text-muted-foreground",
      cell: (user) => (
        <div className="flex items-center gap-2">
          <span>{user.department}</span>
          <span className="opacity-40">•</span>
          <span>{user.joined}</span>
        </div>
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
            <div className="flex w-full sm:w-auto overflow-x-auto whitespace-nowrap scrollbar-hide gap-1 pb-1">
              {(["all", "admin", "librarian", "staff", "student"] as const).map((tab) => (
                <Button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  variant={activeTab === tab ? "default" : "outline"}
                  className="h-8 px-3 text-xs"
                >
                  {roleFilterLabels[tab]}
                </Button>
              ))}
            </div>
            <div className="flex-1" />
            <Button 
              onClick={() => router.push('/users/new')} 
              size="sm" 
              className="h-8 w-full sm:w-auto px-4 font-bold uppercase tracking-tight"
            >
              <UserPlus size={14} className="mr-2" />
              Invite user
            </Button>
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
          renderMobileRow={(user) => (
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} className="object-cover" />
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

