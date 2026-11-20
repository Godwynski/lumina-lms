import { describe, expect, it } from 'vitest';
import { isWithinManilaDateRange } from '@/lib/date-range';

describe('isWithinManilaDateRange', () => {
  it('passes everything when no bounds are set', () => {
    expect(isWithinManilaDateRange('2026-11-14T08:30:00Z', '', '')).toBe(true);
    expect(isWithinManilaDateRange(null, '', '')).toBe(true);
  });

  it('compares the Manila calendar date, inclusive on both ends', () => {
    // 2026-11-13T17:00Z is 2026-11-14 01:00 in Manila
    expect(isWithinManilaDateRange('2026-11-13T17:00:00Z', '2026-11-14', '2026-11-14')).toBe(true);
    expect(isWithinManilaDateRange('2026-11-13T15:59:00Z', '2026-11-14', '')).toBe(false);
    expect(isWithinManilaDateRange('2026-11-14T15:59:00Z', '', '2026-11-14')).toBe(true);
    expect(isWithinManilaDateRange('2026-11-14T16:00:00Z', '', '2026-11-14')).toBe(false);
  });

  it('rejects missing or invalid timestamps once a bound is set', () => {
    expect(isWithinManilaDateRange(null, '2026-01-01', '')).toBe(false);
    expect(isWithinManilaDateRange('not-a-date', '', '2026-01-01')).toBe(false);
  });
});
