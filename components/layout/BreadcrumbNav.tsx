"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useSearchParamsLite } from "@/hooks/use-search-params-lite";

// Explicit mapping for professional labels
const ROUTE_LABELS: Record<string, string> = {
  "inventory": "Inventory",
  "catalog": "Inventory",
  "student-catalog": "Catalog",
  "circulation": "Circulation Desk",
  "history": "My Borrowing",
  "users": "User Directory",
  "policies": "System Policies",
  "audit": "Audit Logs",
  "profile": "My Profile",
  "attendance": "Attendance Logs",
  "notifications": "Notifications",
  "reports": "Report Builder",
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

  // Specific contextual overrides for "new" or "add" segments
  if (segment === "new" || segment === "add") {
    if (parentSegment === "inventory" || parentSegment === "catalog") return "Add Book";
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
  const searchParams = useSearchParamsLite();
  const { role } = usePreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clean = pathname.replace(/\?.*$/, "");
  if (clean === "/dashboard" || clean === "/dashboard/") {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-base font-bold tracking-tight text-foreground md:text-xl">Dashboard</h1>
      </div>
    );
  }

  const pathSegments = clean.split("/").filter(Boolean);
  if (pathSegments.length === 0) return null;

  const current = pathSegments[pathSegments.length - 1];
  const parentSegment = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : undefined;

  const viewParam = mounted ? searchParams.get("view") : null;
  let title = formatSegment(current, parentSegment);
  if (current === "history") {
    const isViewingLogs = viewParam === "logs" && 
                          (role === "super_admin" || role === "librarian" || role === "library_staff");
    title = isViewingLogs ? "Borrowing Logs" : "My Borrowing";
  } else if (current === "attendance") {
    const isStaffUser = (role === "super_admin" || role === "librarian") || 
                        (role === "library_staff" && viewParam === "logs");
    title = isStaffUser ? "Attendance Logs" : "My Attendance";
  }

  // For the back link, navigate to the parent path (e.g. /student-catalog) not the root segment
  let backHref = pathSegments.length > 1 ? `/${pathSegments.slice(0, -1).join("/")}` : null;
  let backLabel = parentSegment ? formatSegment(parentSegment) : null;
  if (current === "reports" && parentSegment === "analytics" && role === "library_staff") {
    backHref = null;
  }
  if (parentSegment === "history") {
    const isViewingLogs = viewParam === "logs" && 
                          (role === "super_admin" || role === "librarian" || role === "library_staff");
    backLabel = isViewingLogs ? "Borrowing Logs" : "My Borrowing";
  } else if (parentSegment === "attendance") {
    const isStaffUser = (role === "super_admin" || role === "librarian") || 
                        (role === "library_staff" && viewParam === "logs");
    backLabel = isStaffUser ? "Attendance Logs" : "My Attendance";
  }

  // Redirect "Inventory" (catalog) back links to inventory page
  // And update the label to reflect the destination
  if (backHref === "/catalog") {
    backHref = "/inventory";
    backLabel = "Inventory";
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 lg:gap-3">
      {backHref && backLabel && (
        <Link
          href={backHref}
          aria-label={`Back to ${backLabel}`}
          className="inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:w-auto lg:px-2"
        >
          <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
          <span className="hidden whitespace-nowrap lg:inline">{backLabel}</span>
        </Link>
      )}
      <h1 className="line-clamp-2 min-w-0 break-words text-base font-bold leading-tight tracking-tight text-foreground md:text-xl md:leading-tight">
        {title}
      </h1>
    </nav>
  );
}

