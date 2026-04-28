"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Lock, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";

interface PersonalInfoFormProps {
  role: string;
  initialProfile: {
    full_name: string | null;
    student_id: string | null;
    email: string | null;
    status: string;
  };
  addressValue: string;
  phoneValue: string;
  departmentValue: string;
  onAddressChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onDepartmentChange: (val: string) => void;
  programs: string[];
  isProfileDirty: boolean;
}

/** Label for a locked (read-only) field */
function LockedLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs font-bold text-foreground/80">{children}</Label>
      <Lock className="w-2.5 h-2.5 text-muted-foreground/30" />
    </div>
  );
}

/** Label for an editable field */
function EditableLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs font-bold text-foreground/80">{children}</Label>
      <Pencil className="w-2.5 h-2.5 text-primary/40" />
    </div>
  );
}

export function PersonalInfoForm({
  role,
  initialProfile,
  addressValue,
  phoneValue,
  departmentValue,
  onAddressChange,
  onPhoneChange,
}: PersonalInfoFormProps) {
  return (
    <div className="flex-1 space-y-6">
      {/* Locked: Full Name */}
      <div className="space-y-2">
        <LockedLabel>Full Name</LockedLabel>
        <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-bold text-foreground/80 shadow-sm">
          {initialProfile.full_name || "Not Set"}
        </div>
      </div>

      {/* Locked: ID / Email / Status row */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <LockedLabel>Student ID</LockedLabel>
          <div className="h-11 rounded-xl bg-primary/5 border border-primary/10 px-4 flex items-center text-sm font-mono font-bold text-primary shadow-sm">
            {initialProfile.student_id || "NOT-ASSIGNED"}
          </div>
        </div>

        <div className="space-y-2">
          <LockedLabel>Official Email</LockedLabel>
          <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-semibold text-foreground/70 shadow-sm">
            {initialProfile.email || "No Email"}
          </div>
        </div>

        <div className="space-y-2">
          <LockedLabel>Account Status</LockedLabel>
          <div className={cn(
            "h-11 rounded-xl border border-border/20 px-4 flex items-center text-[11px] font-black uppercase tracking-widest shadow-sm",
            initialProfile.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
          )}>
            {initialProfile.status}
          </div>
        </div>
      </div>

      {/* Editable: Contact / Address */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <EditableLabel>Contact Number</EditableLabel>
          <Input
            value={phoneValue}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+63 900 000 0000"
            className="h-11 rounded-xl border-border/40 bg-background px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <EditableLabel>Residential Address</EditableLabel>
          <Input
            value={addressValue}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Street, City, Province"
            className="h-11 rounded-xl border-border/40 bg-background px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
        </div>
      </div>

      {/* Locked: Academic Program (students only) */}
      {role === 'student' && (
        <div className="space-y-2">
          <LockedLabel>Academic Program</LockedLabel>
          <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-bold text-foreground/80 shadow-sm">
            {departmentValue || <span className="text-muted-foreground/50 font-medium">Not Assigned</span>}
          </div>
        </div>
      )}
    </div>
  );
}
