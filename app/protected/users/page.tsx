"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Search, 
  UserPlus, 
  MoreVertical, 
  Mail, 
  Shield, 
  GraduationCap, 
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


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

export default function UsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeView, setActiveView] = useState<"directory" | "permissions">("directory");
  const [isMatrixDirty, setIsMatrixDirty] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

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

  useEffect(() => {
    if (selectedUser) {
      setEditRole(selectedUser.role);
      setEditStatus(selectedUser.status);
    }
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "all" || user.role === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [searchQuery, activeTab, users]);

  const activeStats = useMemo(() => {
    const pool = activeTab === "all" ? users : users.filter(u => u.role === activeTab);
    return {
      total: pool.length,
      active: pool.filter(u => u.status === 'active').length,
      pending: pool.filter(u => u.status === 'pending').length,
      review: pool.filter(u => u.status === 'suspended').length,
    };
  }, [activeTab, users]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message || "Failed to load users");
        }

        const nextUsers = ((data ?? []) as ProfileRow[]).map(mapProfileToUser);

        setUsers(nextUsers);
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
  }, [supabase]);

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
      if (!profile) throw new Error("No existing account found for this email. Ask the user to sign up first.");

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

  return (
    <div className="relative min-h-[calc(100vh-120px)] flex flex-col gap-6">
      {/* Refined Header */}
      <div className="flex flex-col justify-between gap-6 border-b border-border pb-1 md:flex-row md:items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Users & Roles</h1>
          <p className="text-muted-foreground text-sm">
            Manage your organization&apos;s directory and access control.
          </p>
          
          {/* Navigation Tabs */}
          <div className="flex gap-8 pt-4">
            {[
              { id: "directory", label: "User Directory", icon: Users },
              { id: "permissions", label: "Role Policies", icon: Shield }
            ].map(tab => (
              <Button
                key={tab.id}
                    onClick={() => setActiveView(tab.id as "directory" | "permissions")}
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 pb-3 text-sm font-semibold transition-all relative",
                  activeView === tab.id 
                    ? "text-foreground" 
                    : "text-muted-foreground hover:text-muted-foreground"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
                {activeView === tab.id && (
                    <motion.div 
                     layoutId="activeTab"
                     className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                   />
                )}
              </Button>
            ))}
          </div>
        </div>

        <div className="pb-3 text-right">
          {activeView === "directory" ? (
             <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => setIsAddingUser(true)}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
              >
                <UserPlus size={18} />
                Invite User
              </Button>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-2">
                Manage Directory
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-xl border border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              <Shield size={14} />
              Global Access Rules
            </div>
          )}
        </div>
      </div>

      {activeView === "directory" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
           <StatCard label={`${activeTab === 'all' ? 'Total' : activeTab} Users`} value={hasMounted ? activeStats.total : 0} icon={Users} color="slate" />
          <StatCard label="Active" value={hasMounted ? activeStats.active : 0} icon={CheckCircle2} color="emerald" />
          <StatCard label="Pending" value={hasMounted ? activeStats.pending : 0} icon={Clock} color="amber" />
          <StatCard label="Review Required" value={hasMounted ? activeStats.review : 0} icon={AlertCircle} color="red" />
        </div>
      )}

      <div className="flex-1">
        {activeView === "directory" ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              {loadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {loadError}
                </div>
              )}

            {/* Filter & Search Bar - Cleaner Layout */}
            <div className="flex flex-col xl:flex-row items-center gap-4">
            <div className="group relative w-full flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-slate-700" />
                <Input
                  type="text" 
                  placeholder="Find a user by name or email..."
                  className="w-full rounded-xl border border-border bg-card py-3 pl-11 text-sm shadow-sm transition-all focus:border-slate-400 focus:ring-2 focus:ring-ring"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="scrollbar-hide flex w-full overflow-x-auto rounded-xl border border-border bg-muted p-1.5 xl:w-fit">
                {['all', 'admin', 'librarian', 'staff', 'student'].map((tab) => (
                  <Button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    variant="ghost"
                    className={cn(
                      "px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap",
                      activeTab === tab 
                        ? "bg-card text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-zinc-800"
                    )}
                  >
                    {tab}
                  </Button>
                ))}
              </div>
            </div>

            {/* Redesigned User Table - No Redundant Columns */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Identity</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Role & Context</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center">Active Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Join Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted">
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-sm text-muted-foreground">
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <tr 
                          key={user.id} 
                          className="group relative cursor-pointer transition-all hover:bg-slate-50"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditingUser(false);
                          }}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-10 w-10 rounded-xl border border-border">
                                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} className="object-cover" />
                                <AvatarFallback className="rounded-xl bg-muted font-bold text-slate-700 transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                                  {user.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-foreground leading-none">{user.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                              <RoleBadge role={user.role} />
                              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-1">{user.department}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex justify-center">
                              <StatusBadge status={user.status} />
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                              <Clock size={14} className="text-muted-foreground" />
                              {user.joined}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-32 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-3xl bg-muted flex items-center justify-center text-zinc-200">
                              <Search size={32} />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">No users found</p>
                              <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <PermissionsMatrix 
            onDirtyChange={setIsMatrixDirty} 
            users={users}
          />
        )}
      </div>

      {/* User Details Slide-over */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/10 backdrop-blur-sm" 
              onClick={() => setSelectedUser(null)} 
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-card h-full shadow-2xl flex flex-col"
            >
              <div className="p-8 pb-32 overflow-y-auto flex-1 h-full scrollbar-hide">
                <div className="flex items-center justify-between mb-8">
                <Button
                  onClick={() => setSelectedUser(null)}
                  variant="ghost"
                  className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsEditingUser(!isEditingUser)}
                    variant="ghost"
                    className={cn(
                      "rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all",
                      isEditingUser ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-slate-700"
                    )}
                  >
                    {isEditingUser ? "Finish Editing" : "Edit Profile"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                 <div className="group relative mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted text-3xl font-bold text-slate-700 shadow-sm">
                  <Avatar className={cn("h-full w-full rounded-3xl", isEditingUser && "blur-sm opacity-50")}>
                    <AvatarImage src={selectedUser.avatarUrl ?? undefined} alt={selectedUser.name} className="object-cover" />
                    <AvatarFallback className="rounded-3xl bg-muted text-3xl font-bold text-slate-700">
                      {selectedUser.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {isEditingUser && (
                     <div className="absolute inset-0 flex cursor-pointer items-center justify-center bg-slate-900/10">
                       <MoreVertical size={20} className="text-slate-700" />
                     </div>
                  )}
                </div>
                
                {isEditingUser ? (
                  <form className="w-full space-y-4" onSubmit={(e) => {
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
                  }}>
                    <div className="space-y-4 text-center">
                      <Input
                        name="name"
                        type="text" 
                        defaultValue={selectedUser.name} 
                         className="w-full border-b-2 border-slate-500 bg-transparent text-center text-2xl font-bold text-foreground outline-none"
                        required
                      />
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
                        <Mail size={14} />
                        <Input
                          name="email"
                          type="email" 
                          defaultValue={selectedUser.email} 
                          className="border-b border-border outline-none text-muted-foreground px-1 text-center"
                          required
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 w-full max-w-[240px] mx-auto text-left">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block px-1">System Role</Label>
                        <input type="hidden" name="role" value={editRole} />
                        <Select value={editRole} onValueChange={(value) => setEditRole(value as User["role"])}>
                           <SelectTrigger className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-semibold text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="librarian">Librarian</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block px-1">Account Status</Label>
                        <Select value={editStatus} onValueChange={setEditStatus}>
                           <SelectTrigger className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-semibold text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block px-1">Department</Label>
                         <Input name="department" defaultValue={selectedUser.department} className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-semibold text-foreground outline-none" />
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={isSaving} className="hidden" id="submit-profile-edit" />
                  </form>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <h2 className="text-2xl font-bold text-foreground">{selectedUser.name}</h2>
                    <div className="flex items-center gap-1.5 mt-2 text-muted-foreground text-sm">
                      <Mail size={14} />
                      {selectedUser.email}
                    </div>
                    <div className="mt-6 flex justify-center gap-2">
                      <RoleBadge role={selectedUser.role} />
                      <StatusBadge status={selectedUser.status} />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-12 space-y-8">
                <div>
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Account Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                           <div className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-slate-700">
                          <GraduationCap size={16} />
                        </div>
                        <span className="text-sm text-muted-foreground">Department</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{selectedUser.department}</span>
                    </div>
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                           <div className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-slate-700">
                          <Clock size={16} />
                        </div>
                        <span className="text-sm text-muted-foreground">Member Since</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{selectedUser.joined}</span>
                    </div>
                  </div>
                </div>

                <div>
                   <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex justify-between items-center">
                    <span>Effective Permissions</span>
                     <Shield size={12} className="text-muted-foreground" />
                  </h3>
                  <div className="p-4 rounded-2xl bg-muted border border-border space-y-3">
                    <PermissionItem label="Administrative Dashboard" allowed={selectedUser.role === 'admin'} />
                    <PermissionItem label="Issue Library Cards" allowed={['admin', 'librarian'].includes(selectedUser.role)} />
                    <PermissionItem label="Manage Digital Archive" allowed={['admin', 'librarian'].includes(selectedUser.role)} />
                    <PermissionItem label="Library Statistics & Reports" allowed={['admin', 'librarian'].includes(selectedUser.role)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-8 pt-0 bg-gradient-to-t from-white via-white to-transparent">
              {isEditingUser ? (
                 <Button
                   onClick={() => document.getElementById('submit-profile-edit')?.click()}
                   disabled={isSaving}
                   className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                 >
                  {isSaving ? (
                    <>
                      <RotateCcw size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : "Save Changes"}
                </Button>
              ) : (
                 <Button
                  onClick={() => {
                    setSelectedUser(null);
                    setActiveView("directory");
                  }}
                  variant="outline"
                  className="w-full border border-border text-muted-foreground font-bold py-4 rounded-2xl hover:bg-muted transition-all active:scale-[0.98]"
                >
                  Close Window
                </Button>
              )}
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistent Save Bar for Permissions Matrix */}
      <AnimatePresence>
        {isMatrixDirty && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
               className="fixed bottom-8 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-6 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-3 text-white shadow-2xl shadow-black/20 backdrop-blur-md"
          >
            <div className="flex items-center gap-3 border-r border-white/10 pr-6 mr-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-bold tracking-tight whitespace-nowrap">Unsaved permission changes</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsMatrixDirty(false)}
                variant="ghost"
                 className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary-foreground transition-colors"
                >
                Discard
              </Button>
              <Button
                onClick={() => {
                  setIsMatrixDirty(false);
                  alert("Permissions synchronized across system.");
                }}
                 className="rounded-xl bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
              >
                Save Changes
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite User Drawer */}
      <AnimatePresence>
        {isAddingUser && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" 
              onClick={() => setIsAddingUser(false)} 
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-md bg-card h-full shadow-2xl flex flex-col"
            >
              <div className="p-8 pb-32 overflow-y-auto flex-1 h-full scrollbar-hide">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted text-slate-700">
                     <UserPlus size={24} />
                   </div>
                  <Button onClick={() => setIsAddingUser(false)} variant="ghost" size="icon" className="p-2 text-muted-foreground hover:text-foreground">
                    <X size={20} />
                  </Button>
                </div>

                <h2 className="text-2xl font-bold text-foreground">Invite New User</h2>
                <p className="text-muted-foreground text-sm mt-1">Send a registration link to a new member.</p>

                <div className="mt-10 space-y-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Email Address</Label>
                    <Input
                      type="email" 
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="name@organization.com"
                      className="w-full bg-muted border-2 border-transparent focus:bg-card focus:border-slate-400/30 rounded-2xl py-3 px-4 outline-none transition-all font-medium text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Assign Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                       <SelectTrigger className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm font-semibold text-foreground transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="librarian">Librarian</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="admin">System Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Department / Faculty</Label>
                    <Input
                      type="text" 
                      value={inviteDept}
                      onChange={(e) => setInviteDept(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="w-full bg-muted border-2 border-transparent focus:bg-card focus:border-slate-400/30 rounded-2xl py-3 px-4 outline-none transition-all font-medium text-sm"
                    />
                  </div>

                  <div className="flex gap-3 rounded-xl border border-border bg-muted p-4">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                      <Shield size={10} className="text-primary-foreground" />
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-700">
                      Lumina will send an automated invitation email to <span className="font-bold">{inviteEmail || 'the recipient'}</span>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 pt-4 bg-gradient-to-t from-white via-white to-transparent">
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail || isSaving}
                   className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RotateCcw size={18} className="animate-spin" />
                      Sending Invitation...
                    </>
                  ) : "Send Invitation"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PermissionsMatrix({ onDirtyChange, users }: { onDirtyChange: (dirty: boolean) => void; users: User[] }) {
  const [editingRole, setEditingRole] = useState<string>("librarian");

  const MODULES = [
    { id: "circulation", label: "Circulation Control", desc: "Borrowing and renewals." },
    { id: "catalog", label: "Catalog Management", desc: "Book inventory access." },
    { id: "users", label: "User Management", desc: "Profile & role control." },
    { id: "reports", label: "Analytics & Reports", desc: "Stats and data exports." },
    { id: "digital", label: "Digital Resources", desc: "PDF & E-book access." },
  ];

  const ROLES = [
    { id: "admin", label: "System Admin", members: 2, level: "CRITICAL", desc: "Highest level access. Can manage organization settings and core system parameters." },
    { id: "librarian", label: "Librarian", members: 8, level: "HIGH", desc: "Full access to circulation, cataloging, and reporting. Cannot edit other admins." },
    { id: "staff", label: "Support Staff", members: 12, level: "MEDIUM", desc: "Operational access for daily library tasks like check-ins and student assistance." },
    { id: "student", label: "Student", members: 680, level: "LOW", desc: "Limited access to personal borrowing history and digital resource viewing." },
  ];

  // Helper to get members of a role for the inspector
  const roleMembers = useMemo(() => {
    return users.filter(u => u.role === editingRole).slice(0, 5);
  }, [editingRole, users]);

  // Mock permission state
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({
    admin: { circulation: true, catalog: true, users: true, reports: true, digital: true, audit: true },
    librarian: { circulation: true, catalog: true, users: false, reports: true, digital: true, audit: false },
    staff: { circulation: true, catalog: false, users: false, reports: false, digital: true, audit: false },
    student: { circulation: false, catalog: false, users: false, reports: false, digital: true, audit: false },
  });

  const togglePerm = (roleId: string, modId: string) => {
    if (roleId === 'admin') return; // Admin always has full perms
    onDirtyChange(true);
    setPerms(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [modId]: !prev[roleId][modId]
      }
    }));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Role Definitions */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Role Profiles</h3>
          <div className="space-y-3">
            {ROLES.map((role) => (
              <div 
                key={role.id}
                className={cn(
                  "p-5 rounded-3xl border transition-all cursor-pointer group relative overflow-hidden",
                  editingRole === role.id 
                    ? "bg-card border-border shadow-xl shadow-slate-500/5 ring-2 ring-slate-200" 
                    : "bg-card border-border hover:border-slate-300 shadow-sm opacity-60 hover:opacity-100"
                )}
                onClick={() => setEditingRole(role.id)}
              >
                 <div className="flex items-center justify-between mb-3">
                  <div className={cn(
                    "px-2 py-1 rounded-lg border font-bold text-[9px] uppercase tracking-widest",
                    role.level === 'CRITICAL' ? "bg-red-50 border-red-100 text-red-600" :
                    role.level === 'HIGH' ? "bg-amber-50 border-amber-100 text-amber-600" :
                    "bg-zinc-50 border-zinc-100 text-zinc-400"
                  )}>
                    {role.level}
                  </div>
                </div>

                <h4 className="font-bold text-lg text-foreground leading-tight">{role.label}</h4>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed italic">
                  &quot;{ROLES.find((r) => r.id === role.id)?.desc}&quot;
                </p>

                {editingRole === role.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-700" />
                )}
              </div>
            ))}
          </div>

          <div className="bg-slate-900 rounded-[32px] p-6 shadow-xl shadow-slate-300 text-white animate-in zoom-in-95 duration-300">
            <h5 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-4">Member Inspector</h5>
            <div className="flex -space-x-3 mb-4">
              {roleMembers.map((m) => (
                <Avatar key={m.id} className="h-9 w-9 rounded-full border-2 border-slate-900 bg-white/20 backdrop-blur-sm">
                  <AvatarImage src={m.avatarUrl ?? undefined} alt={m.name} className="object-cover" />
                  <AvatarFallback className="text-[10px] font-bold bg-transparent text-white">
                    {m.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {ROLES.find(r => r.id === editingRole)!.members > 5 && (
                <div className="h-9 w-9 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold">
                  +{ROLES.find(r => r.id === editingRole)!.members - 5}
                </div>
              )}
            </div>
            <p className="text-xs font-medium leading-relaxed">
              Updates to this policy will immediately affect <span className="font-bold underline">{users.filter(u => u.role === editingRole).length} active members</span>.
            </p>
          </div>
        </div>

        {/* Right: Permission Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Access Matrix</h3>
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
              Editing: {editingRole}
            </span>
          </div>
          <div className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-8 py-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest bg-card">Capabilities</th>
                    {ROLES.map(role => (
                      <th 
                        key={role.id} 
                        className={cn(
                          "px-4 py-6 text-[11px] font-bold uppercase tracking-widest text-center transition-all",
                          editingRole === role.id ? "text-slate-700 bg-muted/80" : "text-muted-foreground"
                        )}
                      >
                        {role.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {MODULES.map((mod) => (
                    <tr key={mod.id} className="group hover:bg-zinc-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground leading-none">{mod.label}</span>
                          <span className="text-[11px] text-muted-foreground mt-1.5">{mod.desc}</span>
                        </div>
                      </td>
                      {ROLES.map(role => {
                        const isAllowed = perms[role.id][mod.id];
                        const isDisabled = role.id === 'admin';
                        const isFocused = editingRole === role.id;
                        return (
                          <td 
                            key={role.id} 
                            className={cn(
                              "px-4 py-5 text-center transition-all",
                              isFocused && "bg-slate-100/50"
                            )}
                          >
                            <Button
                              onClick={() => togglePerm(role.id, mod.id)}
                              disabled={isDisabled}
                              variant="ghost"
                              className={cn(
                                "h-10 w-10 mx-auto rounded-2xl flex items-center justify-center transition-all",
                                isAllowed 
                                  ? "bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-500/5 group-hover:scale-110" 
                                  : "bg-muted text-zinc-300",
                                isAllowed && isFocused && "bg-emerald-500 text-primary-foreground shadow-emerald-200",
                                !isAllowed && isFocused && "bg-muted text-muted-foreground",
                                isDisabled && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              {isAllowed ? <CheckCircle2 size={18} /> : <X size={16} />}
                            </Button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-8 bg-muted/50 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <AlertCircle size={14} />
                <span>Admin permissions are locked for system safety.</span>
              </div>
              <Button variant="outline" className="bg-card hover:bg-zinc-900 hover:text-white text-foreground border border-border px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm">
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "slate" | "emerald" | "amber" | "red";
}) {
  const colors: Record<"slate" | "emerald" | "amber" | "red", string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-300",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };
  
  return (
    <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
      <div className={cn("p-2.5 w-fit rounded-xl border mb-4", colors[color])}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-slate-900 text-white",
    librarian: "bg-blue-100 text-blue-700",
    staff: "bg-purple-100 text-purple-700",
    student: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span className={cn("w-fit px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest", styles[role])}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "text-emerald-600",
    pending: "text-amber-600",
    suspended: "text-red-500",
  };
  const label: Record<string, string> = {
    active: "Active Account",
    pending: "Verification Required",
    suspended: "Access Revoked",
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("h-1.5 w-1.5 rounded-full", status === 'active' ? "bg-emerald-500 animate-pulse" : status === 'pending' ? "bg-amber-500" : "bg-red-500")} />
      <span className={cn("text-[11px] font-semibold", styles[status])}>
        {label[status]}
      </span>
    </div>
  );
}

function PermissionItem({ label, allowed }: { label: string, allowed: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-xs", allowed ? "text-zinc-700" : "text-zinc-400 line-through decoration-zinc-300")}>{label}</span>
      {allowed ? (
        <CheckCircle2 size={14} className="text-emerald-500" />
      ) : (
        <X size={14} className="text-zinc-300" />
      )}
    </div>
  );
}
