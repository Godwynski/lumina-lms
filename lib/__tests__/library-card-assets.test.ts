import { describe, it, expect } from 'vitest';
import { sanitizeStudentId } from '../library-card-assets';

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
