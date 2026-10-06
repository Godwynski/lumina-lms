import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @internal Development safety check — verifies required env vars are set. */
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Sanitize user input before interpolating into PostgREST filter strings
 * (`.or()`, `.ilike()`, etc.). Strips characters that could break out of the
 * value position and inject additional filter operators.
 *
 * Characters removed: ( ) , . : \ * "
 *
 * @example
 *   query.or(`name.ilike.%${sanitizeFilterInput(raw)}%`)
 */
export function sanitizeFilterInput(input: string): string {
  return input.replace(/[(),.:*\\"]/g, '').trim();
}

/**
 * Transforms a string into a URL-friendly slug.
 */
export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Format a date string or Date object into a readable display date.
 * Defaults to "en-US" short month, numeric day, and numeric year (e.g., "Jan 1, 2026").
 */
export function formatDisplayDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  if (!date) return "—";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", options);
}

/**
 * Format a date into a localized time string.
 */
export function formatDisplayTime(
  date: string | Date | null | undefined,
  timeZone = "Asia/Manila"
): string {
  if (!date) return "—";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
}

