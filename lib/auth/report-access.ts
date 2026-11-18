import { isAccessBlocked, type Profile, type Role } from "@/lib/auth/permissions";
import type { ReportDataset } from "@/lib/report-builder";

export function getReportDatasets(role: Role, profile?: Profile | null): ReportDataset[] {
  if (isAccessBlocked(profile)) return [];
  if (role === "super_admin" || role === "librarian") return ["attendance", "borrowing", "inventory", "users"];
  if (role !== "library_staff" || profile?.status?.toUpperCase() !== "ACTIVE") return [];
  const result: ReportDataset[] = [];
  if (profile.permissions?.manage_attendance) result.push("attendance");
  if (profile.permissions?.manage_circulation) result.push("borrowing");
  return result;
}
