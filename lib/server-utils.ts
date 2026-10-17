import crypto from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both inputs must be strings.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  
  // Pre-hash both inputs with SHA-256 to ensure strictly equal 32-byte buffers,
  // eliminating length-leakage timing variance.
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB) && a === b;
}
