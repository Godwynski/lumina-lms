import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { safeCompare } from './server-utils';

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('password', 'password')).toBe(true);
    expect(safeCompare('super-secret-token', 'super-secret-token')).toBe(true);
    expect(safeCompare('CRON_SECRET_987654321', 'CRON_SECRET_987654321')).toBe(true);
    expect(safeCompare('bearer-token-with-special-!@#$%^&*()', 'bearer-token-with-special-!@#$%^&*()')).toBe(true);
  });

  it('returns true for identical Unicode strings', () => {
    expect(safeCompare('こんにちは世界', 'こんにちは世界')).toBe(true);
    expect(safeCompare('🔐🔒🔑', '🔐🔒🔑')).toBe(true);
  });

  it('returns false for two different strings of the same length', () => {
    expect(safeCompare('hello', 'world')).toBe(false);
    expect(safeCompare('abcd', 'abce')).toBe(false);
    expect(safeCompare('secret1', 'secret2')).toBe(false);
    expect(safeCompare('1234567890', '1234567891')).toBe(false);
  });

  it('returns false for two strings of differing lengths', () => {
    expect(safeCompare('short', 'longer_string')).toBe(false);
    expect(safeCompare('longer_string', 'short')).toBe(false);
    expect(safeCompare('token', 'token_extra')).toBe(false);
    expect(safeCompare('token_extra', 'token')).toBe(false);
  });

  it('handles empty strings correctly', () => {
    expect(safeCompare('', '')).toBe(true);
    expect(safeCompare('', 'non-empty')).toBe(false);
    expect(safeCompare('non-empty', '')).toBe(false);
  });

  it('returns false for non-string runtime inputs without throwing', () => {
    // Null and undefined checks
    expect(safeCompare(null as unknown as string, 'string')).toBe(false);
    expect(safeCompare('string', null as unknown as string)).toBe(false);
    expect(safeCompare(undefined as unknown as string, 'string')).toBe(false);
    expect(safeCompare('string', undefined as unknown as string)).toBe(false);
    expect(safeCompare(null as unknown as string, null as unknown as string)).toBe(false);
    expect(safeCompare(undefined as unknown as string, undefined as unknown as string)).toBe(false);

    // Number checks
    expect(safeCompare(123 as unknown as string, '123')).toBe(false);
    expect(safeCompare('123', 123 as unknown as string)).toBe(false);
    expect(safeCompare(123 as unknown as string, 123 as unknown as string)).toBe(false);

    // Boolean checks
    expect(safeCompare(true as unknown as string, 'true')).toBe(false);
    expect(safeCompare('true', true as unknown as string)).toBe(false);

    // Object and array checks
    expect(safeCompare({} as unknown as string, '[object Object]')).toBe(false);
    expect(safeCompare([] as unknown as string, '')).toBe(false);

    // Function and Symbol checks
    expect(safeCompare((() => {}) as unknown as string, 'function')).toBe(false);
    expect(safeCompare(Symbol('token') as unknown as string, 'token')).toBe(false);
  });

  it('executes timingSafeEqual to protect timing profiles when lengths differ', () => {
    const timingSafeEqualSpy = vi.spyOn(crypto, 'timingSafeEqual');

    try {
      const result = safeCompare('short', 'much_longer_string');
      expect(result).toBe(false);
      // Even when lengths differ, timingSafeEqual(bufA, bufA) is invoked to mimic timing profile
      expect(timingSafeEqualSpy).toHaveBeenCalled();
    } finally {
      timingSafeEqualSpy.mockRestore();
    }
  });
});
