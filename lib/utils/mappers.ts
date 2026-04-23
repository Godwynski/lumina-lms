import { User } from "@/app/(authenticated)/users/UsersContent";

/**
 * Standard mapper for Profile records from Supabase to the internal UI User type.
 */
export const mapProfileToUser = (row: Record<string, unknown>): User => ({
  id: String(row.id ?? ""),
  name:
    (typeof row.full_name === "string" && row.full_name.trim()) ||
    (typeof row.email === "string"
      ? row.email
          .split("@")[0]
          .split(".")
          .map((part: string) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
          .join(" ")
      : "Unnamed User"),
  email: typeof row.email === "string" ? row.email : "",
  avatarUrl: typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url : null,
  role: ["admin", "librarian", "staff", "student"].includes(String(row.role))
    ? (String(row.role) as User["role"])
    : "student",
  status: typeof row.status === "string" ? row.status : "active",
  department: typeof row.department === "string" && row.department.trim() ? row.department : "General",
  joined:
    typeof row.created_at === "string"
      ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "Unknown",
  student_id: typeof row.student_id === "string" ? row.student_id : null,
  address: typeof row.address === "string" ? row.address : null,
  phone: typeof row.phone === "string" ? row.phone : null,
});
