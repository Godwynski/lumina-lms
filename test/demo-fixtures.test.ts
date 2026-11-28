import { describe, expect, it } from 'vitest';
import { buildDemoFixtures } from '@/lib/demo/fixtures';

describe('demo seed fixtures', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  const ids = { patron: 'patron', librarian: 'librarian', borrower: 'borrower' };
  const fixture = buildDemoFixtures(ids, now);

  it('uses stable identifiers and creates sufficient catalog and activity for reports', () => {
    const next = buildDemoFixtures(ids, new Date('2026-11-29T12:00:00Z'));
    expect(fixture.books.length).toBe(144);
    expect(fixture.copies.length).toBe(432);
    expect(fixture.attendance.length).toBe(180);
    expect(fixture.loans.length).toBe(120);
    expect(next.loans.map(row => row.id)).toEqual(fixture.loans.map(row => row.id));
  });

  it('keeps loan and reservation states consistent with physical copies', () => {
    const copies = new Map(fixture.copies.map(copy => [copy.id, copy]));
    for (const loan of fixture.loans) {
      expect(loan.user_id).toBe(loan.returned_at ? ids.patron : ids.borrower);
      expect(loan.borrowed_at <= loan.due_date).toBe(true);
      expect(copies.get(loan.book_copy_id)?.status).toBe(loan.returned_at ? 'AVAILABLE' : 'BORROWED');
    }
    for (const reservation of fixture.reservations) {
      const copy = copies.get(reservation.copy_id ?? '');
      if (reservation.status === 'READY') {
        expect(copy).toMatchObject({ status: 'RESERVED', book_id: reservation.book_id });
      } else {
        expect(fixture.copies.filter(row => row.book_id === reservation.book_id).every(row => row.status === 'BORROWED')).toBe(true);
      }
    }
    expect(fixture.loans.some(loan => loan.status === 'OVERDUE' && loan.fine_amount > 0)).toBe(true);
    expect(fixture.loans.some(loan => loan.fine_resolution === 'PAID')).toBe(true);
    expect(fixture.loans.some(loan => loan.fine_resolution === 'CONDONED')).toBe(true);
  });
});
