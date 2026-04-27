"use client";

import { useState, useEffect } from "react";
import { UserCheck, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Section, PremiumToggle } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";
import { AvatarManager } from "../profile/AvatarManager";
import { PersonalInfoForm } from "../profile/PersonalInfoForm";
import { SelfDeleteAccountDialog } from "@/components/account/SelfDeleteAccountDialog";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface ProfileSectionProps {
  role: string;
  initialProfile: {
    full_name: string | null;
    avatar_url: string | null;
    address: string | null;
    phone: string | null;
    department: string | null;
    status: string;
    student_id: string | null;
    email: string | null;
  };
}

export function ProfileSection({ role, initialProfile }: ProfileSectionProps) {
  const { preferences, updatePreferences: updatePrefsContext } = usePreferences();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [intelligentAlerts, setIntelligentAlerts] = useState(true);

  useEffect(() => {
    if (preferences && typeof preferences.intelligentAlerts === "boolean") {
      setIntelligentAlerts(preferences.intelligentAlerts);
    }
  }, [preferences]);

  const toggleIntelligentAlerts = async (checked: boolean) => {
    setIntelligentAlerts(checked);
    try {
      await updatePrefsContext({ intelligentAlerts: checked });
      toast.success("Alert preferences updated");
    } catch {
      toast.error("Failed to update preferences");
    }
  };
  
  const [addressValue, setAddressValue] = useState(initialProfile.address || "");
  const [phoneValue, setPhoneValue] = useState(initialProfile.phone || "");
  const [departmentValue, setDepartmentValue] = useState(initialProfile.department || "");
  const [programs, setPrograms] = useState<string[]>([]);
  
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (role === 'student') {
      import("@/lib/actions/onboarding").then(m => m.getAcademicPrograms().then(setPrograms));
    }
  }, [role]);

  const isProfileDirty = 
    addressValue !== (initialProfile.address || "") || 
    phoneValue !== (initialProfile.phone || "") ||
    departmentValue !== (initialProfile.department || "");

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          address: addressValue.trim(),
          phone: phoneValue.trim(),
          department: departmentValue.trim()
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to save profile");

      await updatePrefsContext({ displayName: initialProfile.full_name || "" });
      toast.success("Profile saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      <SettingsShell isDirty={isProfileDirty}>
        <Section>
          <div className="grid gap-6">
            
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start bg-card/30 border border-border/40 p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden">
              <AvatarManager 
                initialAvatarUrl={initialProfile.avatar_url}
                fullName={initialProfile.full_name}
              />

              <PersonalInfoForm 
                role={role}
                initialProfile={initialProfile}
                addressValue={addressValue}
                phoneValue={phoneValue}
                departmentValue={departmentValue}
                onAddressChange={setAddressValue}
                onPhoneChange={setPhoneValue}
                onDepartmentChange={setDepartmentValue}
                programs={programs}
                isProfileDirty={isProfileDirty}
              />
            </div>

            <div className="rounded-2xl border border-border/40 bg-card/30 p-5 transition-all hover:bg-card/50">
              <PremiumToggle 
                title="Intelligent Alerts" 
                description="Receive smart notifications for due dates, reservation availability, and account status."
                checked={intelligentAlerts}
                onChange={toggleIntelligentAlerts}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-card/30 p-5 mt-0 transition-all hover:bg-card/50">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-background shadow-sm">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Current Membership</p>
                  <p className="text-[11px] text-muted-foreground/80 font-black uppercase tracking-widest">{role}</p>
                </div>
              </div>
              <Button
                onClick={saveProfile}
                disabled={profileSaving || !isProfileDirty}
                className={cn("h-11 rounded-xl px-8 font-bold shadow-md transition-all text-sm")}
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </Button>
            </div>

            {/* Account Archive — Danger Zone */}
            <Card className="group relative border-destructive/20 bg-destructive/5 p-5 shadow-none transition-all hover:bg-destructive/10 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive group-hover:bg-destructive/20 transition-colors shrink-0">
                  <Archive className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-destructive">
                      Account Archive
                    </Label>
                    <p className="mt-1 text-[11px] leading-relaxed text-destructive/80 max-w-lg">
                      Archive your profile to restrict access while preserving data according to system policy.
                    </p>
                  </div>
                  <div className="pt-2 flex">
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="h-9 rounded-xl gap-2 bg-destructive hover:bg-destructive/90 text-xs font-bold px-5 shadow-md"
                    >
                      <Archive size={14} />
                      Archive Profile
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </Section>
      </SettingsShell>

      <SelfDeleteAccountDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
