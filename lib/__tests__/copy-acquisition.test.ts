import { expect, it } from 'vitest';
import { copyAcquisitionSchema, copyDispositionSchema, hasCopyAcquisition, libraryDate } from '@/lib/copy-acquisition';

it('keeps blank values distinct from a zero purchase price', () => {
  const empty = { method: null, acquiredOn: null, purchasePrice: null };
  const bought = { method: 'PURCHASED' as const, acquiredOn: '2024-02-29', purchasePrice: '0' };
  expect(hasCopyAcquisition(copyAcquisitionSchema.parse(empty))).toBe(false);
  expect(hasCopyAcquisition(copyAcquisitionSchema.parse(bought))).toBe(true);
  expect(copyAcquisitionSchema.parse(bought)).toEqual(bought);
});

it.each([
  { method: 'DONATED', acquiredOn: '2024-02-29', purchasePrice: '1' },
  { method: 'PURCHASED', acquiredOn: '2023-02-29', purchasePrice: null },
  { method: 'PURCHASED', acquiredOn: null, purchasePrice: '10000000000' },
  { method: 'PURCHASED', acquiredOn: null, purchasePrice: '1.001' },
  { method: 'PURCHASED', acquiredOn: null, purchasePrice: '-1' },
  { method: 'PURCHASED', acquiredOn: '9999-12-31', purchasePrice: null },
  { method: 'PURCHASED', acquiredOn: '0000-01-01', purchasePrice: null },
])('rejects invalid acquisition details %j', input => {
  expect(copyAcquisitionSchema.safeParse(input).success).toBe(false);
});

it('requires a date and sale amount only for the corresponding change', () => {
  const change = { id: '00000000-0000-4000-8000-000000000001', occurredOn: '2024-02-29' };
  expect(copyDispositionSchema.safeParse({ ...change, status: 'SOLD', saleAmount: '0' }).success).toBe(true);
  expect(copyDispositionSchema.safeParse({ ...change, status: 'SOLD' }).success).toBe(false);
  expect(copyDispositionSchema.safeParse({ ...change, status: 'LOST', saleAmount: '20' }).success).toBe(false);
  expect(copyDispositionSchema.safeParse({ ...change, status: 'LOST', occurredOn: '' }).success).toBe(false);
  expect(libraryDate(new Date('2026-11-19T16:00:00Z'))).toBe('2026-11-20');
});
