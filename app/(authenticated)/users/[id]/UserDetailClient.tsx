"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Phone, MapPin, User as UserIcon, Building, Trash2,
  CheckCircle2, AlertCircle, UserCheck, Archive, Calendar, Key, Hash
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Section, FieldGroup } from "@/components/settings/SettingsShared";
import type { User } from "../UsersContent";

export function UserDetailClient({
  initialUser,
  currentRole
}: {
  initialUser: User;
  currentRole: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User>(initialUser);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const isAdmin = currentRole === "admin";
  const isLibrarian = currentRole === "librarian";
  const isTargetAdmin = initialUser.role === "admin";
  const isReadOnly = isLibrarian && isTargetAdmin;

  const [form, setForm] = useState({
    name: initialUser.name,
    email: initialUser.email,
    role: initialUser.role,
    status: initialUser.status,
    department: initialUser.department,
    student_id: initialUser.student_id || "",
    address: initialUser.address || "",
    phone: initialUser.phone || "",
    permissions: initialUser.permissions || {},
  });

  const [checklist, setChecklist] = useState({
    nameMatches: false,
    programMatches: false,
    photoMatches: false,
  });

  const isDirty =
    form.name.trim() !== (initialUser.name || "").trim() ||
    form.role !== initialUser.role ||
    form.status.toUpperCase() !== (initialUser.status || "").toUpperCase() ||
    form.department.trim() !== (initialUser.department || "").trim() ||
    form.address.trim() !== (initialUser.address || "").trim() ||
    form.phone.trim() !== (initialUser.phone || "").trim() ||
    JSON.stringify(form.permissions) !== JSON.stringify(initialUser.permissions || {});

  const needsVerification = form.role === "student" && form.status === "ACTIVE" && initialUser.status === "PENDING";
  const isVerified = checklist.nameMatches && checklist.programMatches && checklist.photoMatches;

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (needsVerification && !isVerified) {
        toast.error("Please complete the physical ID verification checklist before approving.");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name: form.name.trim(),
          role: form.role,
          status: form.status.trim().toUpperCase(),
          department: form.department.trim() || "General",
          student_id: form.student_id.trim() || null,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          permissions: form.permissions,
        }),
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.message || "Failed to update profile");

      const updated = result.user;
      const nextUser = {
        ...user,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        department: updated.department,
        student_id: updated.student_id,
        address: form.address,
        phone: form.phone,
        permissions: form.permissions,
      };

      setUser(nextUser);
      setForm({
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        department: updated.department,
        student_id: updated.student_id || "",
        address: form.address,
        phone: form.phone,
        permissions: form.permissions,
      });
      toast.success("Account updated successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = (value: string) => {
    if (isLibrarian && (value === "ARCHIVED" || value === "SUSPENDED")) {
      toast.error("Librarians cannot suspend or archive users.");
      return;
    }
    setForm(prev => ({ ...prev, status: value }));
  };

  const statusOptions = [
    { id: "ACTIVE", label: "Active", icon: CheckCircle2 },
    { id: "PENDING", label: "Pending", icon: Calendar },
    { id: "SUSPENDED", label: "Suspended", icon: AlertCircle, restricted: isLibrarian },
    { id: "ARCHIVED", label: "Archived", icon: Archive, restricted: isLibrarian },
  ];

  const roleOptions = [
    { id: "admin", label: "Administrator", icon: Shield, hidden: !isAdmin },
    { id: "librarian", label: "Librarian", icon: Building },
    { id: "student_assistant", label: "Staff / SA", icon: UserCheck },
    { id: "student", label: "Student", icon: UserIcon },
  ];

  return (
    <SettingsShell isDirty={isDirty}>
      <div className="flex flex-col gap-6 pt-2">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}

        <div className="grid gap-6">

          {/* ───── Section 1: User Identity & Core Access ───── */}
          <Section title="User Profile" icon={UserIcon} hideHeaderOnMobile>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* Left Column: Avatar & ID */}
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border/40 bg-muted/20 p-5 lg:w-56 shrink-0">
                <Avatar className="h-24 w-24 rounded-2xl border-2 border-background shadow-lg">
                  <AvatarImage src={user.avatarUrl || undefined} alt={form.name} className="object-cover" />
                  <AvatarFallback className="rounded-2xl bg-muted text-xl font-bold">
                    {form.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="w-full space-y-3">
                  <div className="text-center px-1">
                    <p className="text-sm font-bold text-foreground leading-tight">{form.name}</p>
                    <p className="text-[10px] text-muted-foreground break-all mt-1">
                      {form.email}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold text-center">Institutional ID</p>
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-background border border-border px-3 py-2 shadow-sm">
                      <Hash className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                      <span className="font-mono text-xs font-bold text-foreground">
                        {initialUser.student_id || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Since {user.joined || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Information & Controls */}
              <div className="flex-1 space-y-6">
                {/* Information Fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldGroup label="Display Name">
                    <Input
                      value={form.name}
                      onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Full name"
                      className="h-10 rounded-lg text-sm"
                      disabled={isReadOnly}
                    />
                  </FieldGroup>
                  <FieldGroup label="Department / Program">
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={form.department || ""}
                        onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="e.g. IT, Admin"
                        className="h-10 rounded-lg pl-9 text-sm"
                        disabled={isReadOnly}
                      />
                    </div>
                  </FieldGroup>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldGroup label="Phone Number">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={form.phone}
                        onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Contact number"
                        className="h-10 rounded-lg pl-9 text-sm"
                        disabled={isReadOnly}
                      />
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Home Address">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={form.address}
                        onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Street, City"
                        className="h-10 rounded-lg pl-9 text-sm"
                        disabled={isReadOnly}
                      />
                    </div>
                  </FieldGroup>
                </div>

                {/* System Controls - Compact Selects */}
                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/40">
                  <FieldGroup label="System Role">
                    <Select 
                      value={form.role} 
                      onValueChange={(val) => setForm(prev => ({ ...prev, role: val as User["role"] }))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="w-full h-10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.filter(r => !r.hidden).map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            <div className="flex items-center gap-2">
                              <r.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{r.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  <FieldGroup label="Account Status">
                    <Select 
                      value={form.status} 
                      onValueChange={handleStatusChange}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="w-full h-10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s.id} value={s.id} disabled={s.restricted}>
                            <div className="flex items-center gap-2">
                              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{s.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                </div>

                {/* Inline Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {form.role === "student_assistant" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px] font-bold gap-1.5"
                      onClick={() => setPermissionsOpen(true)}
                    >
                      <Key className="h-3 w-3" />
                      Permissions
                    </Button>
                  )}

                  {needsVerification && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 text-[11px] font-bold gap-1.5",
                        isVerified
                          ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-50"
                          : "border-amber-500/40 text-amber-600 hover:bg-amber-50"
                      )}
                      onClick={() => setVerificationOpen(true)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {isVerified ? "Verified" : "Verify ID"}
                    </Button>
                  )}

                  {!isLibrarian && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[11px] font-bold gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      onClick={() => setArchiveOpen(true)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ───── Save Footer ───── */}
          <div className="flex items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-4 mt-2 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-background shadow-sm">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">Pending Changes</p>
                <p className="text-[10px] text-muted-foreground">
                  Update role to <span className="text-foreground font-medium">{form.role}</span> · Status <span className="text-foreground font-medium">{form.status}</span>
                </p>
              </div>
            </div>
            <Button
              onClick={handleUpdateProfile}
              disabled={isSaving || !isDirty}
              className="h-10 rounded-lg px-8 font-bold shadow-md transition-all active:scale-95"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

        </div>
      </div>

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* Permissions Modal */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4" />
              SA Permissions
            </DialogTitle>
            <DialogDescription>
              Grant specific module access to this Student Assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              { key: "manage_inventory", label: "Inventory", desc: "Catalog & Item management" },
              { key: "manage_circulation", label: "Circulation", desc: "Checkouts & Returns" },
              { key: "manage_attendance", label: "Attendance", desc: "Gate scans & records" },
              { key: "manage_users", label: "Users", desc: "Account management" },
              { key: "manage_policies", label: "Policies", desc: "Library settings" },
              { key: "manage_analytics", label: "Analytics", desc: "System reports" },
            ].map(p => (
              <div
                key={p.key}
                className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                </div>
                <Switch
                  checked={form.permissions?.[p.key] ?? false}
                  onCheckedChange={(checked) =>
                    setForm(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, [p.key]: checked },
                    }))
                  }
                  disabled={isReadOnly}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:w-auto h-9 font-bold">Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Physical Verification Modal */}
      <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              ID Verification
            </DialogTitle>
            <DialogDescription>
              Verify student identity via physical ID card presentation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {[
              { id: "nameMatches", label: "Full Name matches physical ID" },
              { id: "programMatches", label: "Academic Program matches ID" },
              { id: "photoMatches", label: "User identity matches ID Photo" },
            ].map(item => (
              <div
                key={item.id}
                className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-colors"
              >
                <Checkbox
                  id={item.id}
                  checked={checklist[item.id as keyof typeof checklist]}
                  onCheckedChange={(checked) =>
                    setChecklist(prev => ({ ...prev, [item.id]: !!checked }))
                  }
                />
                <Label htmlFor={item.id} className="text-sm font-medium cursor-pointer flex-1">
                  {item.label}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:w-auto h-9 font-bold">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Modal */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive font-bold">
              <Trash2 className="h-4 w-4" />
              Archive Identity
            </DialogTitle>
            <DialogDescription>
              Are you sure? This hides <span className="font-bold text-foreground">{user.name}</span> from directories.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="h-9 font-bold">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="h-9 font-bold"
              onClick={() => {
                handleStatusChange("ARCHIVED");
                setArchiveOpen(false);
              }}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsShell>
  );
}
