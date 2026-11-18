"use client";

import { UserCheck, Shield } from "lucide-react";
import { Section } from "../SettingsShared";
import { AvatarManager } from "../profile/AvatarManager";
import { PersonalInfoForm } from "../profile/PersonalInfoForm";
import { getRoleLabel } from "@/components/common/RoleBadge";

interface ProfileSectionProps {
  role: string;
  initialProfile: {
    full_name: string | null;
    avatar_url: string | null;
    address: string | null;
    phone: string | null;
    department: string | null;
    patron_type?: string | null;
    status: string;
    student_id: string | null;
    email: string | null;
  };
}

export function ProfileSection({ role, initialProfile }: ProfileSectionProps) {
  return (
    <div className="w-full max-w-3xl pb-12 space-y-6">
      <Section>
        <div className="grid gap-6">
          {/* Profile Section Content */}
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start bg-card border border-border/60 p-6 sm:p-8 rounded-2xl shadow-xs relative overflow-hidden">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-5 transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background shadow-xs">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Current Membership</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {getRoleLabel(role)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-5 transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background shadow-xs">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Account Access</h2>
                  <p className="text-xs font-medium text-muted-foreground">
                    {role === "patron"
                      ? "Your account credentials are managed by the school system. Contact the administrator for security concerns."
                      : "Your account credentials and access permissions are managed by the system. Contact an administrator if you need changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
