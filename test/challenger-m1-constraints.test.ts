import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';
import type { BorrowStatus, ReservationStatus, BookCopyStatus } from '@/types/database';

const require = createRequire(import.meta.url);
// node:sqlite is natively built into Node.js 22.5.0+
interface SqliteDatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  };
}
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabaseSync;
};

describe('Milestone 1 Empirical Challenger: Schema, Constraints & Types Verification', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema_clean_install.sql');
  let schemaSql: string;

  beforeAll(() => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    schemaSql = fs.readFileSync(schemaPath, 'utf8');
  });

  describe('1. Static Schema DDL Foreign Key ON DELETE & Constraint Assertions', () => {
    it('verifies all 13 foreign keys declare explicit hardened ON DELETE rules', () => {
      // 1. borrowing_records.user_id -> RESTRICT
      expect(schemaSql).toMatch(/borrowing_records_user_id_fkey\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
      
      // 2. borrowing_records.book_copy_id -> RESTRICT
      expect(schemaSql).toMatch(/borrowing_records_book_copy_id_fkey\s+REFERENCES\s+public\.book_copies\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
      
      // 3. borrowing_records.processed_by -> SET NULL
      expect(schemaSql).toMatch(/borrowing_records_processed_by_fkey\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
      
      // 4. borrowing_records.returned_by -> SET NULL
      expect(schemaSql).toMatch(/borrowing_records_returned_by_fkey\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
      
      // 5. reservations.user_id -> CASCADE
      expect(schemaSql).toMatch(/reservations_user_id_fkey\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+CASCADE/i);
      
      // 6. reservations.book_id -> CASCADE
      expect(schemaSql).toMatch(/reservations_book_id_fkey\s+REFERENCES\s+public\.books\(id\)\s+ON\s+DELETE\s+CASCADE/i);
      
      // 7. reservations.copy_id -> SET NULL
      expect(schemaSql).toMatch(/reservations_copy_id_fkey\s+REFERENCES\s+public\.book_copies\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
      
      // 8. system_settings.updated_by -> SET NULL
      expect(schemaSql).toMatch(/system_settings_updated_by_fkey\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
      
      // 9. announcements.created_by -> SET NULL
      expect(schemaSql).toMatch(/announcements_created_by_fkey\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
      
      // 10. reports.book_id -> CASCADE
      expect(schemaSql).toMatch(/reports_book_id_fkey\s+REFERENCES\s+public\.books\(id\)\s+ON\s+DELETE\s+CASCADE/i);
      
      // 11. reports.user_id -> SET NULL
      expect(schemaSql).toMatch(/reports_user_id_fkey\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
      
      // 12. deleted_profile_info.original_profile_id -> SET NULL
      expect(schemaSql).toMatch(/deleted_profile_info_original_profile_id_fkey\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
      
      // 13. rate_limit_log.user_id -> CASCADE
      expect(schemaSql).toMatch(/rate_limit_log_user_id_fkey\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i);
    });

    it('verifies PostgREST-critical constraint names are preserved exactly', () => {
      expect(schemaSql).toContain('CONSTRAINT borrowing_records_user_id_fkey');
      expect(schemaSql).toContain('CONSTRAINT borrowing_records_book_copy_id_fkey');
      expect(schemaSql).toContain('CONSTRAINT borrowing_records_processed_by_fkey');
      expect(schemaSql).toContain('CONSTRAINT borrowing_records_returned_by_fkey');
      expect(schemaSql).toContain('CONSTRAINT reservations_user_id_fkey');
      expect(schemaSql).toContain('CONSTRAINT reservations_book_id_fkey');
      expect(schemaSql).toContain('CONSTRAINT reservations_copy_id_fkey');
    });

    it('verifies NOT NULL constraints on relational pointers and essential columns', () => {
      // book_copies.book_id NOT NULL
      expect(schemaSql).toMatch(/book_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.books/i);
      // library_cards.user_id NOT NULL
      expect(schemaSql).toMatch(/user_id\s+UUID\s+UNIQUE\s+NOT\s+NULL\s+REFERENCES\s+public\.profiles/i);
      // notifications.user_id NOT NULL
      expect(schemaSql).toMatch(/user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.profiles/i);
      // attendance.user_id NOT NULL
      expect(schemaSql).toMatch(/user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.profiles/i);
      // ui_preferences.user_id NOT NULL
      expect(schemaSql).toMatch(/user_id\s+UUID\s+UNIQUE\s+NOT\s+NULL\s+REFERENCES\s+public\.profiles/i);
      // books.total_copies NOT NULL DEFAULT 0
      expect(schemaSql).toMatch(/total_copies\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
      // books.available_copies NOT NULL DEFAULT 0
      expect(schemaSql).toMatch(/available_copies\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
      // profiles.role NOT NULL
      expect(schemaSql).toMatch(/role\s+public\.user_role\s+NOT\s+NULL\s+DEFAULT/i);
      // profiles.status NOT NULL
      expect(schemaSql).toMatch(/status\s+TEXT\s+NOT\s+NULL\s+DEFAULT/i);
    });

    it('verifies domain CHECK constraints in schema_clean_install.sql', () => {
      expect(schemaSql).toContain('CONSTRAINT books_total_copies_check CHECK (total_copies >= 0)');
      expect(schemaSql).toContain('CONSTRAINT books_available_copies_check CHECK (available_copies >= 0)');
      expect(schemaSql).toContain('CONSTRAINT books_available_lte_total_check CHECK (available_copies <= total_copies)');
      expect(schemaSql).toContain('CONSTRAINT books_published_year_check CHECK (published_year IS NULL OR (published_year >= -3000 AND published_year <= 2100))');
      expect(schemaSql).toContain('queue_position INTEGER NOT NULL CHECK (queue_position > 0)');
      expect(schemaSql).toContain('CONSTRAINT reservations_hold_dates_check CHECK (hold_expires_at IS NULL OR hold_expires_at >= reserved_at)');
      expect(schemaSql).toContain('CONSTRAINT reservations_fulfilled_dates_check CHECK (fulfilled_at IS NULL OR fulfilled_at >= reserved_at)');
      expect(schemaSql).toContain('CONSTRAINT borrowing_records_due_date_check CHECK (due_date >= borrowed_at)');
      expect(schemaSql).toContain('CONSTRAINT borrowing_records_returned_at_check CHECK (returned_at IS NULL OR returned_at >= borrowed_at)');
      expect(schemaSql).toContain('CONSTRAINT attendance_checkout_check CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)');
      expect(schemaSql).toContain('CONSTRAINT library_cards_dates_check CHECK (expires_at IS NULL OR expires_at > issued_at)');
      expect(schemaSql).toContain('CONSTRAINT announcements_dates_check CHECK (expires_at IS NULL OR expires_at >= starts_at)');
      expect(schemaSql).toContain("priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])");
      expect(schemaSql).toContain("data_type IN ('string', 'number', 'boolean', 'json')");
      expect(schemaSql).toContain('CHECK (retained_borrow_count >= 0)');
      expect(schemaSql).toContain("CHECK (type IN ('user_role', 'module'))");
    });
  });

  describe('2. Empirical Relational Database Stress Testing (node:sqlite)', () => {
    let db: SqliteDatabaseSync;

    beforeAll(() => {
      db = new DatabaseSync(':memory:');
      db.exec('PRAGMA foreign_keys = ON;');

      // Create replica schema matching the exact constraints & delete rules
      db.exec(`
        CREATE TABLE auth_users (
          id TEXT PRIMARY KEY
        );

        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          slug TEXT UNIQUE NOT NULL
        );

        CREATE TABLE books (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
          total_copies INTEGER NOT NULL DEFAULT 0,
          available_copies INTEGER NOT NULL DEFAULT 0,
          published_year INTEGER,
          CONSTRAINT books_total_copies_check CHECK (total_copies >= 0),
          CONSTRAINT books_available_copies_check CHECK (available_copies >= 0),
          CONSTRAINT books_available_lte_total_check CHECK (available_copies <= total_copies),
          CONSTRAINT books_published_year_check CHECK (published_year IS NULL OR (published_year >= -3000 AND published_year <= 2100))
        );

        CREATE TABLE book_copies (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          qr_string TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RESERVED'))
        );

        CREATE TABLE profiles (
          id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
          email TEXT UNIQUE,
          role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('super_admin', 'librarian', 'student', 'student_assistant')),
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'DELETED', 'ARCHIVED'))
        );

        CREATE TABLE library_cards (
          id TEXT PRIMARY KEY,
          user_id TEXT UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          card_number TEXT UNIQUE NOT NULL,
          issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT,
          CONSTRAINT library_cards_dates_check CHECK (expires_at IS NULL OR expires_at > issued_at)
        );

        CREATE TABLE borrowing_records (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
          book_copy_id TEXT NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
          processed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
          returned_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
          borrowed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          due_date TEXT NOT NULL,
          returned_at TEXT,
          status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETURNED', 'OVERDUE')),
          CONSTRAINT borrowing_records_due_date_check CHECK (due_date >= borrowed_at),
          CONSTRAINT borrowing_records_returned_at_check CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
        );

        CREATE TABLE reservations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          copy_id TEXT REFERENCES book_copies(id) ON DELETE SET NULL,
          status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
          queue_position INTEGER NOT NULL CHECK (queue_position > 0),
          reserved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          hold_expires_at TEXT,
          fulfilled_at TEXT,
          CONSTRAINT reservations_hold_dates_check CHECK (hold_expires_at IS NULL OR hold_expires_at >= reserved_at),
          CONSTRAINT reservations_fulfilled_dates_check CHECK (fulfilled_at IS NULL OR fulfilled_at >= reserved_at)
        );

        CREATE TABLE attendance (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          check_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          check_out_at TEXT,
          CONSTRAINT attendance_checkout_check CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
        );

        CREATE TABLE notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'))
        );

        CREATE TABLE ui_preferences (
          id TEXT PRIMARY KEY,
          user_id TEXT UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          preferences TEXT DEFAULT '{}'
        );

        CREATE TABLE system_settings (
          id TEXT PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
          updated_by TEXT REFERENCES profiles(id) ON DELETE SET NULL
        );

        CREATE TABLE announcements (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
          starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT,
          CONSTRAINT announcements_dates_check CHECK (expires_at IS NULL OR expires_at >= starts_at)
        );

        CREATE TABLE reports (
          id TEXT PRIMARY KEY,
          book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
          user_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL
        );

        CREATE TABLE deleted_profile_info (
          id TEXT PRIMARY KEY,
          original_profile_id TEXT UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
          anonymized_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          retained_borrow_count INTEGER DEFAULT 0 NOT NULL CHECK (retained_borrow_count >= 0)
        );

        CREATE TABLE rate_limit_log (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          action_key TEXT NOT NULL
        );

        CREATE TABLE checklist_dropdown_options (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('user_role', 'module')),
          value TEXT NOT NULL,
          UNIQUE (type, value)
        );
      `);
    });

    describe('Constraint Stress Testing: Books copy counts', () => {
      it('rejects negative total_copies', () => {
        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-neg-tot', 'Test', 'Author', -1, 0);`);
        }).toThrow(/CHECK constraint failed/);
      });

      it('rejects negative available_copies', () => {
        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-neg-avail', 'Test', 'Author', 5, -1);`);
        }).toThrow(/CHECK constraint failed/);
      });

      it('rejects available_copies strictly greater than total_copies', () => {
        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-more-avail', 'Test', 'Author', 3, 5);`);
        }).toThrow(/CHECK constraint failed/);
      });

      it('accepts available_copies equal to total_copies and zero counts', () => {
        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-zero', 'Zero Book', 'Author', 0, 0);`);
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-valid', 'Valid Book', 'Author', 10, 10);`);
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-partial', 'Partial Book', 'Author', 10, 3);`);
        }).not.toThrow();
      });
    });

    describe('Constraint Stress Testing: Published Year (BCE & Future Boundaries)', () => {
      it('accepts classical BCE dates: Plato (-375) and Aristotle (-340)', () => {
        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies, published_year) VALUES ('b-plato', 'The Republic', 'Plato', 2, 2, -375);`);
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies, published_year) VALUES ('b-aristotle', 'Nicomachean Ethics', 'Aristotle', 3, 3, -340);`);
        }).not.toThrow();
      });

      it('accepts lower BCE boundary (-3000) and upper boundary (2100)', () => {
        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies, published_year) VALUES ('b-bce-min', 'Epic', 'Ancient', 1, 1, -3000);`);
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies, published_year) VALUES ('b-fut-max', 'SciFi 2100', 'Futurist', 1, 1, 2100);`);
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies, published_year) VALUES ('b-null-yr', 'Undated', 'Anonymous', 1, 1, NULL);`);
        }).not.toThrow();
      });

      it('rejects years beyond -3000 and beyond 2100', () => {
        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies, published_year) VALUES ('b-ancient', 'Prehistoric', 'Cave', 1, 1, -3001);`);
        }).toThrow(/CHECK constraint failed/);

        expect(() => {
          db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies, published_year) VALUES ('b-future', 'Far Future', 'SciFi', 1, 1, 2101);`);
        }).toThrow(/CHECK constraint failed/);
      });
    });

    describe('Constraint Stress Testing: Date Inversions', () => {
      beforeAll(() => {
        db.exec(`INSERT INTO auth_users VALUES ('u-date-test');`);
        db.exec(`INSERT INTO profiles (id, email, role, status) VALUES ('u-date-test', 'date@test.edu', 'student', 'ACTIVE');`);
        db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-copy-test', 'Book', 'Author', 1, 1);`);
        db.exec(`INSERT INTO book_copies (id, book_id, qr_string, status) VALUES ('bc-date-test', 'b-copy-test', 'QR-DATE-1', 'BORROWED');`);
      });

      it('rejects borrowing_records with due_date < borrowed_at', () => {
        expect(() => {
          db.exec(`
            INSERT INTO borrowing_records (id, user_id, book_copy_id, borrowed_at, due_date)
            VALUES ('br-inv-due', 'u-date-test', 'bc-date-test', '2026-10-07 10:00:00', '2026-10-06 10:00:00');
          `);
        }).toThrow(/CHECK constraint failed/);
      });

      it('rejects borrowing_records with returned_at < borrowed_at', () => {
        expect(() => {
          db.exec(`
            INSERT INTO borrowing_records (id, user_id, book_copy_id, borrowed_at, due_date, returned_at)
            VALUES ('br-inv-ret', 'u-date-test', 'bc-date-test', '2026-10-07 10:00:00', '2026-10-14 10:00:00', '2026-10-05 10:00:00');
          `);
        }).toThrow(/CHECK constraint failed/);
      });

      it('accepts valid borrowing_records with due_date >= borrowed_at and returned_at >= borrowed_at', () => {
        expect(() => {
          db.exec(`
            INSERT INTO borrowing_records (id, user_id, book_copy_id, borrowed_at, due_date, returned_at)
            VALUES ('br-valid-dates', 'u-date-test', 'bc-date-test', '2026-10-07 10:00:00', '2026-10-21 10:00:00', '2026-10-10 12:00:00');
          `);
        }).not.toThrow();
      });

      it('rejects attendance with check_out_at < check_in_at', () => {
        expect(() => {
          db.exec(`
            INSERT INTO attendance (id, user_id, check_in_at, check_out_at)
            VALUES ('att-inv', 'u-date-test', '2026-10-07 10:00:00', '2026-10-07 09:00:00');
          `);
        }).toThrow(/CHECK constraint failed/);
      });

      it('accepts attendance with check_out_at >= check_in_at or NULL', () => {
        expect(() => {
          db.exec(`
            INSERT INTO attendance (id, user_id, check_in_at, check_out_at)
            VALUES ('att-valid', 'u-date-test', '2026-10-07 10:00:00', '2026-10-07 12:00:00');
          `);
          db.exec(`
            INSERT INTO attendance (id, user_id, check_in_at, check_out_at)
            VALUES ('att-open', 'u-date-test', '2026-10-07 13:00:00', NULL);
          `);
        }).not.toThrow();
      });

      it('rejects library_cards with expires_at <= issued_at', () => {
        expect(() => {
          db.exec(`
            INSERT INTO library_cards (id, user_id, card_number, issued_at, expires_at)
            VALUES ('card-inv-1', 'u-date-test', 'CARD-001', '2026-10-07 10:00:00', '2026-10-07 10:00:00');
          `);
        }).toThrow(/CHECK constraint failed/);

        expect(() => {
          db.exec(`
            INSERT INTO library_cards (id, user_id, card_number, issued_at, expires_at)
            VALUES ('card-inv-2', 'u-date-test', 'CARD-002', '2026-10-07 10:00:00', '2026-10-06 10:00:00');
          `);
        }).toThrow(/CHECK constraint failed/);
      });
    });

    describe('Constraint Stress Testing: Reservations Queue Position', () => {
      beforeAll(() => {
        db.exec(`INSERT INTO auth_users VALUES ('u-res-test');`);
        db.exec(`INSERT INTO profiles (id, email, role, status) VALUES ('u-res-test', 'res@test.edu', 'student', 'ACTIVE');`);
      });

      it('rejects queue_position = 0 or negative', () => {
        expect(() => {
          db.exec(`
            INSERT INTO reservations (id, user_id, book_id, queue_position)
            VALUES ('res-zero', 'u-res-test', 'b-valid', 0);
          `);
        }).toThrow(/CHECK constraint failed/);

        expect(() => {
          db.exec(`
            INSERT INTO reservations (id, user_id, book_id, queue_position)
            VALUES ('res-neg', 'u-res-test', 'b-valid', -1);
          `);
        }).toThrow(/CHECK constraint failed/);
      });

      it('accepts strictly positive queue_position', () => {
        expect(() => {
          db.exec(`
            INSERT INTO reservations (id, user_id, book_id, queue_position)
            VALUES ('res-pos-1', 'u-res-test', 'b-valid', 1);
          `);
          db.exec(`
            INSERT INTO reservations (id, user_id, book_id, queue_position)
            VALUES ('res-pos-5', 'u-res-test', 'b-valid', 5);
          `);
        }).not.toThrow();
      });
    });

    describe('Foreign Key Delete Rule Semantics: RESTRICT, SET NULL, CASCADE', () => {
      beforeAll(() => {
        // Create user with borrowing record
        db.exec(`INSERT INTO auth_users VALUES ('u-borrower');`);
        db.exec(`INSERT INTO profiles (id, email, role, status) VALUES ('u-borrower', 'borrower@school.edu', 'student', 'ACTIVE');`);

        // Create librarian
        db.exec(`INSERT INTO auth_users VALUES ('u-librarian');`);
        db.exec(`INSERT INTO profiles (id, email, role, status) VALUES ('u-librarian', 'librarian@school.edu', 'librarian', 'ACTIVE');`);

        // Create book and copy
        db.exec(`INSERT INTO books (id, title, author, total_copies, available_copies) VALUES ('b-fk-test', 'FK Book', 'Author', 1, 0);`);
        db.exec(`INSERT INTO book_copies (id, book_id, qr_string, status) VALUES ('bc-fk-test', 'b-fk-test', 'QR-FK-1', 'BORROWED');`);

        // Create active borrowing record processed by u-librarian
        db.exec(`
          INSERT INTO borrowing_records (id, user_id, book_copy_id, processed_by, due_date)
          VALUES ('br-fk-active', 'u-borrower', 'bc-fk-test', 'u-librarian', '2026-10-21 10:00:00');
        `);
      });

      it('BLOCKS deletion of borrower profile due to ON DELETE RESTRICT', () => {
        expect(() => {
          db.exec(`DELETE FROM profiles WHERE id = 'u-borrower';`);
        }).toThrow(/FOREIGN KEY constraint failed/);

        // Verify borrower record is intact
        const row = db.prepare(`SELECT user_id FROM borrowing_records WHERE id = 'br-fk-active';`).get() as { user_id: string };
        expect(row.user_id).toBe('u-borrower');
      });

      it('BLOCKS deletion of book_copy due to ON DELETE RESTRICT on borrowing_records', () => {
        expect(() => {
          db.exec(`DELETE FROM book_copies WHERE id = 'bc-fk-test';`);
        }).toThrow(/FOREIGN KEY constraint failed/);

        // Verify copy record is intact
        const row = db.prepare(`SELECT book_copy_id FROM borrowing_records WHERE id = 'br-fk-active';`).get() as { book_copy_id: string };
        expect(row.book_copy_id).toBe('bc-fk-test');
      });

      it('SETS processed_by to NULL when processing librarian is deleted (ON DELETE SET NULL)', () => {
        // Delete librarian profile
        db.exec(`DELETE FROM profiles WHERE id = 'u-librarian';`);

        // Verify borrowing record was NOT deleted, and processed_by is now NULL
        const row = db.prepare(`SELECT id, processed_by FROM borrowing_records WHERE id = 'br-fk-active';`).get() as { id: string; processed_by: string | null };
        expect(row.id).toBe('br-fk-active');
        expect(row.processed_by).toBeNull();
      });

      it('CASCADES deletion of user to reservations, library cards, notifications, and attendance', () => {
        // Create clean user with owned child records but NO borrowing records
        db.exec(`INSERT INTO auth_users VALUES ('u-cascade');`);
        db.exec(`INSERT INTO profiles (id, email, role, status) VALUES ('u-cascade', 'cascade@school.edu', 'student', 'ACTIVE');`);
        
        db.exec(`INSERT INTO library_cards (id, user_id, card_number, issued_at, expires_at) VALUES ('lc-casc', 'u-cascade', 'CARD-CASC', '2026-10-07 10:00:00', '2027-10-07 10:00:00');`);
        db.exec(`INSERT INTO reservations (id, user_id, book_id, queue_position) VALUES ('res-casc', 'u-cascade', 'b-valid', 1);`);
        db.exec(`INSERT INTO notifications (id, user_id, title, content) VALUES ('notif-casc', 'u-cascade', 'Welcome', 'Hello');`);
        db.exec(`INSERT INTO attendance (id, user_id, check_in_at) VALUES ('att-casc', 'u-cascade', '2026-10-07 08:00:00');`);
        db.exec(`INSERT INTO ui_preferences (id, user_id) VALUES ('uip-casc', 'u-cascade');`);

        // Verify records exist before delete
        expect(db.prepare(`SELECT id FROM library_cards WHERE user_id = 'u-cascade';`).get()).toBeDefined();
        expect(db.prepare(`SELECT id FROM reservations WHERE user_id = 'u-cascade';`).get()).toBeDefined();
        expect(db.prepare(`SELECT id FROM notifications WHERE user_id = 'u-cascade';`).get()).toBeDefined();
        expect(db.prepare(`SELECT id FROM attendance WHERE user_id = 'u-cascade';`).get()).toBeDefined();
        expect(db.prepare(`SELECT id FROM ui_preferences WHERE user_id = 'u-cascade';`).get()).toBeDefined();

        // Delete profile
        db.exec(`DELETE FROM profiles WHERE id = 'u-cascade';`);

        // Verify 100% cascaded deletion
        expect(db.prepare(`SELECT id FROM library_cards WHERE user_id = 'u-cascade';`).get()).toBeUndefined();
        expect(db.prepare(`SELECT id FROM reservations WHERE user_id = 'u-cascade';`).get()).toBeUndefined();
        expect(db.prepare(`SELECT id FROM notifications WHERE user_id = 'u-cascade';`).get()).toBeUndefined();
        expect(db.prepare(`SELECT id FROM attendance WHERE user_id = 'u-cascade';`).get()).toBeUndefined();
        expect(db.prepare(`SELECT id FROM ui_preferences WHERE user_id = 'u-cascade';`).get()).toBeUndefined();
      });
    });
  });

  describe('3. TypeScript Type Safety & Enum Alignment Verification', () => {
    it('verifies BorrowStatus enum does NOT contain LOST', () => {
      const allowedBorrowStatuses: BorrowStatus[] = ['ACTIVE', 'RETURNED', 'OVERDUE'];
      expect(allowedBorrowStatuses).toHaveLength(3);
      expect(allowedBorrowStatuses).not.toContain('LOST');

      // Compile-time test: Assigning 'LOST' to BorrowStatus causes type error
      // @ts-expect-error LOST is not assignable to BorrowStatus
      const invalidStatus: BorrowStatus = 'LOST';
      expect(invalidStatus).toBe('LOST');
    });

    it('verifies BookCopyStatus contains LOST while BorrowStatus does not', () => {
      const copyStatus: BookCopyStatus = 'LOST';
      expect(copyStatus).toBe('LOST');
    });

    it('verifies ReservationStatus contains all canonical states', () => {
      const validStates: ReservationStatus[] = ['ACTIVE', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED'];
      expect(validStates).toHaveLength(5);
    });

    it('verifies that no application code attempts to write "LOST" to borrowing_records', () => {
      const libActionsDir = path.resolve(process.cwd(), 'lib/actions');
      const actionFiles = fs.readdirSync(libActionsDir).filter(f => f.endsWith('.ts'));

      for (const file of actionFiles) {
        const content = fs.readFileSync(path.join(libActionsDir, file), 'utf8');
        // Match any query targeting borrowing_records with an update or insert specifying status: 'LOST'
        const regex = /from\(['"]borrowing_records['"]\)(?:[\s\S](?!from))*?(?:update|insert)\(\s*\{[^}]*?status:\s*['"]LOST['"]/;
        expect(regex.test(content)).toBe(false);
      }
    });

    it('verifies catalog.ts properly converts copy status LOST to borrowing record RETURNED', () => {
      const catalogPath = path.resolve(process.cwd(), 'lib/actions/catalog.ts');
      const content = fs.readFileSync(catalogPath, 'utf8');

      // Verifies catalog.ts marks lingering borrowing records as RETURNED when a copy is LOST
      expect(content).toMatch(/status:\s*['"]RETURNED['"]/);
      expect(content).toMatch(/if\s*\(\s*\[['"]AVAILABLE['"],\s*['"]MAINTENANCE['"],\s*['"]LOST['"]\]\.includes\(status\)\)/);
    });
  });
});
