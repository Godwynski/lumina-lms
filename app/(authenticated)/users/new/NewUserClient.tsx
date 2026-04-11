"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewUserClient() {
  const router = useRouter();
  const supabase = createClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("student");
  const [inviteDept, setInviteDept] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const { data: updated, error: updateError } = await supabase
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
      
      router.push("/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/users')} className="-ml-2 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invite User</h1>
          <p className="text-sm text-muted-foreground">Add a new user to the system.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@organization.com"
            />
            <p className="text-xs text-muted-foreground">
              The user must have already signed up to the system via SSO or Email initially.
            </p>
          </div>
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
    </div>
  );
}
