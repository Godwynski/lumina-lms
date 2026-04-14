"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


// Explicit mapping for professional labels
const ROUTE_LABELS: Record<string, string> = {
  "catalog": "Inventory",
  "student-catalog": "Catalog",
  "circulation": "Circulation Desk",
  "history": "Borrow History",
  "violations": "Violations",
  "users": "User Directory",
  "policies": "System Policies",
  "audit": "Audit Logs",
  "operations": "Operations",
  "profile": "Profile Settings",
  "preferences": "Preferences",
  "security": "Security",
};

// Helper to capitalize and format route segments
function formatSegment(segment: string) {
  if (ROUTE_LABELS[segment]) return ROUTE_LABELS[segment];

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
  const first = pathSegments[0];

  const title = formatSegment(current);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-sm font-semibold tracking-tight text-foreground md:text-base">{title}</h1>
      {pathSegments.length > 1 && (
        <Link href={`/${first}`} className="ml-1 hidden text-xs text-muted-foreground hover:text-foreground sm:inline">
          Back to {formatSegment(first)}
        </Link>
      )}
    </nav>
  );
}
