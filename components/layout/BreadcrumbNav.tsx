"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


// Explicit mapping for professional labels
const ROUTE_LABELS: Record<string, string> = {
  "catalog": "Inventory",
  "student-catalog": "Catalog",
  "circulation": "Circulation Desk",
  "history": "Borrow History",
  "users": "User Directory",
  "policies": "System Policies",
  "audit": "Audit Logs",
  "operations": "Operations",
  "profile": "Profile Settings",
  "preferences": "Preferences",
  "security": "Security",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Context-aware labels for UUID segments based on their parent path
const DYNAMIC_SEGMENT_LABELS: Record<string, string> = {
  "student-catalog": "Book Details",
  "catalog": "Book Details",
  "users": "User Profile",
  "audit": "Log Entry",
};

// Helper to capitalize and format route segments
function formatSegment(segment: string, parentSegment?: string) {
  if (ROUTE_LABELS[segment]) return ROUTE_LABELS[segment];

  // Specific contextual overrides for "new" segments
  if (segment === "new") {
    if (parentSegment === "users") return "Invite User";
    if (parentSegment === "catalog") return "Add Asset";
    return "New Entry";
  }

  // Detect UUID-like dynamic segments and show a contextual label
  if (UUID_RE.test(segment) && parentSegment) {
    return DYNAMIC_SEGMENT_LABELS[parentSegment] || "Details";
  }
  if (UUID_RE.test(segment)) return "Details";

  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function BreadcrumbNav() {
  const pathname = usePathname();

  const clean = pathname.replace(/\?.*$/, "");
  if (clean === "/dashboard" || clean === "/dashboard/") {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold tracking-tight text-foreground md:text-base">Dashboard</h1>
      </div>
    );
  }

  const pathSegments = clean.split("/").filter(Boolean);
  if (pathSegments.length === 0) return null;

  const current = pathSegments[pathSegments.length - 1];
  const parentSegment = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : undefined;

  const title = formatSegment(current, parentSegment);

  // For the back link, navigate to the parent path (e.g. /student-catalog) not the root segment
  const backHref = pathSegments.length > 1 ? `/${pathSegments.slice(0, -1).join("/")}` : null;
  const backLabel = parentSegment ? formatSegment(parentSegment) : null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-sm font-bold tracking-tight text-foreground md:text-base">{title}</h1>
      {backHref && backLabel && (
        <Link href={backHref} className="ml-1 hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary sm:inline-flex items-center gap-1 opacity-60 hover:opacity-100">
          <div className="h-1 w-1 rounded-full bg-border" />
          {backLabel}
        </Link>
      )}
    </nav>
  );
}
