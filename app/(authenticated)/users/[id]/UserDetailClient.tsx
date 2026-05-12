"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Mail, Phone, MapPin, User as UserIcon, Building, Trash2, CheckCircle2, AlertCircle, UserCheck, Archive, Calendar, Key } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  const isAdmin = currentRole === "admin";
  const isLibrarian = currentRole === "librarian";
  const isTargetAdmin = initialUser.role === "admin";
  const isReadOnly = isLibrarian && isTargetAdmin;

  // Form State
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
    form.student_id.trim() !== (initialUser.student_id || "").trim() ||
    form.address.trim() !== (initialUser.address || "").trim() ||
    form.phone.trim() !== (initialUser.phone || "").trim() ||
    JSON.stringify(form.permissions) !== JSON.stringify(initialUser.permissions || {});

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Enforce checklist for student activation
      if (form.status === 'ACTIVE' && initialUser.status === 'PENDING' && form.role === 'student') {
        const isVerified = checklist.nameMatches && checklist.programMatches && checklist.photoMatches;
        if (!isVerified) {
          toast.error("Please complete the physical ID verification checklist before approving.");
          setIsSaving(false);
          return;
        }
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
        address: form.address, // API returns mapped user, might not have all raw fields
        phone: form.phone,
        permissions: form.permissions,
      };
      
      setUser(nextUser);
      // Sync form state to match the just-saved data to disable the save button
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
      // We don't reset isEditing because we are always in the "Detail" view now which is interactive
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminAction = async (action: string) => {
    if (isLibrarian && (action === "ARCHIVED" || action === "SUSPENDED")) {
      setError("Librarians cannot suspend or archive users.");
      return;
    }
    
    setForm(prev => ({ ...prev, status: action }));
  };

  return (
    <SettingsShell isDirty={isDirty}>
      <div className="flex flex-col gap-6 pt-2">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}

        <div className="grid gap-6">
          
          {/* Section 1: Identity */}
          <Section title="User Identity" icon={UserIcon} hideHeaderOnMobile>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* Avatar block */}
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-muted/20 p-4 sm:w-48">
                <Avatar className="h-24 w-24 rounded-xl border-2 border-background shadow-md">
                  <AvatarImage src={user.avatarUrl || undefined} alt={form.name} className="object-cover" />
                  <AvatarFallback className="rounded-xl bg-muted text-lg font-bold">
                    {form.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">{form.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{form.role === 'student_assistant' ? 'Staff / SA' : form.role.replace('_', ' ')}</p>
                </div>
              </div>

              {/* Basic Fields */}
              <div className="flex-1 space-y-4">
                <FieldGroup label="Full Name">
                  <Input 
                    value={form.name} 
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full identity name"
                    className="h-10 rounded-lg text-sm"
                    disabled={isReadOnly}
                  />
                </FieldGroup>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldGroup label="Official Email">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        value={form.email} 
                        disabled 
                        className="h-10 rounded-lg pl-9 text-sm bg-muted/50 text-muted-foreground opacity-80"
                      />
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Academic Program / Department">
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
                  <FieldGroup label="Contact Number">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        value={form.phone} 
                        onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+63 900 000 0000"
                        className="h-10 rounded-lg pl-9 text-sm"
                        disabled={isReadOnly}
                      />
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Residential Address">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        value={form.address} 
                        onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Street, City, Province"
                        className="h-10 rounded-lg pl-9 text-sm"
                        disabled={isReadOnly}
                      />
                    </div>
                  </FieldGroup>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 2: Access & Credentials */}
          <Section title="Account Access" icon={Shield}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup label="System Role" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'admin', label: 'Administrator', icon: Shield, hidden: !isAdmin },
                    { id: 'librarian', label: 'Librarian', icon: Building },
                    { id: 'student_assistant', label: 'Staff / Student Assistant (SA)', icon: UserCheck },
                    { id: 'student', label: 'Student', icon: UserIcon },
                  ].filter(r => !r.hidden).map((r) => (
                    <Button
                      key={r.id}
                      type="button"
                      variant={form.role === r.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForm(prev => ({ ...prev, role: r.id as User["role"] }))}
                      disabled={isReadOnly}
                      className={cn(
                        "h-9 px-4 text-xs font-bold transition-all gap-2",
                        form.role === r.id ? "shadow-md scale-105" : "hover:bg-muted"
                      )}
                    >
                      <r.icon className="h-3.5 w-3.5" />
                      {r.label}
                    </Button>
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup label="Student Status" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'ACTIVE', label: 'Active', icon: CheckCircle2 },
                    { id: 'PENDING', label: 'Pending', icon: Calendar },
                    { id: 'SUSPENDED', label: 'Suspended', icon: AlertCircle, restricted: isLibrarian },
                    { id: 'ARCHIVED', label: 'Archived', icon: Archive, restricted: isLibrarian },
                  ].map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant={form.status === s.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleAdminAction(s.id)}
                      disabled={isReadOnly || s.restricted}
                      className={cn(
                        "h-9 px-4 text-xs font-bold transition-all gap-2",
                        form.status === s.id ? "shadow-md scale-105" : "hover:bg-muted",
                        s.restricted && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </Button>
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup label="Library ID / Institutional ID">
                <div className="relative">
                  <Input 
                    value={form.student_id} 
                    onChange={e => setForm(prev => ({ ...prev, student_id: e.target.value }))}
                    placeholder="e.g. 123456"
                    className="h-10 rounded-lg text-sm font-mono"
                    disabled={isReadOnly}
                  />
                  {!form.student_id && (
                    <p className="mt-1 text-[10px] text-destructive">Required for circulation and ID cards</p>
                  )}
                </div>
              </FieldGroup>
            </div>

            <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Record Context</p>
                  <p className="text-[10px] text-muted-foreground">Registered on {user.joined || "N/A"}</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Physical Verification Checklist for Students */}
          {form.role === 'student' && form.status === 'ACTIVE' && initialUser.status === 'PENDING' && (
            <Section title="Physical ID Verification" icon={CheckCircle2}>
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Action Required: Physical Verification</p>
                    <p className="text-xs text-muted-foreground">The student is physically present and has presented their official ID.</p>
                  </div>
                </div>

                <div className="grid gap-3 pt-2">
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors">
                    <Checkbox 
                      id="nameMatches" 
                      checked={checklist.nameMatches} 
                      onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, nameMatches: !!checked }))}
                    />
                    <Label htmlFor="nameMatches" className="text-sm font-medium cursor-pointer flex-1">
                      Full Name matches physical ID Card
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors">
                    <Checkbox 
                      id="programMatches" 
                      checked={checklist.programMatches} 
                      onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, programMatches: !!checked }))}
                    />
                    <Label htmlFor="programMatches" className="text-sm font-medium cursor-pointer flex-1">
                      Academic Program matches physical ID Card
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors">
                    <Checkbox 
                      id="photoMatches" 
                      checked={checklist.photoMatches} 
                      onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, photoMatches: !!checked }))}
                    />
                    <Label htmlFor="photoMatches" className="text-sm font-medium cursor-pointer flex-1">
                      User identity matches ID Photo
                    </Label>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {form.role === "student_assistant" && (
            <Section title="Special Permissions" icon={Key}>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Manage Inventory</p>
                    <p className="text-xs text-muted-foreground">Allow adding and editing books in the catalog</p>
                  </div>
                  <Switch 
                    checked={form.permissions?.manage_inventory} 
                    onCheckedChange={(checked) => setForm(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, manage_inventory: checked }
                    }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Manage Circulation</p>
                    <p className="text-xs text-muted-foreground">Allow processing checkouts and returns</p>
                  </div>
                  <Switch 
                    checked={form.permissions?.manage_circulation} 
                    onCheckedChange={(checked) => setForm(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, manage_circulation: checked }
                    }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Manage Attendance</p>
                    <p className="text-xs text-muted-foreground">Allow scanning library cards for attendance</p>
                  </div>
                  <Switch 
                    checked={form.permissions?.manage_attendance} 
                    onCheckedChange={(checked) => setForm(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, manage_attendance: checked }
                    }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Manage Users</p>
                    <p className="text-xs text-muted-foreground">Allow viewing and modifying user accounts</p>
                  </div>
                  <Switch 
                    checked={form.permissions?.manage_users} 
                    onCheckedChange={(checked) => setForm(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, manage_users: checked }
                    }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Manage Policies</p>
                    <p className="text-xs text-muted-foreground">Allow modifying library settings and policies</p>
                  </div>
                  <Switch 
                    checked={form.permissions?.manage_policies} 
                    onCheckedChange={(checked) => setForm(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, manage_policies: checked }
                    }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Manage Analytics</p>
                    <p className="text-xs text-muted-foreground">Allow viewing system-wide library reports</p>
                  </div>
                  <Switch 
                    checked={form.permissions?.manage_analytics} 
                    onCheckedChange={(checked) => setForm(prev => ({
                      ...prev,
                      permissions: { ...prev.permissions, manage_analytics: checked }
                    }))}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </Section>
          )}

          {!isLibrarian && (
            <Section title="Danger Zone" icon={Trash2} danger>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-destructive">Archive User Identity</p>
                  <p className="text-xs text-muted-foreground">Remove access and hide from main directories</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleAdminAction("ARCHIVED")}>
                  Archive Identity
                </Button>
              </div>
            </Section>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-3 sm:p-4 mt-2 gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-card shadow-sm">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Student Review</p>
                <p className="text-[10px] text-muted-foreground capitalize">Managed by Library Administration</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                onClick={handleUpdateProfile}
                disabled={isSaving || !isDirty}
                className={cn("h-10 rounded-lg px-6 font-bold shadow-md transition-all")}
              >
                {isSaving ? "Saving..." : "Save Account Details"}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </SettingsShell>
  );
}
