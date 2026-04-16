"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Section, FieldGroup } from "@/components/settings/SettingsShared";

export function NewUserClient() {
  const router = useRouter();
  const supabase = createClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("student");
  const [inviteDept, setInviteDept] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = inviteEmail.length > 0 || inviteDept.length > 0;

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setIsSaving(true);
    setError(null);
    try {
      const email = inviteEmail.trim().toLowerCase();
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error("No account found for that email. They must sign in first.");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          role: inviteRole,
          status: "PENDING",
          department: inviteDept.trim() || "General",
        })
        .eq("id", profile.id)
        .select("*")
        .single();

      if (updateError) throw updateError;
      
      toast.success(`Access granted to ${email}`);
      router.push("/users");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to invite user";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsShell isDirty={isDirty}>
      <div className="flex flex-col gap-6">
        
        {/* -- Header -- */}
        <div className="flex items-center gap-4 border-b border-border pb-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/users')} className="-ml-2 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">Grant System Access</h1>
            <p className="text-xs text-muted-foreground truncate">Elevate an existing account to library privileges</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
            {error}
          </div>
        )}
        <div className="grid gap-6">
          <Section title="Access Details" icon={Mail} hideHeaderOnMobile>
            <div className="flex flex-col gap-4">
              <FieldGroup label="Target Email Address">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@organization.com"
                    className="h-10 rounded-lg pl-9 text-sm"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  The user must have already signed up to the system via SSO or Email initially.
                </p>
              </FieldGroup>
            </div>
          </Section>
          <div className="space-y-2">
            <Label>Assign Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="librarian">Librarian</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Input
              type="text"
              value={inviteDept}
              onChange={(e) => setInviteDept(e.target.value)}
              placeholder="e.g. Computer Science"
            />
          </div>
          <div className="pt-4 border-t mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.push('/users')} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || isSaving}>
              {isSaving ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </div>
      </div>
    </SettingsShell>
  );
}
