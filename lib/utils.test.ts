import { describe, it, expect } from 'vitest';
import { sanitizeFilterInput } from './utils';

describe('sanitizeFilterInput', () => {
  it('leaves normal strings intact', () => {
    expect(sanitizeFilterInput('hello world')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(sanitizeFilterInput('  padded  ')).toBe('padded');
  });

  it('removes special characters ( ) , . : \\ * "', () => {
    expect(sanitizeFilterInput('a(b)c,d.e:f\\g*h"i')).toBe('abcdefghi');
  });

  it('handles combination of special characters and whitespace', () => {
    expect(sanitizeFilterInput('  (test, string): with* "all" \\ chars.  ')).toBe(
      'test string with all  chars'
    );
  });

  it('handles empty strings', () => {
    expect(sanitizeFilterInput('')).toBe('');
  });

  it('handles strings with only special characters', () => {
    expect(sanitizeFilterInput('(),.:\\*"')).toBe('');
  });
});
