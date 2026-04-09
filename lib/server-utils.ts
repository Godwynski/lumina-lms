import crypto from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both inputs must be strings.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  
  // To use timingSafeEqual, budgets must be equal length Buffers
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  if (bufA.length !== bufB.length) {
    // Still do a comparison to mimic timing (though length check 
    // itself leaks length, the timing safe part protects the content)
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
}
