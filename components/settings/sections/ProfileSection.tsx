"use client";

import { UserCheck, Shield } from "lucide-react";
import { Section } from "../SettingsShared";
import { AvatarManager } from "../profile/AvatarManager";
import { PersonalInfoForm } from "../profile/PersonalInfoForm";
import { DashboardModeToggle } from "../profile/DashboardModeToggle";

interface ProfileSectionProps {
  role: string;
  preferences?: Record<string, unknown>;
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

export function ProfileSection({ role, preferences, initialProfile }: ProfileSectionProps) {
  const currentMode = (preferences?.preferred_dashboard_view as "student" | "staff") || "staff";

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      <Section>
        <div className="grid gap-6">
          {/* SA Mode Toggle Section */}
          {role === "student_assistant" && initialProfile.status === "ACTIVE" && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <DashboardModeToggle currentMode={currentMode} />
            </div>
          )}

          <div className="flex flex-col gap-8 sm:flex-row sm:items-start bg-card/30 border border-border/40 p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden">
            <AvatarManager 
              initialAvatarUrl={initialProfile.avatar_url}
              fullName={initialProfile.full_name}
            />

            <PersonalInfoForm 
              role={role}
              initialProfile={initialProfile}
              addressValue={initialProfile.address || ""}
              phoneValue={initialProfile.phone || ""}
              departmentValue={initialProfile.department || ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-2">
            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-card/30 p-5 transition-all hover:bg-card/50">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-background shadow-sm">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Current Membership</p>
                  <p className="text-[11px] text-muted-foreground/80 font-black uppercase tracking-widest">
                    {role.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-card/30 p-5 transition-all hover:bg-card/50">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-background shadow-sm">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Security Status</p>
                  <p className="text-[11px] text-muted-foreground/80 font-black uppercase tracking-widest">Verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
