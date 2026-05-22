"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

/**
 * A lightweight helper that wraps Next.js `useSearchParams()` to return a standard
 * `URLSearchParams` object, ensuring full reactivity when search parameters change.
 */
export function useSearchParamsLite(): URLSearchParams {
  const searchParams = useSearchParams();
  return useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
}
