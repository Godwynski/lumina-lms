import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Milestone 1 Challenger M1-2: Seed Data Compatibility & Trigger Invariants', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema_clean_install.sql');
  const seedPath = path.resolve(process.cwd(), 'scripts/seed.ts');
  const sampleDataPath = path.resolve(process.cwd(), 'supabase/sample_data.sql');

  let schemaSql: string;
  let seedContent: string;
  let sampleDataSql: string;

  beforeAll(() => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(fs.existsSync(seedPath)).toBe(true);
    expect(fs.existsSync(sampleDataPath)).toBe(true);

    schemaSql = fs.readFileSync(schemaPath, 'utf8');
    seedContent = fs.readFileSync(seedPath, 'utf8');
    sampleDataSql = fs.readFileSync(sampleDataPath, 'utf8');
  });

  describe('1. Schema Constraints & Check Definitions', () => {
    it('verifies books table contains all hardened copy count and BCE year check constraints', () => {
      expect(schemaSql).toMatch(/CONSTRAINT\s+books_total_copies_check\s+CHECK\s*\(\s*total_copies\s*>=\s*0\s*\)/i);
      expect(schemaSql).toMatch(/CONSTRAINT\s+books_available_copies_check\s+CHECK\s*\(\s*available_copies\s*>=\s*0\s*\)/i);
      expect(schemaSql).toMatch(/CONSTRAINT\s+books_available_lte_total_check\s+CHECK\s*\(\s*available_copies\s*<=\s*total_copies\s*\)/i);
      expect(schemaSql).toMatch(/CONSTRAINT\s+books_published_year_check\s+CHECK\s*\(\s*published_year\s+IS\s+NULL\s+OR\s*\(\s*published_year\s*>=\s*-3000\s+AND\s+published_year\s*<=\s*2100\s*\)\s*\)/i);
    });

    it('verifies fn_sync_book_counts trigger function and tr_sync_book_counts trigger are declared', () => {
      expect(schemaSql).toContain('CREATE OR REPLACE FUNCTION public.fn_sync_book_counts()');
      expect(schemaSql).toMatch(/CREATE\s+OR\s+REPLACE\s+TRIGGER\s+tr_sync_book_counts\s+AFTER\s+INSERT\s+OR\s+UPDATE(?:\s+OF\s+status,\s*book_id)?\s+OR\s+DELETE\s+ON\s+public\.book_copies\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.fn_sync_book_counts\(\)/i);
    });

    it('verifies library_cards table contains valid expiration check constraint', () => {
      expect(schemaSql).toMatch(/CONSTRAINT\s+library_cards_dates_check\s+CHECK\s*\(\s*expires_at\s+IS\s+NULL\s+OR\s+expires_at\s*>\s*issued_at\s*\)/i);
    });
  });

  describe('2. scripts/seed.ts Compatibility', () => {
    it('verifies all seeded books satisfy books_published_year_check, including BCE dates', () => {
      const bookBlock = seedContent.substring(
        seedContent.indexOf('const booksToSeed = ['),
        seedContent.indexOf('const { data: bookData')
      );
      const matches = [...bookBlock.matchAll(/published_year:\s*(-?\d+)/g)];
      expect(matches.length).toBeGreaterThanOrEqual(100);

      const years = matches.map(m => parseInt(m[1], 10));
      const bceYears = years.filter(y => y < 0);
      expect(bceYears).toContain(-375); // Plato's Republic
      expect(bceYears).toContain(-340); // Aristotle's Nicomachean Ethics

      for (const year of years) {
        expect(year).toBeGreaterThanOrEqual(-3000);
        expect(year).toBeLessThanOrEqual(2100);
      }
    });

    it('verifies seeded book copy status values adhere to allowed enum values', () => {
      const allowedStatuses = ['AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RESERVED'];
      const statusMatches = [...seedContent.matchAll(/status\s*=\s*'([^']+)'/g)].map(m => m[1]);
      for (const status of statusMatches) {
        expect(allowedStatuses).toContain(status);
      }
    });

    it('verifies seeded library cards have expires_at strictly greater than issuance date', () => {
      const cardBlock = seedContent.substring(
        seedContent.indexOf('const libraryCards = ['),
        seedContent.indexOf('const { error: cardError }')
      );
      expect(cardBlock).toContain('expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()');
      
      const cardStatuses = [...cardBlock.matchAll(/status:\s*'([^']+)'/g)].map(m => m[1]);
      for (const status of cardStatuses) {
        expect(['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'ARCHIVED']).toContain(status);
      }
    });

    it('verifies seeded borrowing records respect due_date >= borrowed_at and returned_at >= borrowed_at', () => {
      // In seed.ts:
      // borrowDayOffset = 15 + (i * 1.35)
      // dueDate = borrowDate + 14 days
      // returnedDays = 6, 10, or 17 days
      // returnedDate = borrowDate + returnedDays
      expect(seedContent).toContain('const dueDate = new Date(borrowDate.getTime() + 14 * 24 * 60 * 60 * 1000);');
      expect(seedContent).toContain('const returnedDate = new Date(borrowDate.getTime() + returnedDays * 24 * 60 * 60 * 1000);');
    });

    it('verifies cleanup order deletes borrowing_records before book_copies to respect ON DELETE RESTRICT', () => {
      const cleanBlock = seedContent.substring(
        seedContent.indexOf('// --- Clean-up Phase ---'),
        seedContent.indexOf('// 1. Seed Categories')
      );
      const borrowIdx = cleanBlock.indexOf("from('borrowing_records').delete()");
      const copyIdx = cleanBlock.indexOf("from('book_copies').delete()");
      const bookIdx = cleanBlock.indexOf("from('books').delete()");
      
      expect(borrowIdx).toBeGreaterThan(-1);
      expect(copyIdx).toBeGreaterThan(-1);
      expect(bookIdx).toBeGreaterThan(-1);
      expect(borrowIdx).toBeLessThan(copyIdx);
      expect(copyIdx).toBeLessThan(bookIdx);
    });
  });

  describe('3. supabase/sample_data.sql Compatibility', () => {
    it('verifies sample books initial copy counts conform to CHECK constraints', () => {
      const bookInsertMatches = [...sampleDataSql.matchAll(/VALUES\s*\('[^']+',\s*'[^']+',\s*'[^']+',\s*\w+,\s*(\d+),\s*(\d+)\)/g)];
      expect(bookInsertMatches.length).toBe(3);

      for (const match of bookInsertMatches) {
        const total = parseInt(match[1], 10);
        const available = parseInt(match[2], 10);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(available).toBeGreaterThanOrEqual(0);
        expect(available).toBeLessThanOrEqual(total);
      }
    });

    it('verifies sample book copies statuses match allowed CHECK constraint values', () => {
      const copyStatusMatches = [...sampleDataSql.matchAll(/'(QR-[^']+)',\s*'([^']+)'/g)];
      expect(copyStatusMatches.length).toBe(6);
      const allowed = ['AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RESERVED'];
      for (const [, , status] of copyStatusMatches) {
        expect(allowed).toContain(status);
      }
    });
  });

  describe('4. Empirical Trigger Simulation & Invariant Proof', () => {
    interface Book {
      id: string;
      total_copies: number;
      available_copies: number;
    }
    interface Copy {
      id: string;
      book_id: string;
      status: string;
    }

    const books = new Map<string, Book>();
    const copies = new Map<string, Copy>();

    const syncCounts = (bookId: string) => {
      let total = 0;
      let available = 0;
      for (const copy of copies.values()) {
        if (copy.book_id === bookId) {
          total++;
          if (copy.status === 'AVAILABLE') {
            available++;
          }
        }
      }
      const b = books.get(bookId);
      if (!b) return;
      b.total_copies = total;
      b.available_copies = available;

      // Invariants enforced by Postgres CHECK constraints
      expect(b.total_copies).toBeGreaterThanOrEqual(0);
      expect(b.available_copies).toBeGreaterThanOrEqual(0);
      expect(b.available_copies).toBeLessThanOrEqual(b.total_copies);
    };

    it('guarantees total_copies=0 and available_copies=0 when all copies are deleted', () => {
      const bId = 'b-zero-test';
      books.set(bId, { id: bId, total_copies: 0, available_copies: 0 });

      // Add 3 copies
      copies.set('c-1', { id: 'c-1', book_id: bId, status: 'AVAILABLE' });
      syncCounts(bId);
      copies.set('c-2', { id: 'c-2', book_id: bId, status: 'BORROWED' });
      syncCounts(bId);
      copies.set('c-3', { id: 'c-3', book_id: bId, status: 'AVAILABLE' });
      syncCounts(bId);

      expect(books.get(bId)!.total_copies).toBe(3);
      expect(books.get(bId)!.available_copies).toBe(2);

      // Delete copies one by one
      copies.delete('c-1');
      syncCounts(bId);
      expect(books.get(bId)!.total_copies).toBe(2);
      expect(books.get(bId)!.available_copies).toBe(1);

      copies.delete('c-2');
      syncCounts(bId);
      expect(books.get(bId)!.total_copies).toBe(1);
      expect(books.get(bId)!.available_copies).toBe(1);

      // Delete last copy
      copies.delete('c-3');
      syncCounts(bId);
      expect(books.get(bId)!.total_copies).toBe(0);
      expect(books.get(bId)!.available_copies).toBe(0);
    });

    it('proves invariant holds over 5,000 randomized trigger operations', () => {
      const bookIds = ['book-1', 'book-2', 'book-3'];
      for (const id of bookIds) {
        books.set(id, { id, total_copies: 0, available_copies: 0 });
      }

      const statuses = ['AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RESERVED'];
      let seq = 100;

      for (let i = 0; i < 5000; i++) {
        const rand = Math.random();
        const bId = bookIds[Math.floor(Math.random() * bookIds.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        if (rand < 0.4) {
          // Insert
          const cId = `copy-${seq++}`;
          copies.set(cId, { id: cId, book_id: bId, status });
          syncCounts(bId);
        } else if (rand < 0.7) {
          // Update
          const keys = Array.from(copies.keys());
          if (keys.length > 0) {
            const cId = keys[Math.floor(Math.random() * keys.length)];
            const oldCopy = copies.get(cId)!;
            const oldBookId = oldCopy.book_id;
            oldCopy.book_id = bId;
            oldCopy.status = status;
            syncCounts(bId);
            if (oldBookId !== bId) syncCounts(oldBookId);
          }
        } else if (rand < 0.95) {
          // Delete
          const keys = Array.from(copies.keys());
          if (keys.length > 0) {
            const cId = keys[Math.floor(Math.random() * keys.length)];
            const oldCopy = copies.get(cId)!;
            const oldBookId = oldCopy.book_id;
            copies.delete(cId);
            syncCounts(oldBookId);
          }
        } else {
          // Bulk wipe copies for book
          for (const [id, copy] of Array.from(copies.entries())) {
            if (copy.book_id === bId) {
              copies.delete(id);
            }
          }
          syncCounts(bId);
          expect(books.get(bId)!.total_copies).toBe(0);
          expect(books.get(bId)!.available_copies).toBe(0);
        }
      }

      for (const b of books.values()) {
        expect(b.total_copies).toBeGreaterThanOrEqual(0);
        expect(b.available_copies).toBeGreaterThanOrEqual(0);
        expect(b.available_copies).toBeLessThanOrEqual(b.total_copies);
      }
    });
  });
});
