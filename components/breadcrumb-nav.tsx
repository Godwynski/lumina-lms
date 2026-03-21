"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Helper to capitalize and format route segments
function formatSegment(segment: string) {
  // e.g., "student-catalog" -> "Student Catalog"
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function BreadcrumbNav() {
  const pathname = usePathname();

  const inProtected = pathname.startsWith("/protected");
  if (!inProtected) return null;

  const clean = pathname.replace(/\?.*$/, "");
  if (clean === "/protected" || clean === "/protected/") {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold tracking-tight text-foreground md:text-base">Dashboard</h1>
      </div>
    );
  }

  const segments = clean.split("/").filter(Boolean);
  const pathSegments = segments[0] === "protected" ? segments.slice(1) : segments;
  if (pathSegments.length === 0) return null;

  const current = pathSegments[pathSegments.length - 1];
  const first = pathSegments[0];

  const title = first === "settings" ? "Settings" : formatSegment(current);
  const showSettingsTab = first === "settings" && pathSegments.length > 1;
  const tabLabel = showSettingsTab ? formatSegment(current) : null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-sm font-semibold tracking-tight text-foreground md:text-base">{title}</h1>
      {showSettingsTab && tabLabel && (
        <>
          <span className="text-muted-foreground">/</span>
          <Badge variant="outline" className="h-6 gap-1 rounded-md border-border bg-muted px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Settings className="h-3 w-3" />
            {tabLabel}
          </Badge>
        </>
      )}
      {first !== "settings" && pathSegments.length > 1 && (
        <Link href={`/protected/${first}`} className="ml-1 hidden text-xs text-muted-foreground hover:text-foreground sm:inline">
          Back to {formatSegment(first)}
        </Link>
      )}
    </nav>
  );
}
