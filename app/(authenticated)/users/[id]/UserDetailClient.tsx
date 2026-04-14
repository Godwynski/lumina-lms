"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "../UsersContent";

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "text-foreground",
    librarian: "text-blue-700",
    staff: "text-indigo-700",
    student: "text-muted-foreground",
  };
  return (
    <span className={cn("text-sm font-medium capitalize", styles[role])}>
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
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", styles[normalizedStatus] ?? "status-neutral")}>
      {label[normalizedStatus] ?? status}
    </span>
  );
}

export function UserDetailClient({ initialUser }: { initialUser: User }) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User>(initialUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editRole, setEditRole] = useState<User["role"]>(user.role);
  const [editStatus, setEditStatus] = useState(user.status);

  const handleUpdateProfile = async (updatedData: Partial<User>) => {
    setIsSaving(true);
    setError(null);

    try {
      const patch = {
        full_name: updatedData.name,
        email: updatedData.email?.trim().toLowerCase(),
        role: updatedData.role,
        status: updatedData.status?.trim().toUpperCase(),
        department: updatedData.department?.trim() || "General",
      };

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      // Sync library card status if status was updated
      if (updatedData.status) {
        await supabase
          .from("library_cards")
          .update({ status: updatedData.status.toUpperCase() })
          .eq("user_id", user.id);
      }

      const nextUser = updated ? {
        ...user,
        name: updated.full_name || updated.email,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        department: updated.department
      } : { ...user, ...updatedData };
      
      setUser(nextUser);
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminAction = (newStatus: string) => {
    handleUpdateProfile({ status: newStatus });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/users')} className="-ml-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0 hidden md:block">
          <h1 className="text-2xl font-bold text-foreground truncate">{user.name}</h1>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        </div>
        {!isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const roleValue = formData.get("role") as User["role"];
              
              handleUpdateProfile({
                name: String(formData.get("name") ?? user.name),
                email: String(formData.get("email") ?? user.email),
                role: roleValue || user.role,
                status: editStatus,
                department: String(formData.get("department") ?? user.department),
              });
            }}
          >
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={user.email} required disabled className="bg-muted" />
              <p className="text-[10px] text-muted-foreground">Email changes requires auth flow, modifying from admin is not supported.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
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
              <input type="hidden" name="role" value={editRole} />
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
              <Input name="department" defaultValue={user.department} />
            </div>
            <div className="pt-4 mt-6 flex justify-end gap-3 border-t">
               <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setError(null); }} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
             <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} className="object-cover" />
                <AvatarFallback className="text-2xl">{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left space-y-1">
                <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
                <p className="text-muted-foreground">{user.email}</p>
                <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                   <RoleBadge role={user.role} />
                   <span className="text-muted-foreground">•</span>
                   <StatusBadge status={user.status} />
                </div>
              </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <h3 className="text-sm font-semibold text-muted-foreground">Department</h3>
                 <p className="mt-1 text-foreground font-medium">{user.department}</p>
              </div>
               <div>
                 <h3 className="text-sm font-semibold text-muted-foreground">Joined Date</h3>
                 <p className="mt-1 text-foreground font-medium">{user.joined}</p>
              </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Admin Actions</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                {user.status.toLowerCase() !== "active" && (
                  <Button 
                    className="flex-1" 
                    variant="default"
                    onClick={() => handleAdminAction("ACTIVE")}
                    disabled={isSaving}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Approve & Activate
                  </Button>
                )}
                {(user.status.toLowerCase() === "active" || user.status.toLowerCase() === "pending") && (
                  <Button 
                    className="flex-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200" 
                    variant="outline"
                    onClick={() => handleAdminAction("SUSPENDED")}
                    disabled={isSaving}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Suspend Account
                  </Button>
                )}
                {user.status.toLowerCase() === "suspended" && (
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => handleAdminAction("ACTIVE")}
                    disabled={isSaving}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Re-activate Account
                  </Button>
                )}
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
