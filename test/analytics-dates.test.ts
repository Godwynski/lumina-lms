import { expect, it } from 'vitest';
import { analyticsDates, validateDates } from '@/lib/analytics-dates';
it('uses Manila dates at a UTC day boundary', () => {
  expect(analyticsDates('7d', new Date('2026-11-12T17:00:00Z'))).toEqual({ from: '2026-11-07', to: '2026-11-13' });
});
it('accepts a single day and rejects invalid or reversed dates', () => {
  expect(validateDates({ from: '2026-11-13', to: '2026-11-13' })).toBe(true);
  expect(validateDates({ from: '2026-02-30', to: '2026-03-01' })).toBe(false);
  expect(validateDates({ from: '2026-11-14', to: '2026-11-13' })).toBe(false);
});

it('keeps the yearly preset within the supported twelve calendar months', () => {
  const dates = analyticsDates('1y', new Date('2026-11-13T00:00:00Z'));
  expect(dates).toEqual({ from: '2025-12-01', to: '2026-11-13' });
  expect(validateDates(dates)).toBe(true);
});
