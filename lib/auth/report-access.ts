import { isAccessBlocked, type Profile, type Role } from "@/lib/auth/permissions";
import type { ReportDataset } from "@/lib/report-builder";

/** Analytics and reports are for librarians and super admins only. */
export function getReportDatasets(role: Role, profile?: Profile | null): ReportDataset[] {
  if (isAccessBlocked(profile)) return [];
  if (role === "super_admin" || role === "librarian") return ["attendance", "borrowing", "inventory", "users"];
  return [];
}
