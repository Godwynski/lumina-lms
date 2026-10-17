import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Milestone 3 & 4: Indexing, Trigger Optimization & Seed Synchronization', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema_clean_install.sql');
  const configPath = path.resolve(process.cwd(), 'supabase/config.toml');
  const sampleDataPath = path.resolve(process.cwd(), 'supabase/sample_data.sql');
  const cleanScriptPath = path.resolve(process.cwd(), 'scripts/clean.ts');

  let schemaSql: string;
  let configContent: string;
  let sampleDataSql: string;
  let cleanScriptContent: string;

  beforeAll(() => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(sampleDataPath)).toBe(true);
    expect(fs.existsSync(cleanScriptPath)).toBe(true);

    schemaSql = fs.readFileSync(schemaPath, 'utf8');
    configContent = fs.readFileSync(configPath, 'utf8');
    sampleDataSql = fs.readFileSync(sampleDataPath, 'utf8');
    cleanScriptContent = fs.readFileSync(cleanScriptPath, 'utf8');
  });

  describe('1. Foreign Key B-Tree Index Coverage (Milestone 3)', () => {
    const requiredFkIndexes = [
      'books_category_id_idx',
      'book_copies_book_id_idx',
      'borrowing_records_user_id_idx',
      'borrowing_records_book_copy_id_idx',
      'borrowing_records_processed_by_idx',
      'borrowing_records_returned_by_idx',
      'reservations_user_id_idx',
      'reservations_book_id_idx',
      'reservations_copy_id_idx',
      'system_settings_updated_by_idx',
      'notifications_user_id_idx',
      'attendance_user_id_idx',
      'announcements_created_by_idx',
      'reports_book_id_idx',
      'reports_user_id_idx',
      'rate_limit_log_user_id_idx',
      'audit_logs_admin_id_idx',
    ];

    for (const indexName of requiredFkIndexes) {
      it(`verifies mandatory foreign key index ${indexName} is declared`, () => {
        expect(schemaSql).toContain(indexName);
      });
    }
  });

  describe('2. Composite & Partial Query Indexes (Milestone 3)', () => {
    const compositeIndexes = [
      'borrowing_records_user_status_idx',
      'borrowing_records_user_borrowed_idx',
      'borrowing_records_due_active_idx',
      'reservations_queue_idx',
      'reservations_user_book_status_idx',
      'attendance_user_active_idx',
      'attendance_checkout_cron_idx',
      'notifications_user_created_idx',
      'notifications_unread_idx',
    ];

    for (const indexName of compositeIndexes) {
      it(`verifies performance composite/partial index ${indexName} is declared`, () => {
        expect(schemaSql).toContain(indexName);
      });
    }
  });

  describe('3. Redundant Index Elimination & Trigger Concurrency (Milestone 3)', () => {
    it('verifies redundant book_copies_qr_idx and profiles_student_id_idx are removed', () => {
      expect(schemaSql).not.toContain('CREATE INDEX IF NOT EXISTS book_copies_qr_idx');
      expect(schemaSql).not.toContain('CREATE INDEX IF NOT EXISTS profiles_student_id_idx');
    });

    it('verifies tr_sync_book_counts trigger fires only on status and book_id updates', () => {
      expect(schemaSql).toMatch(/CREATE\s+OR\s+REPLACE\s+TRIGGER\s+tr_sync_book_counts\s+AFTER\s+INSERT\s+OR\s+UPDATE\s+OF\s+status,\s*book_id\s+OR\s+DELETE\s+ON\s+public\.book_copies/i);
    });

    it('verifies process_qr_checkout and process_qr_return lock only the specific copy with FOR UPDATE OF bc', () => {
      expect(schemaSql).toMatch(/WHERE bc\.qr_string = p_book_qr\s+FOR UPDATE OF bc;/);
    });
  });

  describe('4. Migration & Seed Synchronization (Milestone 4)', () => {
    it('verifies supabase/config.toml points seed sql_paths to ./sample_data.sql', () => {
      expect(configContent).toMatch(/sql_paths\s*=\s*\["\.\/sample_data\.sql"\]/);
    });

    it('verifies category slugs in sample_data.sql match seed.ts conventions', () => {
      expect(sampleDataSql).toContain('literature-fiction');
    });

    it('verifies sample_data.sql is idempotent with ON CONFLICT and existence checks', () => {
      expect(sampleDataSql).toContain('ON CONFLICT (slug) DO UPDATE');
      expect(sampleDataSql).toContain('ON CONFLICT (qr_string) DO NOTHING');
    });

    it('verifies scripts/clean.ts includes rate_limit_log, deleted_profile_info, and ui_preferences', () => {
      expect(cleanScriptContent).toContain("from('rate_limit_log').delete()");
      expect(cleanScriptContent).toContain("from('deleted_profile_info').delete()");
      expect(cleanScriptContent).toContain("from('ui_preferences').delete()");
    });
  });
});
