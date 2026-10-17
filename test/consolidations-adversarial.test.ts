import { describe, it, expect } from 'vitest';
import { toSlug, getCategoryName } from '@/lib/utils';

describe('Empirical Adversarial Test Suite: toSlug & getCategoryName', () => {
  describe('toSlug Boundary & Stress Testing', () => {
    it('handles empty and whitespace-only strings', () => {
      expect(toSlug('')).toBe('');
      expect(toSlug(' ')).toBe('');
      expect(toSlug('       ')).toBe('');
      expect(toSlug('\t\n\r\f\v')).toBe('');
      expect(toSlug('  \n\t  ')).toBe('');
    });

    it('handles single character boundaries', () => {
      expect(toSlug('a')).toBe('a');
      expect(toSlug('Z')).toBe('z');
      expect(toSlug('0')).toBe('0');
      expect(toSlug('9')).toBe('9');
      expect(toSlug('-')).toBe('');
      expect(toSlug('_')).toBe('');
      expect(toSlug('.')).toBe('');
      expect(toSlug(' ')).toBe('');
    });

    it('handles repetitive and consecutive hyphens and spaces', () => {
      expect(toSlug('---')).toBe('');
      expect(toSlug('------foo------')).toBe('foo');
      expect(toSlug('foo------bar')).toBe('foo-bar');
      expect(toSlug('- - - -')).toBe('');
      expect(toSlug('  ---  ---  ')).toBe('');
      expect(toSlug('a - - - b')).toBe('a-b');
      expect(toSlug('a   b   c')).toBe('a-b-c');
    });

    it('strips all ASCII punctuation and special characters', () => {
      expect(toSlug('!@#$%^&*()_+={}[]|\\:;"\'<>,.?/~`')).toBe('');
      expect(toSlug('!Important: Notice & Updates (2026)?')).toBe('important-notice-updates-2026');
      expect(toSlug('C++ & C# Development')).toBe('c-c-development');
      expect(toSlug('user_name_test')).toBe('user-name-test');
      expect(toSlug('cost: $100.00 / item!')).toBe('cost-100-00-item');
    });

    it('handles alphanumeric boundaries and version numbers', () => {
      expect(toSlug('Web 3.0 & IPv6 Protocol')).toBe('web-3-0-ipv6-protocol');
      expect(toSlug('12345')).toBe('12345');
      expect(toSlug('000-111-222')).toBe('000-111-222');
      expect(toSlug('---999---')).toBe('999');
    });

    it('handles Unicode, accents, non-Latin scripts, and emojis', () => {
      // Accented Latin characters get converted to hyphens because [^a-z0-9] matches non-ASCII
      expect(toSlug('Café & Résumé')).toBe('caf-r-sum');
      expect(toSlug('München')).toBe('m-nchen');
      expect(toSlug('El Niño')).toBe('el-ni-o');

      // Non-Latin alphabets without transliteration evaluate to empty strings
      expect(toSlug('日本語')).toBe('');
      expect(toSlug('计算机科学')).toBe('');
      expect(toSlug('Война и мир')).toBe('');
      expect(toSlug('كتاب')).toBe('');

      // Emojis are non-alphanumeric and are stripped
      expect(toSlug('📚 Books & 💻 Tech')).toBe('books-tech');
      expect(toSlug('🚀✨🎉')).toBe('');
    });

    it('handles extremely long inputs without performance degradation or crash', () => {
      const longInput = 'A'.repeat(5000) + ' & ' + 'B'.repeat(5000);
      const start = performance.now();
      const result = toSlug(longInput);
      const elapsed = performance.now() - start;

      expect(result).toBe('a'.repeat(5000) + '-' + 'b'.repeat(5000));
      expect(elapsed).toBeLessThan(100);
    });

    it('throws TypeError when invoked with non-string inputs at runtime', () => {
      // TypeScript typing is `value: string`, but adversarial runtime callers may pass null/undefined
      expect(() => (toSlug as unknown as (v: unknown) => string)(null)).toThrow(TypeError);
      expect(() => (toSlug as unknown as (v: unknown) => string)(undefined)).toThrow(TypeError);
      expect(() => (toSlug as unknown as (v: unknown) => string)(123 as unknown)).toThrow(TypeError);
    });
  });

  describe('getCategoryName Boundary & Stress Testing', () => {
    it('handles normal array shapes and takes first element', () => {
      expect(getCategoryName([{ name: 'Computer Science' }])).toBe('Computer Science');
      expect(getCategoryName([{ name: 'Fiction' }, { name: 'Drama' }])).toBe('Fiction');
      expect(getCategoryName([{ name: 'Mathematics', id: 'cat-1' }])).toBe('Mathematics');
    });

    it('handles single object shapes', () => {
      expect(getCategoryName({ name: 'Science' })).toBe('Science');
      expect(getCategoryName({ name: 'History', id: 'cat-2' })).toBe('History');
    });

    it('returns Uncategorized for empty array or array with empty/missing properties', () => {
      expect(getCategoryName([])).toBe('Uncategorized');
      expect(getCategoryName([{}])).toBe('Uncategorized');
      expect(getCategoryName([{ name: '' }])).toBe('Uncategorized');
      expect(getCategoryName([{ name: null }])).toBe('Uncategorized');
      expect(getCategoryName([{ name: undefined }])).toBe('Uncategorized');
      expect(getCategoryName([{ otherProp: 'value' }])).toBe('Uncategorized');
    });

    it('handles sparse and corrupted arrays', () => {
      expect(getCategoryName([null])).toBe('Uncategorized');
      expect(getCategoryName([undefined])).toBe('Uncategorized');
      expect(getCategoryName([123])).toBe('Uncategorized');
      expect(getCategoryName(['string-entry'])).toBe('Uncategorized');
      expect(getCategoryName([false])).toBe('Uncategorized');
      expect(getCategoryName([null, { name: 'Valid' }])).toBe('Uncategorized'); // First element is null
    });

    it('returns Uncategorized for null and undefined inputs', () => {
      expect(getCategoryName(null)).toBe('Uncategorized');
      expect(getCategoryName(undefined)).toBe('Uncategorized');
    });

    it('returns Uncategorized for primitive types', () => {
      expect(getCategoryName(0)).toBe('Uncategorized');
      expect(getCategoryName(100)).toBe('Uncategorized');
      expect(getCategoryName(-1)).toBe('Uncategorized');
      expect(getCategoryName(NaN)).toBe('Uncategorized');
      expect(getCategoryName(Infinity)).toBe('Uncategorized');
      expect(getCategoryName(true)).toBe('Uncategorized');
      expect(getCategoryName(false)).toBe('Uncategorized');
      expect(getCategoryName('')).toBe('Uncategorized');
      expect(getCategoryName('Random String')).toBe('Uncategorized');
      expect(getCategoryName(Symbol('test'))).toBe('Uncategorized');
    });

    it('handles exotic object shapes and prototype pollution resistance', () => {
      expect(getCategoryName({})).toBe('Uncategorized');
      expect(getCategoryName({ otherField: 'test' })).toBe('Uncategorized');
      expect(getCategoryName(Object.create(null))).toBe('Uncategorized');
      
      const objWithoutProtoWithName = Object.create(null);
      objWithoutProtoWithName.name = 'Prototype-Free';
      expect(getCategoryName(objWithoutProtoWithName)).toBe('Prototype-Free');

      expect(getCategoryName(new Date())).toBe('Uncategorized');
      expect(getCategoryName(/regex/)).toBe('Uncategorized');
      expect(getCategoryName(() => {})).toBe('Uncategorized');
    });

    it('handles falsy name values inside objects', () => {
      expect(getCategoryName({ name: '' })).toBe('Uncategorized');
      expect(getCategoryName({ name: null })).toBe('Uncategorized');
      expect(getCategoryName({ name: undefined })).toBe('Uncategorized');
      expect(getCategoryName({ name: false })).toBe('Uncategorized');
      expect(getCategoryName({ name: 0 })).toBe('Uncategorized');
      expect(getCategoryName({ name: NaN })).toBe('Uncategorized');
    });

    it('handles nested arrays and deep structures gracefully', () => {
      expect(getCategoryName([[{ name: 'Nested' }]])).toBe('Uncategorized');
      expect(getCategoryName({ name: { nested: 'Deep' } })).toEqual({ nested: 'Deep' }); // returns truthy object as name if non-string
    });
  });
});
