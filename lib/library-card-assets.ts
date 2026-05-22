const DEFAULT_BUCKET = "library-cards";

export const CARD_ASSET_BUCKET =
  process.env.NEXT_PUBLIC_CARD_ASSET_BUCKET || DEFAULT_BUCKET;

export function sanitizeStudentId(studentId: string) {
  return studentId.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
}

export function generateFacultyId() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const secureRandom = array[0] / (0xFFFFFFFF + 1);
  const suffix = Math.floor(100000 + secureRandom * 900000).toString();
  return `FAC-${suffix}`;
}

/**
 * Parses the student number from a STI Alabang email address.
 * 
 * Student emails: lastname.NUMBER@alabang.sti.edu.ph  → STU-{NUMBER}
 * Faculty emails: firstname.lastname@alabang.sti.edu.ph → FAC-{localpart}
 * External emails (gmail, etc.) → null (cannot determine)
 */
export function parseStudentIdFromEmail(email?: string | null): string | null {
  if (!email) return null;

  const [localPart, domain] = email.split("@");
  if (!localPart) return null;

  const local = localPart.toLowerCase();

  // STI domain: alabang.sti.edu.ph
  const isStiDomain = domain?.toLowerCase().includes("sti.edu.ph");

  if (isStiDomain) {
    // Student pattern: has 6+ consecutive digits → STU-{digits}
    const digitMatch = local.match(/(\d{6,})/);
    if (digitMatch) {
      return `STU-${digitMatch[1]}`;
    }
    // Faculty pattern: no digits (or < 6) → FAC-{localpart}
    const id = `FAC-${local}`;
    if (id.includes("___")) return generateFacultyId();
    return id;
  }

  // Non-STI domain: try to extract any 6+ digit sequence for student IDs
  const digitMatch = local.match(/(\d{6,})/);
  if (digitMatch) {
    return `STU-${digitMatch[1]}`;
  }

  return null;
}

/**
 * Normalizes a raw student_id value to ensure it has the correct role-based prefix.
 * - Pure numeric strings → STU-{number}
 * - Staff/admin/librarian with no FAC- prefix → FAC-{id}
 * - Already prefixed IDs (STU-/FAC-) → unchanged
 */
function normalizeIdByRole(id: string | null, role?: string | null): string | null {
  if (!id) return null;

  const upper = id.trim().toUpperCase();

  // Already correctly prefixed
  if (upper.startsWith("STU-") || upper.startsWith("FAC-")) return upper;

  // Pure numeric → always a student number
  if (/^\d+$/.test(upper)) return `STU-${upper}`;

  // Staff/admin/librarian without FAC- prefix
  const staffRoles = ["super_admin", "librarian", "staff"];
  if (role && staffRoles.includes(role.toLowerCase())) {
    return `FAC-${upper}`;
  }

  return upper;
}

export function fileNamesFor(studentId: string) {
  const normalized = sanitizeStudentId(studentId);
  return {
    qr: `qr_${normalized}.png`,
    profile: `profile_${normalized}.webp`,
  };
}

export function publicObjectUrl(fileName: string) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  return `${projectUrl}/storage/v1/object/public/${CARD_ASSET_BUCKET}/${fileName}`;
}

export function isDeterministicProfileUrl(url: string | null) {
  if (!url) return false;
  return url.includes(`/storage/v1/object/public/${CARD_ASSET_BUCKET}/profile_`);
}

export function resolveStudentId(opts: {
  studentId?: string | null;
  email?: string | null;
  fallbackEmail?: string | null;
  userId?: string;
  role?: string | null;
}): string | null {
  // 1. Try the stored student_id (normalize it if it's a bare number or missing prefix)
  const normalizedStored = normalizeIdByRole(
    opts.studentId ? sanitizeStudentId(opts.studentId) : null,
    opts.role
  );

  const result = (
    normalizedStored ||
    parseStudentIdFromEmail(opts.email) ||
    parseStudentIdFromEmail(opts.fallbackEmail) ||
    (opts.userId ? `FAC-${sanitizeStudentId(opts.userId.slice(0, 12))}` : null)
  );

  // If the ID is the literal blank template or contains placeholders, generate a real one
  if (result && (result.includes("___") || result === "FAC-___________.______")) {
    return generateFacultyId();
  }

  return result;
}

export function getDeterministicQrUrl(studentId: string) {
  const { qr } = fileNamesFor(studentId);
  return publicObjectUrl(qr);
}

export function getDeterministicProfileUrl(studentId: string) {
  const { profile } = fileNamesFor(studentId);
  return publicObjectUrl(profile);
}
