const DEFAULT_BUCKET = "library-cards";

export const CARD_ASSET_BUCKET =
  process.env.NEXT_PUBLIC_CARD_ASSET_BUCKET || DEFAULT_BUCKET;

export function sanitizeStudentId(studentId: string) {
  return studentId.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
}

function parseStudentIdFromEmail(email?: string | null) {
  if (!email) return null;

  const localPart = email.split("@")[0].toLowerCase();
  
  // 1. Student Case: lastname.id.@alabang.sti.edu.ph or lastname.id@...
  // Usually has a sequence of 6+ digits
  const digitMatch = localPart.match(/\d{6,}/) || localPart.match(/\d+/);
  if (digitMatch) {
    return `STU-${digitMatch[0]}`;
  }

  // 2. Faculty Case: firstname.lastname@alabang.sti.edu.ph
  // Use the local part directly (e.g. FAC-juan.delacruz)
  return `FAC-${localPart}`;
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
}) {
  return (
    (opts.studentId ? sanitizeStudentId(opts.studentId) : null) ||
    parseStudentIdFromEmail(opts.email) ||
    parseStudentIdFromEmail(opts.fallbackEmail) ||
    (opts.userId ? sanitizeStudentId(opts.userId.slice(0, 12)) : null)
  );
}

export function getDeterministicQrUrl(studentId: string) {
  const { qr } = fileNamesFor(studentId);
  return publicObjectUrl(qr);
}

export function getDeterministicProfileUrl(studentId: string) {
  const { profile } = fileNamesFor(studentId);
  return publicObjectUrl(profile);
}
