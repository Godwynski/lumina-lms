"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Shield, MapPin, Calendar, Mail, User as UserIcon, Phone, CheckCircle2, AlertCircle, Archive } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Section, FieldGroup } from "@/components/settings/SettingsShared";
import type { User } from "../UsersContent";

export function UserDetailClient({ initialUser }: { initialUser: User }) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User>(initialUser);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  });

  const [checklist, setChecklist] = useState({
    nameMatches: false,
    programMatches: false,
    photoMatches: false,
  });

  const isDirty = 
    form.name !== initialUser.name ||
    form.role !== initialUser.role ||
    form.status !== initialUser.status ||
    form.department !== initialUser.department ||
    form.student_id !== (initialUser.student_id || "") ||
    form.address !== (initialUser.address || "") ||
    form.phone !== (initialUser.phone || "");

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const patch = {
        full_name: form.name.trim(),
        role: form.role,
        status: form.status.trim().toUpperCase(),
        department: form.department.trim() || "General",
        student_id: form.student_id.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      };

      // Enforce checklist for student activation
      if (form.status === 'ACTIVE' && initialUser.status === 'PENDING' && form.role === 'student') {
        const isVerified = checklist.nameMatches && checklist.programMatches && checklist.photoMatches;
        if (!isVerified) {
          toast.error("Please complete the physical ID verification checklist before approving.");
          setIsSaving(false);
          return;
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      if (form.status !== initialUser.status) {
        await supabase
          .from("library_cards")
          .update({ status: form.status.toLowerCase() })
          .eq("user_id", user.id);
      }

      const nextUser = updated ? {
        ...user,
        name: updated.full_name || updated.email,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        department: updated.department,
        student_id: updated.student_id
      } : { ...user, ...form };
      
      setUser(nextUser);
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

  const handleAdminAction = (newStatus: string) => {
    setForm(prev => ({ ...prev, status: newStatus }));
    // We'll let the user click "Save Changes" at the bottom to commit status changes too
    // for a consistent experience, or we can commit immediately. 
    // To match Profile (Save Changes bar), we'll keep it in form state.
    // Explicitly typed prev is not needed if useState is correctly inferred, 
    // but tsc is strict here because it's a client component with multiple states.
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
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{form.role}</p>
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
                  <FieldGroup label="Organization Unit">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        value={form.department || ""} 
                        onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="e.g. IT, Admin"
                        className="h-10 rounded-lg pl-9 text-sm"
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
              <FieldGroup label="System Role">
                 <Select value={form.role} onValueChange={(value) => setForm(prev => ({ ...prev, role: value as User["role"] }))}>
                  <SelectTrigger className="h-10 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[130]">
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="librarian">Librarian</SelectItem>
                    <SelectItem value="staff">Staff Member</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>

              <FieldGroup label="Membership Status">
                <Select value={form.status.toLowerCase()} onValueChange={(v) => handleAdminAction(v.toUpperCase())}>
                  <SelectTrigger className="h-10 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[130]">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                    <SelectItem value="suspended">Suspended Access</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>

              <FieldGroup label="Library ID Number (Auto-extracted)">
                <div className="relative">
                  <Input 
                    value={form.student_id} 
                    onChange={e => setForm(prev => ({ ...prev, student_id: e.target.value }))}
                    placeholder="e.g. 123456"
                    className="h-10 rounded-lg text-sm font-mono"
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
                    <p className="text-xs text-muted-foreground">The student is physically present and has presented their school ID.</p>
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

          {/* Admin Tools - Integrated into bottom bar via SettingsShell usually, but we'll show current save state */}

          <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-3 sm:p-4 mt-2 gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-card shadow-sm">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Membership Review</p>
                <p className="text-[10px] text-muted-foreground capitalize">Managed by Library Administration</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                variant="ghost"
                onClick={() => handleAdminAction('ARCHIVED')}
                className="h-10 rounded-lg px-4 font-bold text-destructive hover:bg-destructive/10"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive User
              </Button>
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
