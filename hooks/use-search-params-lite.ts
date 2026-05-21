"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

/**
 * A lightweight alternative to Next.js `useSearchParams()` that does NOT
 * trigger a Suspense boundary. Reads search params directly from
 * `window.location.search` on the client side.
 *
 * Next.js's `useSearchParams()` requires a Suspense boundary because it
 * participates in server-side streaming. Since the sidebar and breadcrumb
 * only need search params for active-state highlighting (a purely client
 * concern), this hook avoids that overhead entirely.
 */
export function useSearchParamsLite(): URLSearchParams {
  const pathname = usePathname();
  const [search, setSearch] = useState(() =>
    typeof window !== "undefined" ? window.location.search : ""
  );

  // Re-sync whenever the pathname changes (client-side navigation)
  useEffect(() => {
    setSearch(window.location.search);
  }, [pathname]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return useMemo(() => new URLSearchParams(search), [search]);
}
