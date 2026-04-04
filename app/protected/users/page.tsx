"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  UserPlus, 
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminTableShell } from "@/components/admin/AdminTableShell";


type User = {
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
    className="cursor-pointer hover:bg-muted/40"
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

export default function UsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "librarian" | "staff" | "student">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Invitation Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("student");
  const [inviteDept, setInviteDept] = useState("");
  const [editRole, setEditRole] = useState<User["role"]>("student");
  const [editStatus, setEditStatus] = useState("active");
  const roleFilterLabels: Record<typeof activeTab, string> = {
    all: "All",
    admin: "Admin",
    librarian: "Librarian",
    staff: "Staff",
    student: "Student",
  };

  useEffect(() => {
    if (selectedUser) {
      setEditRole(selectedUser.role);
      setEditStatus(selectedUser.status);
    }
  }, [selectedUser]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));

  const paginatedUsers = users;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeTab]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setLoadError(null);
      try {
        let query = supabase
          .from("profiles")
          .select("*", { count: "exact" });

        if (activeTab !== "all") {
          query = query.eq("role", activeTab);
        }

        if (debouncedSearch) {
          query = query.or(`full_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
        }

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await query
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) {
          throw new Error(error.message || "Failed to load users");
        }

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

    const handleProfilePhotoUpdated = () => {
      void loadUsers();
    };

    window.addEventListener("lumina:profile-photo-updated", handleProfilePhotoUpdated);
    return () => {
      window.removeEventListener("lumina:profile-photo-updated", handleProfilePhotoUpdated);
    };
  }, [supabase, currentPage, debouncedSearch, activeTab]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setIsSaving(true);
    try {
      const email = inviteEmail.trim().toLowerCase();
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (profileError) throw new Error(profileError.message);
      if (!profile) throw new Error("No account found for that email.");

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({
          role: inviteRole,
          status: "pending",
          department: inviteDept.trim() || "General",
        })
        .eq("id", profile.id)
        .select("*")
        .single();

      if (updateError) throw new Error(updateError.message);

      if (updated) {
        const nextUser: User = {
          id: String(updated.id),
          name:
            (typeof updated.full_name === "string" && updated.full_name.trim()) ||
            (typeof updated.email === "string"
              ? updated.email
                  .split("@")[0]
                  .split(".")
                  .map((part: string) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
                  .join(" ")
              : "Unnamed User"),
          email: typeof updated.email === "string" ? updated.email : "",
          avatarUrl: typeof updated.avatar_url === "string" && updated.avatar_url.trim() ? updated.avatar_url : null,
          role: ["admin", "librarian", "staff", "student"].includes(String(updated.role))
            ? (String(updated.role) as User["role"])
            : "student",
          status: typeof updated.status === "string" ? updated.status : "active",
          department: typeof updated.department === "string" && updated.department.trim() ? updated.department : "General",
          joined:
            typeof updated.created_at === "string"
              ? new Date(updated.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : "Unknown",
        };
        setUsers((prev) => [nextUser, ...prev.filter((u) => u.id !== nextUser.id)]);
      }

      setIsSaving(false);
      setIsAddingUser(false);
      setInviteEmail("");
      setInviteDept("");
      setLoadError(null);
    } catch (error) {
      setIsSaving(false);
      setLoadError(error instanceof Error ? error.message : "Failed to invite user");
    }
  };

  const handleUpdateProfile = async (updatedData: Partial<User>) => {
    setIsSaving(true);
    if (!selectedUser) {
      setIsSaving(false);
      return;
    }

    try {
      const patch: Record<string, unknown> = {
        full_name: updatedData.name,
        email: updatedData.email?.trim().toLowerCase(),
        role: updatedData.role,
        status: updatedData.status?.trim().toLowerCase(),
        department: updatedData.department?.trim() || "General",
      };

      const { data: updated, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", selectedUser.id)
        .select("*")
        .single();

      if (error) throw new Error(error.message || "Failed to update profile");

      const nextUser: User = updated
        ? {
            id: String(updated.id),
            name:
              (typeof updated.full_name === "string" && updated.full_name.trim()) ||
              (typeof updated.email === "string"
                ? updated.email
                    .split("@")[0]
                    .split(".")
                    .map((part: string) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
                    .join(" ")
                : "Unnamed User"),
            email: typeof updated.email === "string" ? updated.email : "",
            avatarUrl: typeof updated.avatar_url === "string" && updated.avatar_url.trim() ? updated.avatar_url : null,
            role: ["admin", "librarian", "staff", "student"].includes(String(updated.role))
              ? (String(updated.role) as User["role"])
              : "student",
            status: typeof updated.status === "string" ? updated.status : "active",
            department: typeof updated.department === "string" && updated.department.trim() ? updated.department : "General",
            joined:
              typeof updated.created_at === "string"
                ? new Date(updated.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "Unknown",
          }
        : { ...selectedUser, ...updatedData };

      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? nextUser : u)));
      setSelectedUser(nextUser);
      setIsEditingUser(false);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserClick = useCallback((u: User) => {
    setSelectedUser(u);
    setIsEditingUser(false);
  }, []);

  return (
    <>
      <AdminTableShell
        title="Users & Roles"
        description="Manage users, role assignment, and account status."
        className="min-h-[calc(100vh-120px)]"
        headerActions={(
          <Button onClick={() => setIsAddingUser(true)} className="w-full sm:w-auto">
            <UserPlus size={16} className="mr-2" />
            Invite user
          </Button>
        )}
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
            <div className="flex w-full flex-wrap gap-1 sm:w-auto">
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
                    Loading...
                  </td>
                </tr>
              ) : paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <UserTableRow
                    key={user.id}
                    user={user}
                    onClick={handleUserClick}
                  />
                ))
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

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30"
              onClick={() => setSelectedUser(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 230 }}
              className="relative flex h-full w-full max-w-md flex-col bg-card"
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-base font-semibold text-foreground">User details</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditingUser((prev) => !prev)}>
                    {isEditingUser ? "Cancel" : "Edit"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
                    <X size={18} />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {isEditingUser ? (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const roleValue = formData.get("role");
                      const safeRole =
                        roleValue === "admin" || roleValue === "librarian" || roleValue === "staff" || roleValue === "student"
                          ? roleValue
                          : selectedUser.role;

                      handleUpdateProfile({
                        name: String(formData.get("name") ?? selectedUser.name),
                        email: String(formData.get("email") ?? selectedUser.email),
                        role: safeRole,
                        status: editStatus,
                        department: String(formData.get("department") ?? selectedUser.department),
                      });
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input name="name" defaultValue={selectedUser.name} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input name="email" type="email" defaultValue={selectedUser.email} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <input type="hidden" name="role" value={editRole} />
                      <Select value={editRole} onValueChange={(value) => setEditRole(value as User["role"])}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[130]">
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="librarian">Librarian</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[130]">
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Department</Label>
                      <Input name="department" defaultValue={selectedUser.department} />
                    </div>
                    <Button type="submit" disabled={isSaving} className="w-full">
                      {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedUser.avatarUrl ?? undefined} alt={selectedUser.name} className="object-cover" />
                        <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">{selectedUser.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Role</p>
                        <div className="mt-1">
                          <RoleBadge role={selectedUser.role} />
                        </div>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="mt-1">
                          <StatusBadge status={selectedUser.status} />
                        </div>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Department</p>
                        <p className="mt-1 text-foreground">{selectedUser.department}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Joined</p>
                        <p className="mt-1 text-foreground">{selectedUser.joined}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsAddingUser(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="relative w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Invite user</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsAddingUser(false)}>
                  <X size={18} />
                </Button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@organization.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[130]">
                      <SelectItem value="librarian">Librarian</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input
                    type="text"
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                    placeholder="Computer Science"
                  />
                </div>
              </div>
              <Button onClick={handleInvite} disabled={!inviteEmail || isSaving} className="mt-4 w-full">
                {isSaving ? "Sending..." : "Send invitation"}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

