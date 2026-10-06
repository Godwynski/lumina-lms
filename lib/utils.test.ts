import { describe, it, expect } from 'vitest';
import { sanitizeFilterInput, cn, hasEnvVars, toSlug, formatDisplayDate, formatDisplayTime } from './utils';

describe('sanitizeFilterInput', () => {
  it('leaves normal strings intact', () => {
    expect(sanitizeFilterInput('Harry Potter')).toBe('Harry Potter');
    expect(sanitizeFilterInput('Computer Science 101')).toBe('Computer Science 101');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilterInput('  clean string  ')).toBe('clean string');
    expect(sanitizeFilterInput('\t\n  spaced text \n\t')).toBe('spaced text');
  });

  it('preserves internal whitespace', () => {
    expect(sanitizeFilterInput('a   b    c')).toBe('a   b    c');
  });

  it('removes each special character individually: ( ) , . : \\ * "', () => {
    expect(sanitizeFilterInput('(')).toBe('');
    expect(sanitizeFilterInput(')')).toBe('');
    expect(sanitizeFilterInput(',')).toBe('');
    expect(sanitizeFilterInput('.')).toBe('');
    expect(sanitizeFilterInput(':')).toBe('');
    expect(sanitizeFilterInput('*')).toBe('');
    expect(sanitizeFilterInput('\\')).toBe('');
    expect(sanitizeFilterInput('"')).toBe('');
  });

  it('removes all stripped special characters combined in sequence', () => {
    expect(sanitizeFilterInput('(),.:\\*"')).toBe('');
    expect(sanitizeFilterInput('"""***...:::,,,((()))\\\\\\')).toBe('');
  });

  it('removes interleaved special characters across words', () => {
    expect(sanitizeFilterInput('a(b)c,d.e:f\\g*h"i')).toBe('abcdefghi');
    expect(sanitizeFilterInput('  (test, string): with* "all" \\ chars.  ')).toBe(
      'test string with all  chars'
    );
  });

  it('neutralizes PostgREST filter breakout attempts', () => {
    // Attempting to inject new column predicates: "test,title.eq.secret"
    expect(sanitizeFilterInput('test,title.eq.secret')).toBe('testtitleeqsecret');

    // Attempting logical clause breakout: ") or (admin_id.eq.null"
    expect(sanitizeFilterInput(') or (admin_id.eq.null')).toBe('or admin_ideqnull');

    // Attempting quoted identifier breakout: 'book" or 1=1 --'
    expect(sanitizeFilterInput('book" or 1=1 --')).toBe('book or 1=1 --');

    // Attempting embedded resource / JSON traversal breakout: "user:id.eq.1"
    expect(sanitizeFilterInput('user:id.eq.1')).toBe('userideq1');
  });

  it('preserves SQL wildcard characters (% and _) by design', () => {
    expect(sanitizeFilterInput('%test_value%')).toBe('%test_value%');
    expect(sanitizeFilterInput('user_%_pattern')).toBe('user_%_pattern');
    expect(sanitizeFilterInput('  %leading_and_trailing%  ')).toBe('%leading_and_trailing%');
  });

  it('handles empty and whitespace-only strings gracefully', () => {
    expect(sanitizeFilterInput('')).toBe('');
    expect(sanitizeFilterInput(' ')).toBe('');
    expect(sanitizeFilterInput('     ')).toBe('');
    expect(sanitizeFilterInput('\n\t\r')).toBe('');
  });

  it('handles Unicode and international characters correctly', () => {
    expect(sanitizeFilterInput('日本語 (Book) : 1')).toBe('日本語 Book  1');
    expect(sanitizeFilterInput('El Niño (Edición: Especial)')).toBe('El Niño Edición Especial');
    expect(sanitizeFilterInput('Книга: "Война и мир"')).toBe('Книга Война и мир');
  });
});

describe('cn (class name merger)', () => {
  it('combines class names correctly', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('handles conditional class names', () => {
    const isTrue = true;
    const isFalse = false;
    expect(cn('base-class', isTrue && 'active-class', isFalse && 'inactive-class')).toBe(
      'base-class active-class'
    );
  });

  it('resolves conflicting Tailwind utility classes using tailwind-merge', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('mt-2', 'mt-4', 'mt-1')).toBe('mt-1');
  });

  it('handles falsy values, null, undefined, and empty strings cleanly', () => {
    expect(cn('class-1', null, undefined, '', false)).toBe('class-1');
  });

  it('handles arrays and nested class lists', () => {
    expect(cn(['foo', 'bar'], ['baz'])).toBe('foo bar baz');
    expect(cn({ active: true, disabled: false })).toBe('active');
  });
});

describe('hasEnvVars', () => {
  it('evaluates environment variables presence', () => {
    // In hermetic test setup (test/setup.ts), Supabase env vars are populated
    expect(Boolean(hasEnvVars)).toBe(true);
  });
});

describe('toSlug', () => {
  it('converts titles to lowercase hyphenated slugs', () => {
    expect(toSlug('Computer Science & AI')).toBe('computer-science-ai');
    expect(toSlug('  The Great Gatsby!  ')).toBe('the-great-gatsby');
  });

  it('strips leading and trailing hyphens', () => {
    expect(toSlug('---hello world---')).toBe('hello-world');
  });
});

describe('formatDisplayDate', () => {
  it('formats ISO strings into readable US dates', () => {
    expect(formatDisplayDate('2026-10-06T12:00:00Z')).toBe('Oct 6, 2026');
  });

  it('returns fallback dash for null, undefined, or invalid dates', () => {
    expect(formatDisplayDate(null)).toBe('—');
    expect(formatDisplayDate(undefined)).toBe('—');
    expect(formatDisplayDate('invalid-date')).toBe('—');
  });
});

describe('formatDisplayTime', () => {
  it('formats dates into localized time', () => {
    const formatted = formatDisplayTime('2026-10-06T12:00:00Z', 'UTC');
    expect(formatted).toMatch(/12:00\s*PM/i);
  });

  it('returns fallback dash for invalid dates', () => {
    expect(formatDisplayTime(null)).toBe('—');
    expect(formatDisplayTime('bad')).toBe('—');
  });
});

