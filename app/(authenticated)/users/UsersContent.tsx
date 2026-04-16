"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useCallback, use } from "react";
import { Search, UserPlus } from "lucide-react";
import { cn, sanitizeFilterInput } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { AdminTableShell } from "@/components/admin/AdminTableShell";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "admin" | "librarian" | "staff" | "student";
  status: string;
  department: string;
  joined: string;
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

const UserTableRow = React.memo(({ user, onClick }: { user: User; onClick: (user: User) => void }) => (
  <tr
    className="cursor-pointer hover:bg-muted/40 hidden md:table-row"
    onClick={() => onClick(user)}
  >
    <td className="px-4 py-3">
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
    </td>
    <td className="px-4 py-3">
      <RoleBadge role={user.role} />
    </td>
    <td className="px-4 py-3">
      <StatusBadge status={user.status} />
    </td>
    <td className="px-4 py-3 text-xs text-muted-foreground">
      <span>{user.department}</span>
      <span className="mx-2">-</span>
      <span>{user.joined}</span>
    </td>
  </tr>
));
UserTableRow.displayName = "UserTableRow";

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

  const mapProfileToUser = (row: ProfileRow): User => ({
    id: String(row.id ?? ""),
    name:
      (typeof row.full_name === "string" && row.full_name.trim()) ||
      (typeof row.email === "string"
        ? row.email
            .split("@")[0]
            .split(".")
            .map((part: string) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
            .join(" ")
        : "Unnamed User"),
    email: typeof row.email === "string" ? row.email : "",
    avatarUrl: typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url : null,
    role: ["admin", "librarian", "staff", "student"].includes(String(row.role))
      ? (String(row.role) as User["role"])
      : "student",
    status: typeof row.status === "string" ? row.status : "active",
    department: typeof row.department === "string" && row.department.trim() ? row.department : "General",
    joined:
      typeof row.created_at === "string"
        ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "Unknown",
  });

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
        <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="px-4 py-2.5 font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                       <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                       <span>Refreshing users...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length > 0 ? (
                <>
                  {users.map((user) => (
                    <UserTableRow
                      key={user.id}
                      user={user}
                      onClick={handleUserClick}
                    />
                  ))}
                  {users.map((user) => (
                    <tr key={`mobile-${user.id}`} className="md:hidden border-b border-border hover:bg-muted/40 cursor-pointer" onClick={() => handleUserClick(user)}>
                      <td colSpan={4} className="p-4">
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
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <RoleBadge role={user.role} />
                              <span>•</span>
                              <span className="truncate">{user.department}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </AdminTableShell>
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "text-foreground",
    librarian: "text-blue-700",
    staff: "text-indigo-700",
    student: "text-muted-foreground",
  };
  return (
    <span className={cn("text-xs font-medium capitalize", styles[role])}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "status-success",
    pending: "status-warning",
    suspended: "status-danger",
  };
  const label: Record<string, string> = {
    active: "Active",
    pending: "Pending",
    suspended: "Suspended",
  };
  const normalizedStatus = status.toLowerCase();
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", styles[normalizedStatus] ?? "status-neutral")}>
      {label[normalizedStatus] ?? status}
    </span>
  );
}
