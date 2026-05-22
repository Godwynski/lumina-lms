import { describe, it, expect } from 'vitest';
import { safeCompare } from './server-utils';

describe('safeCompare', () => {
  it('returns true for two identical strings', () => {
    expect(safeCompare('password', 'password')).toBe(true);
    expect(safeCompare('super-secret-token', 'super-secret-token')).toBe(true);
  });

  it('returns false for two different strings of the same length', () => {
    expect(safeCompare('hello', 'world')).toBe(false);
    expect(safeCompare('abcd', 'abce')).toBe(false);
  });

  it('returns false for two strings of different lengths', () => {
    expect(safeCompare('short', 'longer_string')).toBe(false);
    expect(safeCompare('longer_string', 'short')).toBe(false);
  });

  it('handles empty strings correctly', () => {
    expect(safeCompare('', '')).toBe(true);
    expect(safeCompare('', 'non-empty')).toBe(false);
    expect(safeCompare('non-empty', '')).toBe(false);
  });

  it('returns false when inputs are not strings', () => {
    // We need to bypass TypeScript for these tests as the function signature requires strings
    // but we want to test the runtime type checks
    expect(safeCompare(null as unknown as string, 'string')).toBe(false);
    expect(safeCompare('string', null as unknown as string)).toBe(false);
    expect(safeCompare(undefined as unknown as string, 'string')).toBe(false);
    expect(safeCompare('string', undefined as unknown as string)).toBe(false);
    expect(safeCompare(123 as unknown as string, '123')).toBe(false);
    expect(safeCompare('123', 123 as unknown as string)).toBe(false);
    expect(safeCompare({} as unknown as string, '[object Object]')).toBe(false);
  });
});
