"use client";

import { Input } from "@/components/ui/input";
import { FieldGroup } from "../SettingsShared";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

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

export function PersonalInfoForm({
  role,
  initialProfile,
  addressValue,
  phoneValue,
  departmentValue,
  onAddressChange,
  onPhoneChange,
  onDepartmentChange,
  programs,
  isProfileDirty
}: PersonalInfoFormProps) {
  return (
    <div className="flex-1 space-y-6">
      <FieldGroup label="Full Name">
        <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-bold text-foreground/80 shadow-sm">
          {initialProfile.full_name || "Not Set"}
        </div>
      </FieldGroup>

      <div className="grid gap-5 sm:grid-cols-3">
        <FieldGroup label="Student ID">
          <div className="h-11 rounded-xl bg-primary/5 border border-primary/10 px-4 flex items-center text-sm font-mono font-bold text-primary shadow-sm">
            {initialProfile.student_id || "NOT-ASSIGNED"}
          </div>
        </FieldGroup>

        <FieldGroup label="Official Email">
          <div className="h-11 rounded-xl bg-muted/20 border border-border/40 px-4 flex items-center text-sm font-semibold text-foreground/70 shadow-sm">
            {initialProfile.email || "No Email"}
          </div>
        </FieldGroup>

        <FieldGroup label="Account Status">
          <div className={cn(
            "h-11 rounded-xl border border-border/20 px-4 flex items-center text-[11px] font-black uppercase tracking-widest shadow-sm",
            initialProfile.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
          )}>
            {initialProfile.status}
          </div>
        </FieldGroup>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldGroup label="Contact Number">
          <Input
            value={phoneValue}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+63 900 000 0000"
            className="h-11 rounded-xl border-border/40 bg-background px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
        </FieldGroup>

        <FieldGroup label="Residential Address">
          <Input
            value={addressValue}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Street, City, Province"
            className="h-11 rounded-xl border-border/40 bg-background px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
        </FieldGroup>
      </div>

      {role === 'student' && (
        <FieldGroup label="Academic Program">
          <div className="flex flex-col gap-2">
            <Select 
              value={departmentValue}
              onValueChange={onDepartmentChange}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/40 text-sm bg-background shadow-sm focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Select your program" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {programs.map((prog) => (
                  <SelectItem key={prog} value={prog}>
                    {prog}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {initialProfile.status === 'ACTIVE' && isProfileDirty && (
              <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1.5 mt-1 bg-amber-500/10 p-2 rounded-lg w-fit">
                <ShieldAlert className="w-3.5 h-3.5" />
                Changing details will require re-verification at the library.
              </p>
            )}
          </div>
        </FieldGroup>
      )}
    </div>
  );
}
