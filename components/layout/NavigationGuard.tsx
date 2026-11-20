"use client";

import { useEffect } from "react";

interface NavigationGuardProps {
  isDirty: boolean;
  message?: string;
}

/**
 * NavigationGuard intercepts internal Next.js navigation (via <a> tags)
 * and external navigation (tab close, refresh) when isDirty is true.
 */
export function NavigationGuard({ 
  isDirty, 
  message = "You have unsaved changes. Are you sure you want to leave?" 
}: NavigationGuardProps) {
  useEffect(() => {
    // Handle tab close, refresh, and manual URL entry
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    // Handle internal Next.js Link clicks
    // Since App Router doesn't provide a native way to block router.push/Link,
    // we intercept the click on the capture phase.
    const handleAnchorClick = (e: MouseEvent) => {
      if (!isDirty) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      // Only intercept if it's an internal link and not a hash link or target="_blank"
      if (
        anchor && 
        anchor.href && 
        anchor.href.startsWith(window.location.origin) &&
        !anchor.href.includes("#") &&
        anchor.target !== "_blank" &&
        !e.defaultPrevented
      ) {
        if (!window.confirm(message)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleAnchorClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleAnchorClick, true);
    };
  }, [isDirty, message]);

  return null;
}
