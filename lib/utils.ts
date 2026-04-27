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
