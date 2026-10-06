import { describe, it, expect } from 'vitest';
import {
  sanitizeStudentId,
  generateFacultyId,
  parseStudentIdFromEmail,
  resolveStudentId,
  fileNamesFor,
  publicObjectUrl,
  isDeterministicProfileUrl,
  getDeterministicQrUrl,
  getDeterministicProfileUrl,
  CARD_ASSET_BUCKET,
} from '../library-card-assets';

describe('sanitizeStudentId', () => {
  it('should trim whitespace', () => {
    expect(sanitizeStudentId('  12345  ')).toBe('12345');
  });

  it('should convert to uppercase', () => {
    expect(sanitizeStudentId('abc-123')).toBe('ABC-123');
  });

  it('should replace invalid characters with underscores', () => {
    expect(sanitizeStudentId('AB!@#12')).toBe('AB___12');
  });

  it('should preserve valid characters (A-Z, 0-9, ., _, -)', () => {
    expect(sanitizeStudentId('STU-123.45_6')).toBe('STU-123.45_6');
  });

  it('should handle empty strings', () => {
    expect(sanitizeStudentId('')).toBe('');
  });

  it('should handle strings with only invalid characters', () => {
    expect(sanitizeStudentId('!@#$%')).toBe('_____');
  });
});

describe('generateFacultyId', () => {
  it('generates a faculty ID matching the /^FAC-\\d{6}$/ format', () => {
    const id = generateFacultyId();
    expect(id).toMatch(/^FAC-\d{6}$/);
  });

  it('generates unique random IDs across repeated invocations', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const id = generateFacultyId();
      expect(id).toMatch(/^FAC-\d{6}$/);
      ids.add(id);
    }
    // With 6 random digits (900,000 possibilities), 20 calls should produce diverse IDs
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('parseStudentIdFromEmail', () => {
  it('returns null for null, undefined, empty string, or invalid email format', () => {
    expect(parseStudentIdFromEmail(null)).toBeNull();
    expect(parseStudentIdFromEmail(undefined)).toBeNull();
    expect(parseStudentIdFromEmail('')).toBeNull();
    expect(parseStudentIdFromEmail('@domain.com')).toBeNull();
  });

  describe('STI domain emails (alabang.sti.edu.ph)', () => {
    it('extracts student ID from STI student email with 6+ consecutive digits', () => {
      expect(parseStudentIdFromEmail('delacruz.376536@alabang.sti.edu.ph')).toBe('STU-376536');
      expect(parseStudentIdFromEmail('santos.20230101@alabang.sti.edu.ph')).toBe('STU-20230101');
    });

    it('extracts faculty ID with localpart from STI faculty email without 6 digits', () => {
      expect(parseStudentIdFromEmail('john.doe@alabang.sti.edu.ph')).toBe('FAC-john.doe');
      expect(parseStudentIdFromEmail('maria.clara.12@alabang.sti.edu.ph')).toBe('FAC-maria.clara.12');
    });

    it('generates a random faculty ID if the resulting STI ID contains "___"', () => {
      // Localpart containing "___" triggers generateFacultyId()
      const result = parseStudentIdFromEmail('faculty___test@alabang.sti.edu.ph');
      expect(result).toMatch(/^FAC-\d{6}$/);
    });
  });

  describe('Non-STI domain emails', () => {
    it('extracts student ID if localpart contains 6+ consecutive digits', () => {
      expect(parseStudentIdFromEmail('student.20231234@gmail.com')).toBe('STU-20231234');
      expect(parseStudentIdFromEmail('test.999888@yahoo.com')).toBe('STU-999888');
    });

    it('returns null if localpart does not contain 6+ consecutive digits', () => {
      expect(parseStudentIdFromEmail('personal@gmail.com')).toBeNull();
      expect(parseStudentIdFromEmail('john.doe@outlook.com')).toBeNull();
      expect(parseStudentIdFromEmail('short123@gmail.com')).toBeNull();
    });
  });
});

describe('resolveStudentId', () => {
  it('uses stored studentId with existing STU- prefix intact', () => {
    const result = resolveStudentId({ studentId: 'STU-123456' });
    expect(result).toBe('STU-123456');
  });

  it('uses stored studentId with existing FAC- prefix intact', () => {
    const result = resolveStudentId({ studentId: 'FAC-654321' });
    expect(result).toBe('FAC-654321');
  });

  it('prefixes pure numeric stored studentId with STU-', () => {
    const result = resolveStudentId({ studentId: '376536' });
    expect(result).toBe('STU-376536');
  });

  it('prefixes staff/admin stored studentId with FAC- when role is staff or librarian or super_admin', () => {
    expect(resolveStudentId({ studentId: 'ADMIN01', role: 'super_admin' })).toBe('FAC-ADMIN01');
    expect(resolveStudentId({ studentId: 'LIB001', role: 'librarian' })).toBe('FAC-LIB001');
    expect(resolveStudentId({ studentId: 'STAFF99', role: 'staff' })).toBe('FAC-STAFF99');
  });

  it('falls back to email when studentId is not provided', () => {
    const result = resolveStudentId({
      email: 'delacruz.376536@alabang.sti.edu.ph',
    });
    expect(result).toBe('STU-376536');
  });

  it('falls back to fallbackEmail when studentId and email are missing', () => {
    const result = resolveStudentId({
      fallbackEmail: 'john.doe@alabang.sti.edu.ph',
    });
    expect(result).toBe('FAC-john.doe');
  });

  it('falls back to userId slice when identifiers and emails are absent', () => {
    const result = resolveStudentId({
      userId: '12345678-abcd-ef01-2345-6789abcdef01',
    });
    // First 12 chars: '12345678-abc'
    expect(result).toBe('FAC-12345678-ABC');
  });

  it('generates a random faculty ID if resolved ID contains "___" placeholder', () => {
    const result = resolveStudentId({
      studentId: 'INV!@#ID', // sanitized to INV___ID
    });
    expect(result).toMatch(/^FAC-\d{6}$/);
  });

  it('generates a random faculty ID if resolved ID equals "FAC-___________.______"', () => {
    const result = resolveStudentId({
      studentId: '___________.______',
      role: 'librarian',
    });
    expect(result).toMatch(/^FAC-\d{6}$/);
  });

  it('returns null when no options are provided', () => {
    expect(resolveStudentId({})).toBeNull();
  });
});

describe('Asset URLs and filenames', () => {
  it('generates normalized filenames for QR and profile image', () => {
    const fileNames = fileNamesFor('stu 123');
    expect(fileNames).toEqual({
      qr: 'qr_STU_123.png',
      profile: 'profile_STU_123.webp',
    });
  });

  it('constructs public storage URL for asset files', () => {
    const url = publicObjectUrl('qr_STU-123.png');
    expect(url).toContain(`/storage/v1/object/public/${CARD_ASSET_BUCKET}/qr_STU-123.png`);
  });

  it('throws an error if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(() => publicObjectUrl('test.png')).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL');
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
  });

  it('verifies deterministic profile URL detection', () => {
    expect(
      isDeterministicProfileUrl(
        `https://example.com/storage/v1/object/public/${CARD_ASSET_BUCKET}/profile_STU-123.webp`
      )
    ).toBe(true);
    expect(isDeterministicProfileUrl('https://example.com/custom-avatar.png')).toBe(false);
    expect(isDeterministicProfileUrl(null)).toBe(false);
  });

  it('returns deterministic QR and Profile public URLs', () => {
    const qrUrl = getDeterministicQrUrl('12345');
    const profileUrl = getDeterministicProfileUrl('12345');

    expect(qrUrl).toContain('qr_12345.png');
    expect(profileUrl).toContain('profile_12345.webp');
  });
});
