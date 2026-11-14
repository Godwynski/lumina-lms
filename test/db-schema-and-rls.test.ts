// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { DEFAULT_POLICIES, isValidPolicyValue } from '@/lib/actions/policy-constants';

const SCHEMA_SQL = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/schema_clean_install.sql'),
  'utf8'
);

const SUPABASE_PRELUDE = `
  DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE SCHEMA IF NOT EXISTS storage;

  CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  $$;

  CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text,
    public boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );

  CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamptz DEFAULT now()
  );

  CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT string_to_array(regexp_replace(name, '/[^/]+$', ''), '/');
  $$;

  CREATE PUBLICATION supabase_realtime;

  GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  GRANT ALL ON TABLE storage.objects TO anon, authenticated, service_role;
  GRANT ALL ON TABLE storage.buckets TO anon, authenticated, service_role;
`;

type DbRole = 'anon' | 'authenticated' | 'service_role';

async function bootLuminaDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm, uuid_ossp } });
  await db.exec(SUPABASE_PRELUDE);
  await db.exec(SCHEMA_SQL);
  return db;
}

async function withRole<T>(
  db: PGlite,
  role: DbRole,
  userId: string | null,
  fn: (tx: Parameters<Parameters<PGlite['transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    if (role === 'authenticated' && userId) {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
      await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ role: 'authenticated', sub: userId }),
      ]);
    } else if (role === 'service_role') {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', '', true)`);
      await tx.query(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    } else {
      await tx.query(`SELECT set_config('request.jwt.claim.sub', '', true)`);
      await tx.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    }
    return fn(tx);
  });
}

async function expectRoleFailure(
  db: PGlite,
  role: DbRole,
  userId: string | null,
  sql: string,
  params: unknown[] = []
): Promise<string> {
  let errorMessage = '';
  try {
    await withRole(db, role, userId, async (tx) => {
      await tx.query(sql, params);
    });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  expect(errorMessage).not.toBe('');
  return errorMessage;
}

async function insertAuthUser(
  db: PGlite,
  opts: { id?: string; email: string; fullName?: string; avatarUrl?: string }
): Promise<string> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO auth.users (id, email, raw_user_meta_data)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3::jsonb)
     RETURNING id`,
    [
      opts.id ?? null,
      opts.email,
      JSON.stringify({
        full_name: opts.fullName ?? null,
        avatar_url: opts.avatarUrl ?? null,
      }),
    ]
  );
  return res.rows[0].id;
}

describe('DB Schema, Constraints, Seeds & Triggers', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await bootLuminaDb();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('creates all 15 public tables and required columns on borrowing_records', async () => {
    const tablesRes = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = tablesRes.rows.map((r) => r.tablename);
    expect(tables).toEqual([
      'attendance',
      'audit_logs',
      'book_copies',
      'books',
      'borrowing_records',
      'categories',
      'checkout_idempotency',
      'demo_accounts',
      'library_cards',
      'notifications',
      'profiles',
      'reservations',
      'return_idempotency',
      'system_settings',
      'ui_preferences',
    ]);

    const colRes = await db.query<{ column_name: string; data_type: string; numeric_precision: number | null; numeric_scale: number | null }>(
      `SELECT column_name, data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'borrowing_records'
       ORDER BY ordinal_position`
    );
    const cols = new Map(colRes.rows.map((r) => [r.column_name, r]));
    expect(cols.get('fine_amount')).toMatchObject({
      data_type: 'numeric',
      numeric_precision: 10,
      numeric_scale: 2,
    });
    expect(cols.get('fine_settled_at')?.data_type).toBe('timestamp with time zone');
    expect(cols.has('reminder_sent')).toBe(true);
    expect(cols.has('overdue_notified')).toBe(true);
    expect(cols.has('processed_by')).toBe(true);
    expect(cols.has('returned_by')).toBe(true);
  });

  it('defines exact custom enum types and values', async () => {
    const enumRes = await db.query<{ typname: string; labels: string[] }>(
      `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
       GROUP BY t.typname
       ORDER BY t.typname`
    );
    const enums = new Map(enumRes.rows.map((r) => [r.typname, r.labels]));
    expect(enums.get('user_role')).toEqual(['super_admin', 'librarian', 'student', 'student_assistant']);
    expect(enums.get('BorrowStatus')).toEqual(['ACTIVE', 'RETURNED', 'OVERDUE', 'LOST']);
    expect(enums.get('ReservationStatus')).toEqual(['ACTIVE', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED']);
  });

  it('seeds default system_settings rows and validates them with isValidPolicyValue', async () => {
    const res = await db.query<{ key: string; value: string; data_type: string }>(
      `SELECT key, value, data_type FROM public.system_settings ORDER BY key`
    );
    const settings = new Map(res.rows.map((r) => [r.key, r]));

    expect(settings.get('max_borrow_limit')).toMatchObject({ value: '5', data_type: 'number' });
    expect(settings.get('loan_period_days')).toMatchObject({ value: '14', data_type: 'number' });
    expect(settings.get('hold_expiry_days')).toMatchObject({ value: '3', data_type: 'number' });
    expect(settings.get('overdue_fine_per_day')).toMatchObject({ value: '5', data_type: 'number' });

    for (const row of res.rows) {
      expect(isValidPolicyValue(row.key, row.value)).toBe(true);
    }

    // Also verify all DEFAULT_POLICIES keys validate cleanly and invalid bounds are rejected
    for (const [key, cfg] of Object.entries(DEFAULT_POLICIES)) {
      expect(isValidPolicyValue(key, cfg.value)).toBe(true);
    }
    expect(isValidPolicyValue('loan_period_days', '1.5')).toBe(false);
    expect(isValidPolicyValue('loan_period_days', '0')).toBe(false);
    expect(isValidPolicyValue('loan_period_days', '91')).toBe(false);
    expect(isValidPolicyValue('max_borrow_limit', '21')).toBe(false);
    expect(isValidPolicyValue('overdue_fine_per_day', '0')).toBe(true);
    expect(isValidPolicyValue('overdue_fine_per_day', '500')).toBe(true);
    expect(isValidPolicyValue('overdue_fine_per_day', '501')).toBe(false);
  });

  it('enforces table check constraints, unique indexes, and foreign key restrictions', async () => {
    // Books constraints & generated search_vector
    await expect(
      db.query(`INSERT INTO public.books (title, author, total_copies) VALUES ('Bad', 'A', -1)`)
    ).rejects.toThrow();
    await expect(
      db.query(`INSERT INTO public.books (title, author, total_copies, available_copies) VALUES ('Bad', 'A', 1, 2)`)
    ).rejects.toThrow();
    await expect(
      db.query(`INSERT INTO public.books (title, author, published_year) VALUES ('Old', 'A', -3001)`)
    ).rejects.toThrow();
    await expect(
      db.query(`INSERT INTO public.books (title, author, published_year) VALUES ('Future', 'A', 2101)`)
    ).rejects.toThrow();

    const bookRes = await db.query<{ id: string; has_vec: boolean }>(
      `INSERT INTO public.books (title, author, isbn, published_year)
       VALUES ('Clean Code', 'Robert Martin', '9780132350884', 2008)
       RETURNING id, (search_vector @@ to_tsquery('english', 'clean & code')) AS has_vec`
    );
    expect(bookRes.rows[0].has_vec).toBe(true);
    const bookId = bookRes.rows[0].id;

    // Book copies default QR & accession sequences and status check
    const copy1 = await db.query<{ id: string; qr_string: string; accession_number: string }>(
      `INSERT INTO public.book_copies (book_id) VALUES ($1) RETURNING id, qr_string, accession_number`,
      [bookId]
    );
    const copy2 = await db.query<{ id: string; qr_string: string; accession_number: string }>(
      `INSERT INTO public.book_copies (book_id) VALUES ($1) RETURNING id, qr_string, accession_number`,
      [bookId]
    );
    expect(copy1.rows[0].qr_string).toBe('QR-10000');
    expect(copy1.rows[0].accession_number).toBe('ACC-00001');
    expect(copy2.rows[0].qr_string).toBe('QR-10001');
    expect(copy2.rows[0].accession_number).toBe('ACC-00002');
    await expect(
      db.query(`INSERT INTO public.book_copies (book_id, status) VALUES ($1, 'ARCHIVED')`, [bookId])
    ).rejects.toThrow();

    // Users & one_super_admin_idx singleton
    const adminId = await insertAuthUser(db, { email: 'admin@alabang.sti.edu.ph', fullName: 'Admin' });
    const studentId = await insertAuthUser(db, { email: 'juan.123456@alabang.sti.edu.ph', fullName: 'Juan' });
    await expect(
      db.query(`UPDATE public.profiles SET role = 'super_admin' WHERE id = $1`, [studentId])
    ).rejects.toThrow();

    // Borrowing records date checks & ON DELETE RESTRICT
    await expect(
      db.query(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date)
         VALUES ($1, $2, NOW(), NOW() - interval '1 day')`,
        [studentId, copy1.rows[0].id]
      )
    ).rejects.toThrow();

    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date)
       VALUES ($1, $2, NOW(), NOW() + interval '7 days')`,
      [studentId, copy1.rows[0].id]
    );
    await expect(db.query(`DELETE FROM public.profiles WHERE id = $1`, [studentId])).rejects.toThrow();
    await expect(db.query(`DELETE FROM public.book_copies WHERE id = $1`, [copy1.rows[0].id])).rejects.toThrow();

    // Reservations constraints
    await expect(
      db.query(
        `INSERT INTO public.reservations (user_id, book_id, queue_position) VALUES ($1, $2, 0)`,
        [studentId, bookId]
      )
    ).rejects.toThrow();

    // Attendance open session uniqueness & checkout >= checkin
    await db.query(`INSERT INTO public.attendance (user_id) VALUES ($1)`, [adminId]);
    await expect(
      db.query(`INSERT INTO public.attendance (user_id) VALUES ($1)`, [adminId])
    ).rejects.toThrow();
    await expect(
      db.query(
        `UPDATE public.attendance SET check_out_at = check_in_at - interval '1 minute' WHERE user_id = $1`,
        [adminId]
      )
    ).rejects.toThrow();
    await db.query(`UPDATE public.attendance SET check_out_at = check_in_at + interval '1 hour' WHERE user_id = $1`, [adminId]);
    // Second check-in allowed once first is closed
    await expect(
      db.query(`INSERT INTO public.attendance (user_id) VALUES ($1)`, [adminId])
    ).resolves.toBeDefined();

    // Notifications & system_settings checks
    await expect(
      db.query(
        `INSERT INTO public.notifications (user_id, title, content, priority) VALUES ($1, 'T', 'C', 'urgent')`,
        [studentId]
      )
    ).rejects.toThrow();
    await expect(
      db.query(`INSERT INTO public.system_settings (key, value, data_type) VALUES ('k1', 'v', 'float')`)
    ).rejects.toThrow();
  });

  it('handle_new_user and auto_set_student_id handle first super_admin, subsequent students, STI IDs, and non-STI / demo accounts', async () => {
    // 1. Non-STI account rejected by default
    await expect(
      insertAuthUser(db, { email: 'outsider@gmail.com', fullName: 'Outsider' })
    ).rejects.toThrow(/Sign-up is limited to @alabang\.sti\.edu\.ph accounts/);

    // 2. First STI user becomes ACTIVE super_admin + ACTIVE library card + FAC- id
    const firstId = await insertAuthUser(db, {
      email: 'head.librarian@alabang.sti.edu.ph',
      fullName: 'Head Librarian',
    });
    const firstProfile = await db.query<{
      role: string;
      status: string;
      student_id: string | null;
      full_name: string;
    }>(`SELECT role::text, status, student_id, full_name FROM public.profiles WHERE id = $1`, [firstId]);
    expect(firstProfile.rows[0]).toEqual({
      role: 'super_admin',
      status: 'ACTIVE',
      // auto_set_student_id runs regexp_replace('[^A-Z0-9._-]', '_') before upper(), leaving lowercase letters replaced by '_'
      student_id: 'FAC-____._________',
      full_name: 'Head Librarian',
    });
    const firstCard = await db.query<{ card_number: string; status: string }>(
      `SELECT card_number, status FROM public.library_cards WHERE user_id = $1`,
      [firstId]
    );
    expect(firstCard.rows[0].status).toBe('ACTIVE');
    expect(firstCard.rows[0].card_number).toMatch(/^LIB-\d{4}-[A-F0-9]{8}$/);

    // 3. Subsequent STI student with 6+ digits gets PENDING student + STU-XXXXXX + PENDING card
    const secondId = await insertAuthUser(db, {
      email: 'santos.202401@alabang.sti.edu.ph',
      fullName: 'Maria Santos',
    });
    const secondProfile = await db.query<{ role: string; status: string; student_id: string | null }>(
      `SELECT role::text, status, student_id FROM public.profiles WHERE id = $1`,
      [secondId]
    );
    expect(secondProfile.rows[0]).toEqual({
      role: 'student',
      status: 'PENDING',
      student_id: 'STU-202401',
    });
    const secondCard = await db.query<{ card_number: string; status: string }>(
      `SELECT card_number, status FROM public.library_cards WHERE user_id = $1`,
      [secondId]
    );
    expect(secondCard.rows[0].status).toBe('PENDING');
    expect(secondCard.rows[0].card_number).not.toBe(firstCard.rows[0].card_number);

    // 4. Demo allowlisted non-STI account succeeds and keeps student_id NULL
    await db.query(`INSERT INTO public.demo_accounts (email) VALUES ('demo.patron@lumina.test')`);
    const demoId = await insertAuthUser(db, {
      email: 'demo.patron@lumina.test',
      fullName: 'Demo Patron',
    });
    const demoProfile = await db.query<{ role: string; status: string; student_id: string | null }>(
      `SELECT role::text, status, student_id FROM public.profiles WHERE id = $1`,
      [demoId]
    );
    expect(demoProfile.rows[0]).toEqual({
      role: 'student',
      status: 'PENDING',
      student_id: null,
    });
  });

  it('fn_sync_book_counts updates total_copies and available_copies on insert, status update, book move, and delete', async () => {
    const b1 = (
      await db.query<{ id: string }>(
        `INSERT INTO public.books (title, author) VALUES ('Book One', 'Author A') RETURNING id`
      )
    ).rows[0].id;
    const b2 = (
      await db.query<{ id: string }>(
        `INSERT INTO public.books (title, author) VALUES ('Book Two', 'Author B') RETURNING id`
      )
    ).rows[0].id;

    const getCounts = async (bookId: string) =>
      (
        await db.query<{ total_copies: number; available_copies: number }>(
          `SELECT total_copies, available_copies FROM public.books WHERE id = $1`,
          [bookId]
        )
      ).rows[0];

    expect(await getCounts(b1)).toEqual({ total_copies: 0, available_copies: 0 });

    const c1 = (
      await db.query<{ id: string }>(
        `INSERT INTO public.book_copies (book_id, status) VALUES ($1, 'AVAILABLE') RETURNING id`,
        [b1]
      )
    ).rows[0].id;
    expect(await getCounts(b1)).toEqual({ total_copies: 1, available_copies: 1 });

    const c2 = (
      await db.query<{ id: string }>(
        `INSERT INTO public.book_copies (book_id, status) VALUES ($1, 'MAINTENANCE') RETURNING id`,
        [b1]
      )
    ).rows[0].id;
    expect(await getCounts(b1)).toEqual({ total_copies: 2, available_copies: 1 });

    // AVAILABLE -> BORROWED -> LOST -> RESERVED -> AVAILABLE
    await db.query(`UPDATE public.book_copies SET status = 'BORROWED' WHERE id = $1`, [c1]);
    expect(await getCounts(b1)).toEqual({ total_copies: 2, available_copies: 0 });

    await db.query(`UPDATE public.book_copies SET status = 'LOST' WHERE id = $1`, [c1]);
    expect(await getCounts(b1)).toEqual({ total_copies: 2, available_copies: 0 });

    await db.query(`UPDATE public.book_copies SET status = 'RESERVED' WHERE id = $1`, [c1]);
    expect(await getCounts(b1)).toEqual({ total_copies: 2, available_copies: 0 });

    await db.query(`UPDATE public.book_copies SET status = 'AVAILABLE' WHERE id = $1`, [c1]);
    expect(await getCounts(b1)).toEqual({ total_copies: 2, available_copies: 1 });

    // Move c1 to b2
    await db.query(`UPDATE public.book_copies SET book_id = $1 WHERE id = $2`, [b2, c1]);
    expect(await getCounts(b1)).toEqual({ total_copies: 1, available_copies: 0 });
    expect(await getCounts(b2)).toEqual({ total_copies: 1, available_copies: 1 });

    // Delete AVAILABLE copy c1 from b2 and MAINTENANCE copy c2 from b1
    await db.query(`DELETE FROM public.book_copies WHERE id = $1`, [c1]);
    expect(await getCounts(b2)).toEqual({ total_copies: 0, available_copies: 0 });

    await db.query(`DELETE FROM public.book_copies WHERE id = $1`, [c2]);
    expect(await getCounts(b1)).toEqual({ total_copies: 0, available_copies: 0 });
  });
});

describe('Helper Functions, Privilege Revocations & Row-Level Security (RLS)', () => {
  let db: PGlite;
  let superAdminId: string;
  let librarianId: string;
  let saId: string;
  let student1Id: string;
  let student2Id: string;
  let pendingLibrarianId: string;
  let activeCategoryId: string;
  let activeBookId: string;
  let inactiveBookId: string;
  let copyAvailableId: string;
  let student1BorrowId: string;
  let student2BorrowId: string;
  let student1ResId: string;
  let student2ResId: string;
  let student1NotifId: string;
  let student2NotifId: string;

  beforeAll(async () => {
    db = await bootLuminaDb();

    superAdminId = await insertAuthUser(db, { email: 'sa.admin@alabang.sti.edu.ph', fullName: 'Super Admin' });
    librarianId = await insertAuthUser(db, { email: 'lib.staff@alabang.sti.edu.ph', fullName: 'Librarian' });
    saId = await insertAuthUser(db, { email: 'assistant.100001@alabang.sti.edu.ph', fullName: 'Student Assistant' });
    student1Id = await insertAuthUser(db, { email: 's1.200001@alabang.sti.edu.ph', fullName: 'Student One' });
    student2Id = await insertAuthUser(db, { email: 's2.200002@alabang.sti.edu.ph', fullName: 'Student Two' });
    pendingLibrarianId = await insertAuthUser(db, { email: 'pending.lib@alabang.sti.edu.ph', fullName: 'Pending Lib' });

    await db.query(`UPDATE public.profiles SET role = 'librarian', status = 'ACTIVE' WHERE id = $1`, [librarianId]);
    await db.query(`UPDATE public.profiles SET role = 'student_assistant', status = 'ACTIVE' WHERE id = $1`, [saId]);
    await db.query(`UPDATE public.profiles SET status = 'ACTIVE' WHERE id IN ($1, $2)`, [student1Id, student2Id]);
    await db.query(`UPDATE public.profiles SET role = 'librarian', status = 'PENDING' WHERE id = $1`, [pendingLibrarianId]);
    await db.query(`UPDATE public.library_cards SET status = 'ACTIVE' WHERE user_id IN ($1, $2, $3, $4)`, [
      librarianId,
      saId,
      student1Id,
      student2Id,
    ]);

    activeCategoryId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.categories (name, slug) VALUES ('Computer Science', 'computer-science') RETURNING id`
      )
    ).rows[0].id;

    activeBookId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.books (title, author, category_id, is_active)
         VALUES ('Active Book', 'Author One', $1, true) RETURNING id`,
        [activeCategoryId]
      )
    ).rows[0].id;

    inactiveBookId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.books (title, author, category_id, is_active)
         VALUES ('Archived Book', 'Author Two', $1, false) RETURNING id`,
        [activeCategoryId]
      )
    ).rows[0].id;

    copyAvailableId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.book_copies (book_id, status) VALUES ($1, 'AVAILABLE') RETURNING id`,
        [activeBookId]
      )
    ).rows[0].id;
    const copy2Id = (
      await db.query<{ id: string }>(
        `INSERT INTO public.book_copies (book_id, status) VALUES ($1, 'BORROWED') RETURNING id`,
        [activeBookId]
      )
    ).rows[0].id;

    student1BorrowId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status)
         VALUES ($1, $2, NOW() + interval '7 days', 'ACTIVE') RETURNING id`,
        [student1Id, copy2Id]
      )
    ).rows[0].id;
    student2BorrowId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status, returned_at)
         VALUES ($1, $2, NOW() + interval '7 days', 'RETURNED', NOW()) RETURNING id`,
        [student2Id, copyAvailableId]
      )
    ).rows[0].id;

    student1ResId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status)
         VALUES ($1, $2, 1, 'ACTIVE') RETURNING id`,
        [student1Id, activeBookId]
      )
    ).rows[0].id;
    student2ResId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status)
         VALUES ($1, $2, 2, 'ACTIVE') RETURNING id`,
        [student2Id, activeBookId]
      )
    ).rows[0].id;

    await db.query(`INSERT INTO public.attendance (user_id, notes) VALUES ($1, 'S1 checkin')`, [student1Id]);
    await db.query(`INSERT INTO public.attendance (user_id, notes) VALUES ($1, 'S2 checkin')`, [student2Id]);

    student1NotifId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.notifications (user_id, title, content) VALUES ($1, 'N1', 'Body 1') RETURNING id`,
        [student1Id]
      )
    ).rows[0].id;
    student2NotifId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.notifications (user_id, title, content) VALUES ($1, 'N2', 'Body 2') RETURNING id`,
        [student2Id]
      )
    ).rows[0].id;

    await db.query(
      `INSERT INTO public.audit_logs (admin_id, entity_type, action) VALUES ($1, 'system', 'seed')`,
      [superAdminId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('evaluates is_staff() and is_manager() accurately across anon, student, pending staff, student_assistant, librarian, and super_admin', async () => {
    await expectRoleFailure(db, 'anon', null, `SELECT public.is_staff()`);
    await expectRoleFailure(db, 'anon', null, `SELECT public.is_manager()`);

    const checkHelpers = async (userId: string) =>
      withRole(db, 'authenticated', userId, async (tx) => {
        const res = await tx.query<{ staff: boolean; mgr: boolean }>(
          `SELECT public.is_staff() AS staff, public.is_manager() AS mgr`
        );
        return res.rows[0];
      });

    expect(await checkHelpers(student1Id)).toEqual({ staff: false, mgr: false });
    expect(await checkHelpers(pendingLibrarianId)).toEqual({ staff: false, mgr: false });
    expect(await checkHelpers(saId)).toEqual({ staff: true, mgr: false });
    expect(await checkHelpers(librarianId)).toEqual({ staff: true, mgr: true });
    expect(await checkHelpers(superAdminId)).toEqual({ staff: true, mgr: true });
  });

  it('enforces sensitive RPC EXECUTE revocations and demo_accounts isolation', async () => {
    for (const fnCall of [
      `SELECT public.process_qr_checkout('${librarianId}', 'X', 'Y', NULL, true)`,
      `SELECT public.process_qr_return('${librarianId}', 'Y', NULL, true)`,
      `SELECT public.release_copy('${copyAvailableId}')`,
      `SELECT public.compress_reservation_queue('${activeBookId}')`,
      `SELECT public.auto_checkout_forgotten_attendance()`,
      `SELECT public.transfer_super_admin_ownership('${superAdminId}', '${librarianId}')`,
    ]) {
      await expectRoleFailure(db, 'anon', null, fnCall);
      await expectRoleFailure(db, 'authenticated', student1Id, fnCall);
    }

    await expectRoleFailure(db, 'anon', null, `SELECT public.create_reservation_atomic('${student1Id}', '${activeBookId}')`);
    await expectRoleFailure(db, 'anon', null, `SELECT * FROM public.get_borrowing_history_v2()`);
    await expectRoleFailure(db, 'anon', null, `SELECT public.annual_student_reset()`);
    await expectRoleFailure(db, 'anon', null, `SELECT public.get_analytics_summary('7d')`);
    await expectRoleFailure(db, 'anon', null, `SELECT * FROM public.demo_accounts`);
    await expectRoleFailure(db, 'authenticated', superAdminId, `SELECT * FROM public.demo_accounts`);
  });

  it('enforces profiles RLS and fn_guard_profile_updates across all roles', async () => {
    // anon sees 0 rows
    const anonRows = await withRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.profiles`));
    expect(anonRows.rows).toHaveLength(0);

    // student sees only self, cannot view other student, can update own phone, cannot escalate role/status/permissions/student_id
    const s1Rows = await withRole(db, 'authenticated', student1Id, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.profiles`));
    expect(s1Rows.rows.map((r) => r.id)).toEqual([student1Id]);

    await withRole(db, 'authenticated', student1Id, async (tx) => {
      await tx.query(`UPDATE public.profiles SET phone = '09171234567' WHERE id = $1`, [student1Id]);
    });
    const updatedPhone = await db.query<{ phone: string }>(`SELECT phone FROM public.profiles WHERE id = $1`, [student1Id]);
    expect(updatedPhone.rows[0].phone).toBe('09171234567');

    await expectRoleFailure(db, 'authenticated', student1Id, `UPDATE public.profiles SET role = 'librarian' WHERE id = $1`, [student1Id]);
    await expectRoleFailure(db, 'authenticated', student1Id, `UPDATE public.profiles SET status = 'SUSPENDED' WHERE id = $1`, [student1Id]);
    await expectRoleFailure(db, 'authenticated', student1Id, `UPDATE public.profiles SET student_id = 'STU-999999' WHERE id = $1`, [student1Id]);

    // student cannot update another student's row (0 rows affected)
    const s1UpdateOther = await withRole(db, 'authenticated', student1Id, (tx) =>
      tx.query(`UPDATE public.profiles SET phone = 'hack' WHERE id = $1 RETURNING id`, [student2Id])
    );
    expect(s1UpdateOther.rows).toHaveLength(0);

    // student_assistant sees all profiles, cannot update others
    const saViewAll = await withRole(db, 'authenticated', saId, (tx) => tx.query(`SELECT id FROM public.profiles`));
    expect(saViewAll.rows).toHaveLength(6);
    const saUpdateOther = await withRole(db, 'authenticated', saId, (tx) =>
      tx.query(`UPDATE public.profiles SET status = 'SUSPENDED' WHERE id = $1 RETURNING id`, [student1Id])
    );
    expect(saUpdateOther.rows).toHaveLength(0);

    // librarian can update student status/student_id, cannot change role, permissions, or edit super_admin
    await withRole(db, 'authenticated', librarianId, async (tx) => {
      await tx.query(`UPDATE public.profiles SET status = 'SUSPENDED' WHERE id = $1`, [student2Id]);
      await tx.query(`UPDATE public.profiles SET status = 'ACTIVE' WHERE id = $1`, [student2Id]);
    });
    await expectRoleFailure(db, 'authenticated', librarianId, `UPDATE public.profiles SET role = 'librarian' WHERE id = $1`, [student2Id]);
    await expectRoleFailure(db, 'authenticated', librarianId, `UPDATE public.profiles SET permissions = '{"x":true}'::jsonb WHERE id = $1`, [student2Id]);
    await expectRoleFailure(db, 'authenticated', librarianId, `UPDATE public.profiles SET full_name = 'No' WHERE id = $1`, [superAdminId]);

    // super_admin can change another user's role/permissions, cannot change own role/status directly
    await expectRoleFailure(db, 'authenticated', superAdminId, `UPDATE public.profiles SET role = 'librarian' WHERE id = $1`, [superAdminId]);
    await expectRoleFailure(db, 'authenticated', superAdminId, `UPDATE public.profiles SET status = 'SUSPENDED' WHERE id = $1`, [superAdminId]);
    await withRole(db, 'authenticated', superAdminId, async (tx) => {
      await tx.query(`UPDATE public.profiles SET permissions = '{"manage_circulation":true}'::jsonb WHERE id = $1`, [saId]);
    });

    // service_role sees all and bypasses trigger JWT checks
    const srvRows = await withRole(db, 'service_role', null, (tx) => tx.query(`SELECT id FROM public.profiles`));
    expect(srvRows.rows).toHaveLength(6);
  });

  it('enforces books, book_copies, and categories RLS across all roles', async () => {
    // anon & student see active books only, all book_copies, all categories; cannot write
    for (const [role, uid] of [['anon', null], ['authenticated', student1Id]] as const) {
      const booksRes = await withRole(db, role, uid, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.books`));
      expect(booksRes.rows.map((r) => r.id)).toEqual([activeBookId]);

      const copiesRes = await withRole(db, role, uid, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.book_copies`));
      expect(copiesRes.rows.length).toBeGreaterThanOrEqual(2);

      const catsRes = await withRole(db, role, uid, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.categories`));
      expect(catsRes.rows).toHaveLength(1);

      await expectRoleFailure(db, role, uid, `INSERT INTO public.books (title, author) VALUES ('X', 'Y')`);
      await expectRoleFailure(db, role, uid, `INSERT INTO public.book_copies (book_id) VALUES ($1)`, [activeBookId]);
      await expectRoleFailure(db, role, uid, `INSERT INTO public.categories (name, slug) VALUES ('X', 'x')`);
    }

    // student_assistant sees inactive books too, can insert/update books & categories, CANNOT delete books/categories or write book_copies
    const saBooks = await withRole(db, 'authenticated', saId, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.books`));
    expect(saBooks.rows).toHaveLength(2);

    const saInsertedBook = await withRole(db, 'authenticated', saId, (tx) =>
      tx.query<{ id: string }>(`INSERT INTO public.books (title, author) VALUES ('SA Book', 'SA') RETURNING id`)
    );
    expect(saInsertedBook.rows[0].id).toBeTruthy();

    const saDelBook = await withRole(db, 'authenticated', saId, (tx) =>
      tx.query(`DELETE FROM public.books WHERE id = $1 RETURNING id`, [saInsertedBook.rows[0].id])
    );
    expect(saDelBook.rows).toHaveLength(0);

    await expectRoleFailure(db, 'authenticated', saId, `INSERT INTO public.book_copies (book_id) VALUES ($1)`, [activeBookId]);
    const saUpdCopy = await withRole(db, 'authenticated', saId, (tx) =>
      tx.query(`UPDATE public.book_copies SET condition = 'Worn' WHERE id = $1 RETURNING id`, [copyAvailableId])
    );
    expect(saUpdCopy.rows).toHaveLength(0);

    // librarian & super_admin can insert/update/delete books, book_copies, categories
    const libCopy = await withRole(db, 'authenticated', librarianId, (tx) =>
      tx.query<{ id: string }>(`INSERT INTO public.book_copies (book_id) VALUES ($1) RETURNING id`, [activeBookId])
    );
    await withRole(db, 'authenticated', superAdminId, (tx) =>
      tx.query(`DELETE FROM public.book_copies WHERE id = $1`, [libCopy.rows[0].id])
    );
    await withRole(db, 'authenticated', librarianId, (tx) =>
      tx.query(`DELETE FROM public.books WHERE id = $1`, [saInsertedBook.rows[0].id])
    );

    const libCat = await withRole(db, 'authenticated', librarianId, (tx) =>
      tx.query<{ id: string }>(`INSERT INTO public.categories (name, slug) VALUES ('History', 'history') RETURNING id`)
    );
    await withRole(db, 'authenticated', superAdminId, (tx) =>
      tx.query(`DELETE FROM public.categories WHERE id = $1`, [libCat.rows[0].id])
    );
  });

  it('enforces borrowing_records and reservations RLS across all roles', async () => {
    // anon sees 0 rows
    expect((await withRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.borrowing_records`))).rows).toHaveLength(0);
    expect((await withRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.reservations`))).rows).toHaveLength(0);

    // student sees own rows only, cannot insert/update/delete
    const s1Borrows = await withRole(db, 'authenticated', student1Id, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.borrowing_records`));
    expect(s1Borrows.rows.map((r) => r.id)).toEqual([student1BorrowId]);
    const s1Res = await withRole(db, 'authenticated', student1Id, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.reservations`));
    expect(s1Res.rows.map((r) => r.id)).toEqual([student1ResId]);

    await expectRoleFailure(
      db,
      'authenticated',
      student1Id,
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date) VALUES ($1, $2, NOW() + interval '1 day')`,
      [student1Id, copyAvailableId]
    );
    await expectRoleFailure(
      db,
      'authenticated',
      student1Id,
      `INSERT INTO public.reservations (user_id, book_id, queue_position) VALUES ($1, $2, 3)`,
      [student1Id, inactiveBookId]
    );

    // student_assistant sees all rows, CANNOT insert or update directly
    const saBorrows = await withRole(db, 'authenticated', saId, (tx) => tx.query(`SELECT id FROM public.borrowing_records`));
    expect(saBorrows.rows).toHaveLength(2);
    const saRes = await withRole(db, 'authenticated', saId, (tx) => tx.query(`SELECT id FROM public.reservations`));
    expect(saRes.rows).toHaveLength(2);

    await expectRoleFailure(
      db,
      'authenticated',
      saId,
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date) VALUES ($1, $2, NOW() + interval '1 day')`,
      [student1Id, copyAvailableId]
    );
    await expectRoleFailure(
      db,
      'authenticated',
      saId,
      `INSERT INTO public.reservations (user_id, book_id, queue_position) VALUES ($1, $2, 3)`,
      [student1Id, inactiveBookId]
    );

    // librarian & super_admin can insert/update borrowing_records & manage reservations
    const libBorrow = await withRole(db, 'authenticated', librarianId, (tx) =>
      tx.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status)
         VALUES ($1, $2, NOW() + interval '5 days', 'RETURNED') RETURNING id`,
        [student2Id, copyAvailableId]
      )
    );
    await withRole(db, 'authenticated', superAdminId, (tx) =>
      tx.query(`UPDATE public.borrowing_records SET returned_at = NOW() WHERE id = $1`, [libBorrow.rows[0].id])
    );

    const libRes = await withRole(db, 'authenticated', librarianId, (tx) =>
      tx.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status)
         VALUES ($1, $2, 1, 'CANCELLED') RETURNING id`,
        [student2Id, inactiveBookId]
      )
    );
    await withRole(db, 'authenticated', superAdminId, (tx) =>
      tx.query(`DELETE FROM public.reservations WHERE id = $1`, [libRes.rows[0].id])
    );

    // clean up test borrow row
    await db.query(`DELETE FROM public.borrowing_records WHERE id = $1`, [libBorrow.rows[0].id]);
    expect(student2BorrowId).toBeTruthy();
    expect(student2ResId).toBeTruthy();
  });

  it('enforces attendance, notifications, audit_logs, system_settings, library_cards & ui_preferences RLS', async () => {
    // attendance: anon denied; student sees own only & cannot insert/update; all active staff see all & can insert/update
    expect((await withRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.attendance`))).rows).toHaveLength(0);
    const s1Att = await withRole(db, 'authenticated', student1Id, (tx) => tx.query<{ user_id: string }>(`SELECT user_id FROM public.attendance`));
    expect(s1Att.rows).toHaveLength(1);
    expect(s1Att.rows[0].user_id).toBe(student1Id);
    await expectRoleFailure(db, 'authenticated', student1Id, `INSERT INTO public.attendance (user_id) VALUES ($1)`, [student1Id]);
    const s1UpdAtt = await withRole(db, 'authenticated', student1Id, (tx) =>
      tx.query(`UPDATE public.attendance SET notes = 'self' WHERE user_id = $1 RETURNING id`, [student1Id])
    );
    expect(s1UpdAtt.rows).toHaveLength(0);

    const saAtt = await withRole(db, 'authenticated', saId, (tx) => tx.query(`SELECT id FROM public.attendance`));
    expect(saAtt.rows).toHaveLength(2);
    await withRole(db, 'authenticated', saId, async (tx) => {
      const ins = await tx.query<{ id: string }>(`INSERT INTO public.attendance (user_id) VALUES ($1) RETURNING id`, [saId]);
      await tx.query(`UPDATE public.attendance SET check_out_at = NOW() WHERE id = $1`, [ins.rows[0].id]);
    });

    // notifications: users only see and update their own; cannot insert directly
    expect((await withRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.notifications`))).rows).toHaveLength(0);
    const s1Notifs = await withRole(db, 'authenticated', student1Id, (tx) => tx.query<{ id: string }>(`SELECT id FROM public.notifications`));
    expect(s1Notifs.rows.map((r) => r.id)).toEqual([student1NotifId]);
    await withRole(db, 'authenticated', student1Id, (tx) =>
      tx.query(`UPDATE public.notifications SET is_read = true WHERE id = $1`, [student1NotifId])
    );
    const s1UpdOtherNotif = await withRole(db, 'authenticated', student1Id, (tx) =>
      tx.query(`UPDATE public.notifications SET is_read = true WHERE id = $1 RETURNING id`, [student2NotifId])
    );
    expect(s1UpdOtherNotif.rows).toHaveLength(0);
    await expectRoleFailure(
      db,
      'authenticated',
      librarianId,
      `INSERT INTO public.notifications (user_id, title, content) VALUES ($1, 'X', 'Y')`,
      [student1Id]
    );

    // audit_logs: anon & student see 0 rows; staff see all; nobody in authenticated can insert directly; service_role can insert
    expect((await withRole(db, 'anon', null, (tx) => tx.query(`SELECT id FROM public.audit_logs`))).rows).toHaveLength(0);
    expect((await withRole(db, 'authenticated', student1Id, (tx) => tx.query(`SELECT id FROM public.audit_logs`))).rows).toHaveLength(0);
    expect((await withRole(db, 'authenticated', saId, (tx) => tx.query(`SELECT id FROM public.audit_logs`))).rows).toHaveLength(1);
    await expectRoleFailure(
      db,
      'authenticated',
      superAdminId,
      `INSERT INTO public.audit_logs (entity_type, action) VALUES ('book', 'test')`
    );
    await withRole(db, 'service_role', null, (tx) =>
      tx.query(`INSERT INTO public.audit_logs (entity_type, action) VALUES ('book', 'srv')`)
    );

    // system_settings: everyone reads; anon/student/student_assistant cannot write; librarian & super_admin can write
    expect((await withRole(db, 'anon', null, (tx) => tx.query(`SELECT key FROM public.system_settings`))).rows.length).toBeGreaterThanOrEqual(4);
    await expectRoleFailure(db, 'anon', null, `INSERT INTO public.system_settings (key, value) VALUES ('blocked', '1')`);
    await expectRoleFailure(db, 'authenticated', student1Id, `INSERT INTO public.system_settings (key, value) VALUES ('blocked', '1')`);
    await expectRoleFailure(db, 'authenticated', saId, `INSERT INTO public.system_settings (key, value) VALUES ('blocked', '1')`);
    for (const [role, uid] of [['anon', null], ['authenticated', student1Id], ['authenticated', saId]] as const) {
      const upd = await withRole(db, role, uid, (tx) =>
        tx.query(`UPDATE public.system_settings SET value = '99' WHERE key = 'max_borrow_limit' RETURNING key`)
      );
      expect(upd.rows).toHaveLength(0);
    }
    await withRole(db, 'authenticated', librarianId, (tx) =>
      tx.query(`UPDATE public.system_settings SET value = '6' WHERE key = 'max_borrow_limit'`)
    );
    await withRole(db, 'authenticated', superAdminId, (tx) =>
      tx.query(`UPDATE public.system_settings SET value = '5' WHERE key = 'max_borrow_limit'`)
    );

    // library_cards: student sees own only; staff sees all
    const s1Card = await withRole(db, 'authenticated', student1Id, (tx) => tx.query<{ user_id: string }>(`SELECT user_id FROM public.library_cards`));
    expect(s1Card.rows.map((r) => r.user_id)).toEqual([student1Id]);
    const saCards = await withRole(db, 'authenticated', saId, (tx) => tx.query(`SELECT user_id FROM public.library_cards`));
    expect(saCards.rows).toHaveLength(6);

    // ui_preferences: user owns own preferences only
    await withRole(db, 'authenticated', student1Id, (tx) =>
      tx.query(`INSERT INTO public.ui_preferences (user_id, preferences) VALUES ($1, '{"theme":"dark"}'::jsonb)`, [student1Id])
    );
    const s2Prefs = await withRole(db, 'authenticated', student2Id, (tx) => tx.query(`SELECT id FROM public.ui_preferences`));
    expect(s2Prefs.rows).toHaveLength(0);
  });

  it('enforces idempotency tables and storage.objects RLS policies across buckets and roles', async () => {
    // Idempotency tables: staff can manage; student & anon denied
    await expectRoleFailure(
      db,
      'authenticated',
      student1Id,
      `INSERT INTO public.checkout_idempotency (idempotency_key, response) VALUES ('k1', '{}'::jsonb)`
    );
    await withRole(db, 'authenticated', saId, (tx) =>
      tx.query(`INSERT INTO public.checkout_idempotency (idempotency_key, response) VALUES ('k1', '{"ok":true}'::jsonb)`)
    );
    expect((await withRole(db, 'authenticated', student1Id, (tx) => tx.query(`SELECT id FROM public.checkout_idempotency`))).rows).toHaveLength(0);

    // Storage buckets seeded properly
    const buckets = await db.query<{ id: string; public: boolean }>(`SELECT id, public FROM storage.buckets ORDER BY id`);
    expect(buckets.rows).toEqual([
      { id: 'avatars', public: true },
      { id: 'book-covers', public: true },
      { id: 'library-cards', public: false },
    ]);

    // Avatars: student can insert into own folder only
    await withRole(db, 'authenticated', student1Id, (tx) =>
      tx.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', $1)`, [`${student1Id}/me.png`])
    );
    await expectRoleFailure(
      db,
      'authenticated',
      student1Id,
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', $1)`,
      [`${student2Id}/other.png`]
    );

    // Book covers: staff can insert; student cannot
    await expectRoleFailure(
      db,
      'authenticated',
      student1Id,
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('book-covers', 'cover.png')`
    );
    await withRole(db, 'authenticated', saId, (tx) =>
      tx.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('book-covers', 'cover.png')`)
    );

    // Library cards: staff inserts; owner or staff can select, other students and anon cannot
    await withRole(db, 'authenticated', saId, (tx) =>
      tx.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('library-cards', $1), ('library-cards', $2)`, [
        `${student1Id}/card.png`,
        `${student2Id}/card.png`,
      ])
    );
    const anonStorage = await withRole(db, 'anon', null, (tx) => tx.query<{ bucket_id: string }>(`SELECT bucket_id FROM storage.objects`));
    expect(anonStorage.rows.every((r) => r.bucket_id !== 'library-cards')).toBe(true);

    const s1CardsStorage = await withRole(db, 'authenticated', student1Id, (tx) =>
      tx.query<{ name: string }>(`SELECT name FROM storage.objects WHERE bucket_id = 'library-cards'`)
    );
    expect(s1CardsStorage.rows.map((r) => r.name)).toEqual([`${student1Id}/card.png`]);
  });
});
