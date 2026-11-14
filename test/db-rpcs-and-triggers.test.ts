// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { isValidPolicyValue } from '@/lib/actions/policy-constants';

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

async function createUser(
  db: PGlite,
  opts: {
    email: string;
    fullName: string;
    role?: 'super_admin' | 'librarian' | 'student_assistant' | 'student';
    status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
    cardStatus?: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  }
): Promise<{ id: string; cardNumber: string; studentId: string | null }> {
  const userRes = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, $2::jsonb)
     RETURNING id`,
    [opts.email, JSON.stringify({ full_name: opts.fullName })]
  );
  const id = userRes.rows[0].id;

  if (opts.role) {
    await db.query(`UPDATE public.profiles SET role = $1::public.user_role WHERE id = $2`, [opts.role, id]);
  }
  if (opts.status) {
    await db.query(`UPDATE public.profiles SET status = $1 WHERE id = $2`, [opts.status, id]);
  }
  if (opts.cardStatus) {
    await db.query(`UPDATE public.library_cards SET status = $1 WHERE user_id = $2`, [opts.cardStatus, id]);
  }

  const infoRes = await db.query<{ card_number: string; student_id: string | null }>(
    `SELECT lc.card_number, p.student_id
     FROM public.library_cards lc
     JOIN public.profiles p ON p.id = lc.user_id
     WHERE p.id = $1`,
    [id]
  );

  return {
    id,
    cardNumber: infoRes.rows[0].card_number,
    studentId: infoRes.rows[0].student_id,
  };
}

async function createBookWithCopies(
  db: PGlite,
  opts: {
    title: string;
    author?: string;
    isbn?: string;
    categoryId?: string | null;
    section?: string | null;
    isActive?: boolean;
    copyStatuses?: Array<'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST' | 'RESERVED'>;
  }
): Promise<{ bookId: string; copies: Array<{ id: string; qr: string; accession: string }> }> {
  const bookRes = await db.query<{ id: string }>(
    `INSERT INTO public.books (title, author, isbn, category_id, section, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      opts.title,
      opts.author ?? 'Default Author',
      opts.isbn ?? null,
      opts.categoryId ?? null,
      opts.section ?? null,
      opts.isActive ?? true,
    ]
  );
  const bookId = bookRes.rows[0].id;
  const copies: Array<{ id: string; qr: string; accession: string }> = [];

  for (const st of opts.copyStatuses ?? ['AVAILABLE']) {
    const cRes = await db.query<{ id: string; qr_string: string; accession_number: string }>(
      `INSERT INTO public.book_copies (book_id, status)
       VALUES ($1, $2)
       RETURNING id, qr_string, accession_number`,
      [bookId, st]
    );
    copies.push({
      id: cRes.rows[0].id,
      qr: cRes.rows[0].qr_string,
      accession: cRes.rows[0].accession_number,
    });
  }

  return { bookId, copies };
}

describe('Circulation RPCs: process_qr_checkout, process_qr_return & release_copy', () => {
  let db: PGlite;
  let admin: { id: string; cardNumber: string };
  let librarian: { id: string; cardNumber: string };
  let student1: { id: string; cardNumber: string };
  let student2: { id: string; cardNumber: string };
  let pendingStudent: { id: string; cardNumber: string };

  beforeEach(async () => {
    db = await bootLuminaDb();
    admin = await createUser(db, { email: 'admin@alabang.sti.edu.ph', fullName: 'Admin User' });
    librarian = await createUser(db, {
      email: 'lib@alabang.sti.edu.ph',
      fullName: 'Librarian User',
      role: 'librarian',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    student1 = await createUser(db, {
      email: 'juan.111111@alabang.sti.edu.ph',
      fullName: 'Juan Dela Cruz',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    student2 = await createUser(db, {
      email: 'maria.222222@alabang.sti.edu.ph',
      fullName: 'Maria Clara',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    pendingStudent = await createUser(db, {
      email: 'pending.333333@alabang.sti.edu.ph',
      fullName: 'Pending Patron',
      status: 'PENDING',
      cardStatus: 'PENDING',
    });
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('process_qr_checkout supports previewOnly without mutating state, then commits checkout and updates counts', async () => {
    const { bookId, copies } = await createBookWithCopies(db, {
      title: 'Design Patterns',
      copyStatuses: ['AVAILABLE'],
    });

    const preview = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, $4, true) AS res`,
      [librarian.id, student1.cardNumber, copies[0].qr, 'key-preview']
    );
    expect(preview.rows[0].res).toMatchObject({
      ok: true,
      preview: true,
      student_name: 'Juan Dela Cruz',
      book_title: 'Design Patterns',
    });
    expect(preview.rows[0].res.due_date).toBeTruthy();

    // Verify preview did not mutate copy, book counts, borrowing_records, or idempotency table
    const copyAfterPreview = await db.query<{ status: string }>(`SELECT status FROM public.book_copies WHERE id = $1`, [copies[0].id]);
    expect(copyAfterPreview.rows[0].status).toBe('AVAILABLE');
    expect((await db.query(`SELECT id FROM public.borrowing_records`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT id FROM public.checkout_idempotency`)).rows).toHaveLength(0);

    // Commit checkout
    const commit = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, $4, false) AS res`,
      [librarian.id, student1.cardNumber, copies[0].qr, 'key-commit-1']
    );
    expect(commit.rows[0].res).toMatchObject({
      ok: true,
      student_name: 'Juan Dela Cruz',
      book_title: 'Design Patterns',
    });
    const borrowingId = commit.rows[0].res.borrowing_id as string;
    expect(borrowingId).toBeTruthy();

    const copyAfterCommit = await db.query<{ status: string }>(`SELECT status FROM public.book_copies WHERE id = $1`, [copies[0].id]);
    expect(copyAfterCommit.rows[0].status).toBe('BORROWED');

    const bookAfterCommit = await db.query<{ available_copies: number }>(`SELECT available_copies FROM public.books WHERE id = $1`, [bookId]);
    expect(bookAfterCommit.rows[0].available_copies).toBe(0);

    const recordRes = await db.query<{ status: string; processed_by: string; days_diff: number }>(
      `SELECT status::text, processed_by, ROUND(EXTRACT(EPOCH FROM (due_date - borrowed_at)) / 86400)::int AS days_diff
       FROM public.borrowing_records WHERE id = $1`,
      [borrowingId]
    );
    expect(recordRes.rows[0]).toEqual({
      status: 'ACTIVE',
      processed_by: librarian.id,
      days_diff: 14,
    });

    // Idempotency deduplication returns same response + idempotent: true without duplicate borrow
    const replay = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, $4, false) AS res`,
      [librarian.id, student1.cardNumber, copies[0].qr, 'key-commit-1']
    );
    expect(replay.rows[0].res).toMatchObject({
      ok: true,
      borrowing_id: borrowingId,
      idempotent: true,
    });
    expect((await db.query(`SELECT id FROM public.borrowing_records`)).rows).toHaveLength(1);
  });

  it('process_qr_checkout enforces borrow limit (including OVERDUE loans), non-ACTIVE card/profile, and non-AVAILABLE copies', async () => {
    await db.query(`UPDATE public.system_settings SET value = '2' WHERE key = 'max_borrow_limit'`);
    const { copies } = await createBookWithCopies(db, {
      title: 'Concurrency Book',
      copyStatuses: ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'MAINTENANCE', 'LOST'],
    });

    // 1 active + 1 overdue + 1 returned = 2 active loans toward limit
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status)
       VALUES ($1, $2, NOW() + interval '5 days', 'ACTIVE')`,
      [student1.id, copies[0].id]
    );
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
       VALUES ($1, $2, NOW() - interval '10 days', NOW() - interval '2 days', 'OVERDUE')`,
      [student1.id, copies[1].id]
    );
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status)
       VALUES ($1, $2, NOW() - interval '20 days', NOW() - interval '10 days', NOW() - interval '12 days', 'RETURNED')`,
      [student1.id, copies[2].id]
    );

    const limitRes = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, student1.cardNumber, copies[2].qr]
    );
    expect(limitRes.rows[0].res).toMatchObject({ ok: false, code: 'LIMIT_EXCEEDED' });

    // Non-AVAILABLE copy checks (for student2 who has 0 loans)
    const maintRes = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, student2.cardNumber, copies[3].qr]
    );
    expect(maintRes.rows[0].res).toMatchObject({ ok: false, code: 'COPY_UNAVAILABLE' });

    const lostRes = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, student2.cardNumber, copies[4].qr]
    );
    expect(lostRes.rows[0].res).toMatchObject({ ok: false, code: 'COPY_UNAVAILABLE' });

    const missingCopyRes = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, 'QR-DOES-NOT-EXIST', NULL, false) AS res`,
      [librarian.id, student2.cardNumber]
    );
    expect(missingCopyRes.rows[0].res).toMatchObject({ ok: false, code: 'COPY_NOT_FOUND' });

    // Non-ACTIVE card / account / unknown card
    const badCardRes = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, 'LIB-UNKNOWN', $2, NULL, false) AS res`,
      [librarian.id, copies[2].qr]
    );
    expect(badCardRes.rows[0].res).toMatchObject({ ok: false, code: 'CARD_NOT_FOUND' });

    const inactiveCardRes = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, pendingStudent.cardNumber, copies[2].qr]
    );
    expect(inactiveCardRes.rows[0].res).toMatchObject({ ok: false, code: 'CARD_INACTIVE' });

    // Activate card while keeping profile PENDING -> ACCOUNT_INACTIVE
    await db.query(`UPDATE public.library_cards SET status = 'ACTIVE' WHERE user_id = $1`, [pendingStudent.id]);
    const inactiveAccRes = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, pendingStudent.cardNumber, copies[2].qr]
    );
    expect(inactiveAccRes.rows[0].res).toMatchObject({ ok: false, code: 'ACCOUNT_INACTIVE' });
  });

  it('process_qr_checkout fulfills caller READY reservation and blocks other patrons from checking out a RESERVED copy', async () => {
    const { bookId, copies } = await createBookWithCopies(db, {
      title: 'Reserved Book',
      copyStatuses: ['AVAILABLE'],
    });

    // Student1 reserves the available copy -> becomes READY & copy becomes RESERVED
    const rsv = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2) AS res`,
        [student1.id, bookId]
      )
    );
    expect(rsv.rows[0].res).toMatchObject({ ok: true, status: 'READY', copy_id: copies[0].id });

    // Student2 cannot check out the reserved copy
    const blocked = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, student2.cardNumber, copies[0].qr]
    );
    expect(blocked.rows[0].res).toMatchObject({ ok: false, code: 'COPY_UNAVAILABLE' });

    // Student1 checks out their READY copy -> reservation becomes FULFILLED
    const fulfilled = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, student1.cardNumber, copies[0].qr]
    );
    expect(fulfilled.rows[0].res).toMatchObject({ ok: true });

    const rsvRow = await db.query<{ status: string }>(`SELECT status::text FROM public.reservations WHERE id = $1`, [
      rsv.rows[0].res.reservation_id,
    ]);
    expect(rsvRow.rows[0].status).toBe('FULFILLED');
  });

  it('process_qr_checkout accepts all valid loan_period_days and max_borrow_limit policy bounds', async () => {
    const { copies } = await createBookWithCopies(db, { title: 'Policy Test', copyStatuses: ['AVAILABLE', 'AVAILABLE'] });

    for (const days of ['1', '90']) {
      expect(isValidPolicyValue('loan_period_days', days)).toBe(true);
      await db.query(`UPDATE public.system_settings SET value = $1 WHERE key = 'loan_period_days'`, [days]);
      const res = await db.query<{ res: Record<string, unknown> }>(
        `SELECT public.process_qr_checkout($1, $2, $3, NULL, true) AS res`,
        [librarian.id, student1.cardNumber, copies[0].qr]
      );
      expect(res.rows[0].res.ok).toBe(true);
    }

    expect(isValidPolicyValue('max_borrow_limit', '1')).toBe(true);
    expect(isValidPolicyValue('max_borrow_limit', '20')).toBe(true);
    await db.query(`UPDATE public.system_settings SET value = '1' WHERE key = 'max_borrow_limit'`);
    await db.query(`SELECT public.process_qr_checkout($1, $2, $3, NULL, false)`, [librarian.id, student1.cardNumber, copies[0].qr]);
    const blocked = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, student1.cardNumber, copies[1].qr]
    );
    expect(blocked.rows[0].res).toMatchObject({ ok: false, code: 'LIMIT_EXCEEDED' });
  });

  it('process_qr_return handles preview, on-time return, Asia/Manila overdue calculation, and fine_amount snapshot immutability', async () => {
    const { copies } = await createBookWithCopies(db, {
      title: 'Overdue Calc Book',
      copyStatuses: ['BORROWED', 'BORROWED'],
    });

    // Copy 0: On-time return
    const onTimeBorrowId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES ($1, $2, NOW() - interval '2 days', NOW() + interval '5 days', 'ACTIVE') RETURNING id`,
        [student1.id, copies[0].id]
      )
    ).rows[0].id;

    const onTimePrev = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, NULL, true) AS res`,
      [librarian.id, copies[0].qr]
    );
    expect(onTimePrev.rows[0].res).toMatchObject({
      ok: true,
      preview: true,
      borrowing_id: onTimeBorrowId,
      fine_amount: 0,
      overdue_days: 0,
    });

    const onTimeCommit = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, 'ret-ontime', false) AS res`,
      [librarian.id, copies[0].qr]
    );
    expect(onTimeCommit.rows[0].res).toMatchObject({
      ok: true,
      borrowing_id: onTimeBorrowId,
      fine_amount: 0,
      overdue_days: 0,
      reservation_ready: false,
    });

    // Copy 1: Overdue using Asia/Manila calendar day boundary (00:30 Manila = 16:30 UTC previous day, still exactly 3 Manila days ago)
    await db.query(`UPDATE public.system_settings SET value = '10' WHERE key = 'overdue_fine_per_day'`);
    const overdueBorrowId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES (
           $1,
           $2,
           NOW() - interval '20 days',
           (((NOW() AT TIME ZONE 'Asia/Manila')::date - 3) + time '00:30:00') AT TIME ZONE 'Asia/Manila',
           'ACTIVE'
         )
         RETURNING id`,
        [student2.id, copies[1].id]
      )
    ).rows[0].id;

    const overduePrev = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, NULL, true) AS res`,
      [librarian.id, copies[1].qr]
    );
    expect(overduePrev.rows[0].res).toMatchObject({
      ok: true,
      preview: true,
      borrowing_id: overdueBorrowId,
      overdue_days: 3,
      fine_amount: 30,
    });

    const overdueCommit = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, 'ret-overdue', false) AS res`,
      [librarian.id, copies[1].qr]
    );
    expect(overdueCommit.rows[0].res).toMatchObject({
      ok: true,
      borrowing_id: overdueBorrowId,
      overdue_days: 3,
      fine_amount: 30,
    });

    // Later rate change in system_settings does NOT alter snapshotted fine_amount
    await db.query(`UPDATE public.system_settings SET value = '50' WHERE key = 'overdue_fine_per_day'`);
    const persisted = await db.query<{ fine_amount: string; status: string }>(
      `SELECT fine_amount::text, status::text FROM public.borrowing_records WHERE id = $1`,
      [overdueBorrowId]
    );
    expect(persisted.rows[0]).toEqual({ fine_amount: '30.00', status: 'RETURNED' });

    // Idempotency replay returns cached response with idempotent: true
    const replay = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, 'ret-overdue', false) AS res`,
      [librarian.id, copies[1].qr]
    );
    expect(replay.rows[0].res).toMatchObject({
      ok: true,
      borrowing_id: overdueBorrowId,
      fine_amount: 30,
      idempotent: true,
    });
  });

  it('process_qr_return recovers orphaned BORROWED copies, rejects non-borrowed copies, and promotes oldest queued reservation via release_copy', async () => {
    const { bookId, copies } = await createBookWithCopies(db, {
      title: 'Queue Promotion Book',
      copyStatuses: ['BORROWED', 'BORROWED', 'AVAILABLE', 'MAINTENANCE'],
    });

    // Copy 2 is AVAILABLE -> NOT_BORROWED
    const availErr = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, NULL, false) AS res`,
      [librarian.id, copies[2].qr]
    );
    expect(availErr.rows[0].res).toMatchObject({ ok: false, code: 'NOT_BORROWED' });

    // Copy 3 is MAINTENANCE -> NOT_BORROWED
    const maintErr = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, NULL, false) AS res`,
      [librarian.id, copies[3].qr]
    );
    expect(maintErr.rows[0].res).toMatchObject({ ok: false, code: 'NOT_BORROWED' });

    // Unknown QR -> COPY_NOT_FOUND
    const notFoundErr = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, 'QR-MISSING', NULL, false) AS res`,
      [librarian.id]
    );
    expect(notFoundErr.rows[0].res).toMatchObject({ ok: false, code: 'COPY_NOT_FOUND' });

    // Copy 0 is orphaned BORROWED (no borrowing_records row) -> preview & commit recovery
    const orphanPrev = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, NULL, true) AS res`,
      [librarian.id, copies[0].qr]
    );
    expect(orphanPrev.rows[0].res).toMatchObject({
      ok: true,
      preview: true,
      student_name: 'System Recovery (No Record)',
      fine_amount: 0,
      overdue_days: 0,
    });
    const orphanCommit = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, NULL, false) AS res`,
      [librarian.id, copies[0].qr]
    );
    expect(orphanCommit.rows[0].res).toMatchObject({ ok: true, reservation_ready: false });
    expect(
      (await db.query<{ status: string }>(`SELECT status FROM public.book_copies WHERE id = $1`, [copies[0].id])).rows[0].status
    ).toBe('AVAILABLE');

    // Queue two ACTIVE reservations on bookId (student2 pos 1, admin pos 2) and return Copy 1 (borrowed by student1)
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status)
       VALUES ($1, $2, NOW() + interval '5 days', 'ACTIVE')`,
      [student1.id, copies[1].id]
    );
    const rsvFirst = (
      await db.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status, created_at)
         VALUES ($1, $2, 1, 'ACTIVE', NOW() - interval '2 hours') RETURNING id`,
        [student2.id, bookId]
      )
    ).rows[0].id;
    const rsvSecond = (
      await db.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status, created_at)
         VALUES ($1, $2, 2, 'ACTIVE', NOW() - interval '1 hour') RETURNING id`,
        [admin.id, bookId]
      )
    ).rows[0].id;

    const retPromoted = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_return($1, $2, NULL, false) AS res`,
      [librarian.id, copies[1].qr]
    );
    expect(retPromoted.rows[0].res).toMatchObject({
      ok: true,
      reservation_ready: true,
      reserved_for: 'Maria Clara',
    });

    // Verify copy became RESERVED, oldest queued reservation became READY with copy_id & hold_expires_at, and second compressed to queue_position 1
    expect(
      (await db.query<{ status: string }>(`SELECT status FROM public.book_copies WHERE id = $1`, [copies[1].id])).rows[0].status
    ).toBe('RESERVED');

    const promotedRow = await db.query<{ status: string; copy_id: string; hold_expires_at: string | null }>(
      `SELECT status::text, copy_id, hold_expires_at::text FROM public.reservations WHERE id = $1`,
      [rsvFirst]
    );
    expect(promotedRow.rows[0].status).toBe('READY');
    expect(promotedRow.rows[0].copy_id).toBe(copies[1].id);
    expect(promotedRow.rows[0].hold_expires_at).not.toBeNull();

    const secondRow = await db.query<{ queue_position: number; status: string }>(
      `SELECT queue_position, status::text FROM public.reservations WHERE id = $1`,
      [rsvSecond]
    );
    expect(secondRow.rows[0]).toEqual({ queue_position: 1, status: 'ACTIVE' });

    // Direct release_copy error on missing copy
    const releaseMissing = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.release_copy(gen_random_uuid()) AS res`
    );
    expect(releaseMissing.rows[0].res).toMatchObject({ ok: false, code: 'COPY_NOT_FOUND', reservation_ready: false });
  });
});

describe('get_borrowing_history_v2', () => {
  let db: PGlite;
  let sa: { id: string };
  let student1: { id: string; studentId: string | null };
  let student2: { id: string };
  let recActiveId: string;
  let recPastDueActiveId: string;
  let recOverdueStatusId: string;
  let recUnpaidLateReturnId: string;
  let recSettledLateReturnId: string;
  let recLegacyNullFineReturnId: string;
  let recLostId: string;

  beforeEach(async () => {
    db = await bootLuminaDb();
    await createUser(db, { email: 'admin@alabang.sti.edu.ph', fullName: 'Admin' });
    sa = await createUser(db, {
      email: 'sa@alabang.sti.edu.ph',
      fullName: 'Assistant',
      role: 'student_assistant',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    student1 = await createUser(db, {
      email: 'alice.100001@alabang.sti.edu.ph',
      fullName: 'Alice Reyes',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    student2 = await createUser(db, {
      email: 'bob.200002@alabang.sti.edu.ph',
      fullName: 'Bob Mendoza',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });

    const b1 = await createBookWithCopies(db, {
      title: 'Algorithms Unlocked',
      author: 'Thomas Cormen',
      isbn: '9780262518802',
      copyStatuses: ['BORROWED', 'BORROWED', 'BORROWED', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'LOST'],
    });
    const b2 = await createBookWithCopies(db, {
      title: 'Database Internals',
      author: 'Alex Petrov',
      isbn: '9781492040347',
      copyStatuses: ['AVAILABLE'],
    });

    // 1. Truly ACTIVE (due in future)
    recActiveId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES ($1, $2, '2024-03-14T10:00:00+08:00', NOW() + interval '7 days', 'ACTIVE') RETURNING id`,
        [student1.id, b1.copies[0].id]
      )
    ).rows[0].id;

    // 2. Past-due ACTIVE (status still ACTIVE, due_date < NOW(), fine_amount NULL -> live computed fine)
    recPastDueActiveId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES (
           $1, $2,
           NOW() - interval '15 days',
           (((NOW() AT TIME ZONE 'Asia/Manila')::date - 2) + time '08:00:00') AT TIME ZONE 'Asia/Manila',
           'ACTIVE'
         ) RETURNING id`,
        [student1.id, b1.copies[1].id]
      )
    ).rows[0].id;

    // 3. Explicit OVERDUE status
    recOverdueStatusId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES (
           $1, $2,
           NOW() - interval '18 days',
           (((NOW() AT TIME ZONE 'Asia/Manila')::date - 4) + time '08:00:00') AT TIME ZONE 'Asia/Manila',
           'OVERDUE'
         ) RETURNING id`,
        [student2.id, b1.copies[2].id]
      )
    ).rows[0].id;

    // 4. Returned late with unpaid fine (fine_amount = 15.00, fine_settled_at IS NULL) -> shows in OVERDUE, NOT RETURNED
    recUnpaidLateReturnId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status, fine_amount)
         VALUES ($1, $2, NOW() - interval '12 days', NOW() - interval '3 days', NOW() - interval '1 day', 'RETURNED', 15.00) RETURNING id`,
        [student1.id, b1.copies[3].id]
      )
    ).rows[0].id;

    // 5. Returned late with settled fine -> shows in RETURNED and SETTLED
    recSettledLateReturnId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status, fine_amount, fine_settled_at)
         VALUES ($1, $2, NOW() - interval '22 days', NOW() - interval '10 days', NOW() - interval '8 days', 'RETURNED', 25.00, NOW() - interval '7 days') RETURNING id`,
        [student1.id, b1.copies[4].id]
      )
    ).rows[0].id;

    // 6. Legacy closed RETURNED with fine_amount IS NULL -> shows in RETURNED at 0.00
    recLegacyNullFineReturnId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status, fine_amount)
         VALUES ($1, $2, NOW() - interval '30 days', NOW() - interval '20 days', NOW() - interval '15 days', 'RETURNED', NULL) RETURNING id`,
        [student2.id, b2.copies[0].id]
      )
    ).rows[0].id;

    // 7. LOST record
    recLostId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES ($1, $2, NOW() - interval '40 days', NOW() - interval '25 days', 'LOST') RETURNING id`,
        [student2.id, b1.copies[6].id]
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('filters statuses accurately (all, ACTIVE, OVERDUE, RETURNED, SETTLED, LOST) and computes dynamic vs legacy fines', async () => {
    const queryStatus = async (status: string | null) =>
      withRole(db, 'authenticated', sa.id, (tx) =>
        tx.query<{ id: string; fine_amount: string; total_count: string }>(
          `SELECT id, fine_amount::text, total_count::text FROM public.get_borrowing_history_v2(NULL, 1, 50, $1, NULL)`,
          [status]
        )
      );

    const allRes = await queryStatus('all');
    expect(allRes.rows).toHaveLength(7);
    expect(allRes.rows[0].total_count).toBe('7');

    // ACTIVE excludes past-due ACTIVE
    const activeRes = await queryStatus('ACTIVE');
    expect(activeRes.rows.map((r) => r.id)).toEqual([recActiveId]);
    expect(activeRes.rows[0].fine_amount).toBe('0.00');

    // OVERDUE includes status=OVERDUE, past-due ACTIVE (live fine = 2 * 5 = 10.00), and unpaid late RETURNED
    const overdueRes = await queryStatus('OVERDUE');
    const overdueMap = new Map(overdueRes.rows.map((r) => [r.id, r.fine_amount]));
    expect(Array.from(overdueMap.keys()).sort()).toEqual(
      [recPastDueActiveId, recOverdueStatusId, recUnpaidLateReturnId].sort()
    );
    expect(overdueMap.get(recPastDueActiveId)).toBe('10.00');
    expect(overdueMap.get(recOverdueStatusId)).toBe('20.00');
    expect(overdueMap.get(recUnpaidLateReturnId)).toBe('15.00');

    // RETURNED includes legacy NULL-fine return (0.00) and settled return (25.00), excluding unpaid late return
    const returnedRes = await queryStatus('RETURNED');
    const returnedMap = new Map(returnedRes.rows.map((r) => [r.id, r.fine_amount]));
    expect(Array.from(returnedMap.keys()).sort()).toEqual(
      [recLegacyNullFineReturnId, recSettledLateReturnId].sort()
    );
    expect(returnedMap.get(recLegacyNullFineReturnId)).toBe('0.00');
    expect(returnedMap.get(recSettledLateReturnId)).toBe('25.00');

    // SETTLED only returns paid fines > 0
    const settledRes = await queryStatus('SETTLED');
    expect(settledRes.rows.map((r) => r.id)).toEqual([recSettledLateReturnId]);

    // LOST returns only LOST
    const lostRes = await queryStatus('LOST');
    expect(lostRes.rows.map((r) => r.id)).toEqual([recLostId]);
  });

  it('supports pagination, search (borrower/title/ISBN/QR/dates), and patron self-scoping vs staff full view', async () => {
    // Pagination as staff
    const page1 = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string; total_count: string }>(
        `SELECT id, total_count::text FROM public.get_borrowing_history_v2(NULL, 1, 3, 'all', NULL)`
      )
    );
    const page2 = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string; total_count: string }>(
        `SELECT id, total_count::text FROM public.get_borrowing_history_v2(NULL, 2, 3, 'all', NULL)`
      )
    );
    expect(page1.rows).toHaveLength(3);
    expect(page2.rows).toHaveLength(3);
    expect(page1.rows[0].total_count).toBe('7');
    expect(new Set([...page1.rows, ...page2.rows].map((r) => r.id)).size).toBe(6);

    // Search by borrower name, ISBN, copy QR, and Asia/Manila date
    const byBorrower = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM public.get_borrowing_history_v2(NULL, 1, 10, NULL, 'Alice Reyes')`)
    );
    expect(byBorrower.rows).toHaveLength(4);

    const byIsbn = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM public.get_borrowing_history_v2(NULL, 1, 10, NULL, '9781492040347')`)
    );
    expect(byIsbn.rows.map((r) => r.id)).toEqual([recLegacyNullFineReturnId]);

    const activeQr = (
      await db.query<{ qr_string: string }>(
        `SELECT bc.qr_string FROM public.borrowing_records br JOIN public.book_copies bc ON bc.id = br.book_copy_id WHERE br.id = $1`,
        [recActiveId]
      )
    ).rows[0].qr_string;
    const byQr = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM public.get_borrowing_history_v2(NULL, 1, 10, NULL, $1)`, [activeQr])
    );
    expect(byQr.rows.map((r) => r.id)).toEqual([recActiveId]);

    const byDate = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM public.get_borrowing_history_v2(NULL, 1, 10, NULL, 'March 14, 2024')`)
    );
    expect(byDate.rows.map((r) => r.id)).toEqual([recActiveId]);

    // Patron self-scoping: student1 passing student2.id still gets ONLY student1's 4 records
    const s1Scoped = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ user_id: string }>(`SELECT user_id FROM public.get_borrowing_history_v2($1, 1, 50, 'all', NULL)`, [student2.id])
    );
    expect(s1Scoped.rows).toHaveLength(4);
    expect(s1Scoped.rows.every((r) => r.user_id === student1.id)).toBe(true);

    // Unauthenticated (no uid, not service_role) returns empty set
    const unauth = await db.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE authenticated`);
      await tx.query(`SELECT set_config('request.jwt.claim.sub', '', true)`);
      await tx.query(`SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true)`);
      return tx.query(`SELECT id FROM public.get_borrowing_history_v2(NULL, 1, 10, NULL, NULL)`);
    });
    expect(unauth.rows).toHaveLength(0);
  });
});

describe('Reservation, Search, Ownership Transfer, Analytics, Bulk & Cron RPCs', () => {
  let db: PGlite;
  let admin: { id: string };
  let librarian: { id: string };
  let sa: { id: string };
  let student1: { id: string };
  let student2: { id: string };
  let pendingStudent: { id: string };

  beforeEach(async () => {
    db = await bootLuminaDb();
    admin = await createUser(db, { email: 'admin@alabang.sti.edu.ph', fullName: 'Super Admin' });
    librarian = await createUser(db, {
      email: 'lib@alabang.sti.edu.ph',
      fullName: 'Head Librarian',
      role: 'librarian',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    sa = await createUser(db, {
      email: 'sa@alabang.sti.edu.ph',
      fullName: 'Student Assistant',
      role: 'student_assistant',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    student1 = await createUser(db, {
      email: 's1.100001@alabang.sti.edu.ph',
      fullName: 'Student One',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    student2 = await createUser(db, {
      email: 's2.100002@alabang.sti.edu.ph',
      fullName: 'Student Two',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });
    pendingStudent = await createUser(db, {
      email: 'p.100003@alabang.sti.edu.ph',
      fullName: 'Pending Student',
      status: 'PENDING',
      cardStatus: 'PENDING',
    });
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('create_reservation_atomic enforces auth/RBAC, duplicate/limit checks, queue ordering, and expires stale READY holds', async () => {
    const { bookId, copies } = await createBookWithCopies(db, {
      title: 'Distributed Systems',
      copyStatuses: ['AVAILABLE'],
    });
    const { bookId: book2Id } = await createBookWithCopies(db, { title: 'Compilers', copyStatuses: ['BORROWED'] });
    const { bookId: book3Id } = await createBookWithCopies(db, { title: 'OS Concepts', copyStatuses: ['BORROWED'] });
    const { bookId: book4Id } = await createBookWithCopies(db, { title: 'Networks', copyStatuses: ['BORROWED'] });

    // Mismatched actor -> UNAUTHORIZED
    const unauth = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2) AS res`,
        [student2.id, bookId]
      )
    );
    expect(unauth.rows[0].res).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });

    // Student reserving for someone else -> FORBIDDEN
    const forbid = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2, $3) AS res`,
        [student1.id, bookId, student2.id]
      )
    );
    expect(forbid.rows[0].res).toMatchObject({ ok: false, code: 'FORBIDDEN' });

    // Pending account -> ACCOUNT_INACTIVE
    const inactive = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2, $3) AS res`,
        [sa.id, bookId, pendingStudent.id]
      )
    );
    expect(inactive.rows[0].res).toMatchObject({ ok: false, code: 'ACCOUNT_INACTIVE' });

    // Student1 reserves book1 (available copy) -> READY
    const r1 = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2) AS res`,
        [student1.id, bookId]
      )
    );
    expect(r1.rows[0].res).toMatchObject({ ok: true, status: 'READY', copy_id: copies[0].id });

    // Duplicate reservation blocked
    const dup = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2) AS res`,
        [student1.id, bookId]
      )
    );
    expect(dup.rows[0].res).toMatchObject({ ok: false, code: 'DUPLICATE' });

    // Student2 reserves book1 -> queued ACTIVE pos 1
    const r2 = await withRole(db, 'authenticated', student2.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2) AS res`,
        [student2.id, bookId]
      )
    );
    expect(r2.rows[0].res).toMatchObject({ ok: true, status: 'ACTIVE', queue_position: 1 });

    // Staff reserves on behalf of student1 up to max_reservations_per_student (default 3)
    await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query(`SELECT public.create_reservation_atomic($1, $2, $3)`, [sa.id, book2Id, student1.id])
    );
    await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query(`SELECT public.create_reservation_atomic($1, $2, $3)`, [sa.id, book3Id, student1.id])
    );
    const overLimit = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2) AS res`,
        [student1.id, book4Id]
      )
    );
    expect(overLimit.rows[0].res).toMatchObject({ ok: false, code: 'RESERVATION_LIMIT' });

    // Force student1's READY hold on book1 to expire; next reservation call on book1 expires it & promotes student2 to READY
    await db.query(
      `UPDATE public.reservations
       SET reserved_at = NOW() - interval '4 days',
           hold_expires_at = NOW() - interval '1 hour'
       WHERE id = $1`,
      [r1.rows[0].res.reservation_id]
    );
    const r3 = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(
        `SELECT public.create_reservation_atomic($1, $2) AS res`,
        [admin.id, bookId]
      )
    );
    expect(r3.rows[0].res).toMatchObject({ ok: true, status: 'ACTIVE', queue_position: 1 });

    const r1Status = await db.query<{ status: string }>(`SELECT status::text FROM public.reservations WHERE id = $1`, [
      r1.rows[0].res.reservation_id,
    ]);
    const r2Status = await db.query<{ status: string; copy_id: string }>(
      `SELECT status::text, copy_id FROM public.reservations WHERE id = $1`,
      [r2.rows[0].res.reservation_id]
    );
    expect(r1Status.rows[0].status).toBe('EXPIRED');
    expect(r2Status.rows[0]).toEqual({ status: 'READY', copy_id: copies[0].id });
  });

  it('compress_reservation_queue and get_next_due_date work accurately', async () => {
    const { bookId, copies } = await createBookWithCopies(db, {
      title: 'Queue & Due Book',
      copyStatuses: ['BORROWED', 'BORROWED'],
    });

    const d1 = new Date(Date.now() + 2 * 86400_000).toISOString();
    const d2 = new Date(Date.now() + 5 * 86400_000).toISOString();
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status) VALUES ($1, $2, $3, 'OVERDUE'), ($4, $5, $6, 'ACTIVE')`,
      [student1.id, copies[0].id, d1, student2.id, copies[1].id, d2]
    );

    const nextDue = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ due: string }>(`SELECT public.get_next_due_date($1)::text AS due`, [bookId])
    );
    expect(new Date(nextDue.rows[0].due).getTime()).toBeCloseTo(new Date(d1).getTime(), -2);

    const resA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status, created_at)
         VALUES ($1, $2, 1, 'ACTIVE', NOW() - interval '3 hours') RETURNING id`,
        [student1.id, bookId]
      )
    ).rows[0].id;
    const resB = (
      await db.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status, created_at)
         VALUES ($1, $2, 5, 'ACTIVE', NOW() - interval '2 hours') RETURNING id`,
        [student2.id, bookId]
      )
    ).rows[0].id;
    const resC = (
      await db.query<{ id: string }>(
        `INSERT INTO public.reservations (user_id, book_id, queue_position, status, created_at)
         VALUES ($1, $2, 9, 'ACTIVE', NOW() - interval '1 hour') RETURNING id`,
        [admin.id, bookId]
      )
    ).rows[0].id;

    await db.query(`UPDATE public.reservations SET status = 'CANCELLED' WHERE id = $1`, [resA]);
    await db.query(`SELECT public.compress_reservation_queue($1)`, [bookId]);

    const positions = await db.query<{ id: string; queue_position: number }>(
      `SELECT id, queue_position FROM public.reservations WHERE id IN ($1, $2) ORDER BY queue_position`,
      [resB, resC]
    );
    expect(positions.rows).toEqual([
      { id: resB, queue_position: 1 },
      { id: resC, queue_position: 2 },
    ]);
  });

  it('search_book_ids ranks matches by tier (ISBN > exact > prefix > title > author), filters, and respects RLS', async () => {
    const catId = (
      await db.query<{ id: string }>(`INSERT INTO public.categories (name, slug) VALUES ('CS', 'cs') RETURNING id`)
    ).rows[0].id;

    const exactTitle = await createBookWithCopies(db, {
      title: 'Clean',
      author: 'Someone',
      categoryId: catId,
      section: 'A1',
      copyStatuses: ['AVAILABLE'],
    });
    const prefixTitle = await createBookWithCopies(db, {
      title: 'Clean Architecture',
      author: 'Robert Martin',
      categoryId: catId,
      section: 'A1',
      copyStatuses: ['BORROWED'],
    });
    const containsTitle = await createBookWithCopies(db, {
      title: 'The Clean Coder',
      author: 'Robert Martin',
      categoryId: catId,
      section: 'A2',
      copyStatuses: ['AVAILABLE'],
    });
    const authorMatch = await createBookWithCopies(db, {
      title: 'Refactoring',
      author: 'Clean Author',
      isbn: '978-0-13-475759-9',
      categoryId: catId,
      section: 'A1',
      copyStatuses: ['AVAILABLE'],
    });
    const archivedBook = await createBookWithCopies(db, {
      title: 'Clean Archived',
      author: 'Old Author',
      isActive: false,
      copyStatuses: ['AVAILABLE'],
    });

    // Ranked order for 'clean'
    const ranked = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ id: string; total_count: string }>(
        `SELECT id, total_count::text FROM public.search_book_ids('clean', 'ALL', NULL, NULL, false, 0, 10)`
      )
    );
    // Archived hidden from student even with p_status='ALL' due to SECURITY INVOKER RLS
    expect(ranked.rows.map((r) => r.id)).toEqual([
      exactTitle.bookId,
      prefixTitle.bookId,
      containsTitle.bookId,
      authorMatch.bookId,
    ]);

    // Staff sees archived book too
    const staffArchived = await withRole(db, 'authenticated', librarian.id, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM public.search_book_ids('clean', 'ARCHIVED', NULL, NULL, false, 0, 10)`
      )
    );
    expect(staffArchived.rows.map((r) => r.id)).toEqual([archivedBook.bookId]);

    // Exact ISBN match (tier 0)
    const isbnRes = await withRole(db, 'anon', null, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM public.search_book_ids('978-0-13-475759-9', 'ACTIVE', NULL, NULL, false, 0, 10)`
      )
    );
    expect(isbnRes.rows.map((r) => r.id)).toEqual([authorMatch.bookId]);

    // Short query (<3 chars) matches title only (ignores author 'Clean Author')
    const shortRes = await withRole(db, 'anon', null, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM public.search_book_ids('cl', 'ACTIVE', NULL, NULL, true, 0, 10)`
      )
    );
    expect(shortRes.rows.map((r) => r.id)).toEqual([exactTitle.bookId, containsTitle.bookId]);
  });

  it('transfer_super_admin_ownership transfers singleton ownership atomically and rejects unauthorized callers', async () => {
    await expect(
      withRole(db, 'authenticated', student1.id, (tx) =>
        tx.query(`SELECT public.transfer_super_admin_ownership($1, $2)`, [admin.id, librarian.id])
      )
    ).rejects.toThrow(/Unauthorized: Only the current super admin can transfer ownership|permission denied/);

    await expect(
      withRole(db, 'service_role', null, (tx) =>
        tx.query(`SELECT public.transfer_super_admin_ownership($1, $2)`, [student1.id, librarian.id])
      )
    ).rejects.toThrow(/Current user is not the super admin/);

    await expect(
      withRole(db, 'service_role', null, (tx) =>
        tx.query(`SELECT public.transfer_super_admin_ownership($1, $2)`, [admin.id, '00000000-0000-0000-0000-000000000000'])
      )
    ).rejects.toThrow(/Target user does not exist/);

    await withRole(db, 'service_role', null, (tx) =>
      tx.query(`SELECT public.transfer_super_admin_ownership($1, $2)`, [admin.id, librarian.id])
    );

    const roles = await db.query<{ id: string; role: string }>(
      `SELECT id, role::text FROM public.profiles WHERE id IN ($1, $2)`,
      [admin.id, librarian.id]
    );
    const roleMap = new Map(roles.rows.map((r) => [r.id, r.role]));
    expect(roleMap.get(admin.id)).toBe('librarian');
    expect(roleMap.get(librarian.id)).toBe('super_admin');
  });

  it('annual_student_reset, reactivate_users_bulk, send_bulk_notifications_by_target, get_analytics_summary, and auto_checkout_forgotten_attendance work with proper RBAC', async () => {
    // annual_student_reset: librarian & student rejected, super_admin suspends only students & their cards
    await expect(
      withRole(db, 'authenticated', librarian.id, (tx) => tx.query(`SELECT public.annual_student_reset()`))
    ).rejects.toThrow(/Unauthorized/);

    const resetRes = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ cnt: number }>(`SELECT public.annual_student_reset() AS cnt`)
    );
    expect(resetRes.rows[0].cnt).toBe(3); // student1, student2, pendingStudent

    const afterReset = await db.query<{ id: string; role: string; status: string; card_status: string }>(
      `SELECT p.id, p.role::text, p.status, lc.status AS card_status
       FROM public.profiles p JOIN public.library_cards lc ON lc.user_id = p.id`
    );
    for (const row of afterReset.rows) {
      if (row.role === 'student') {
        expect(row.status).toBe('SUSPENDED');
        expect(row.card_status).toBe('SUSPENDED');
      } else {
        expect(row.status).toBe('ACTIVE');
      }
    }

    // reactivate_users_bulk: student/SA rejected; librarian only reactivates students; super_admin reactivates any
    await expect(
      withRole(db, 'authenticated', sa.id, (tx) =>
        tx.query(`SELECT public.reactivate_users_bulk($1::uuid[])`, [[student1.id]])
      )
    ).rejects.toThrow(/Unauthorized/);

    await db.query(`UPDATE public.profiles SET status = 'SUSPENDED' WHERE id = $1`, [sa.id]);
    const libReactivate = await withRole(db, 'authenticated', librarian.id, (tx) =>
      tx.query<{ cnt: number }>(`SELECT public.reactivate_users_bulk($1::uuid[]) AS cnt`, [[student1.id, sa.id]])
    );
    expect(libReactivate.rows[0].cnt).toBe(1);
    expect(
      (await db.query<{ status: string }>(`SELECT status FROM public.profiles WHERE id = $1`, [sa.id])).rows[0].status
    ).toBe('SUSPENDED');

    const adminReactivate = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ cnt: number }>(`SELECT public.reactivate_users_bulk($1::uuid[]) AS cnt`, [[sa.id, student2.id]])
    );
    expect(adminReactivate.rows[0].cnt).toBe(2);

    const emptyReactivate = await withRole(db, 'authenticated', librarian.id, (tx) =>
      tx.query<{ cnt: number }>(`SELECT public.reactivate_users_bulk('{}'::uuid[]) AS cnt`)
    );
    expect(emptyReactivate.rows[0].cnt).toBe(0);

    // send_bulk_notifications_by_target: SA rejected; manager sends to students (student + student_assistant) or all
    await expect(
      withRole(db, 'authenticated', sa.id, (tx) =>
        tx.query(`SELECT public.send_bulk_notifications_by_target('students', 'Hi', 'Body')`)
      )
    ).rejects.toThrow(/Unauthorized/);

    const sentStudents = await withRole(db, 'authenticated', librarian.id, (tx) =>
      tx.query<{ cnt: number }>(
        `SELECT public.send_bulk_notifications_by_target('students', 'Term Start', 'Welcome back') AS cnt`
      )
    );
    expect(sentStudents.rows[0].cnt).toBe(4); // student1, student2, pendingStudent, and student_assistant (sa)

    const studentNotifUsers = await db.query<{ user_id: string }>(
      `SELECT user_id FROM public.notifications WHERE title = 'Term Start' ORDER BY user_id`
    );
    expect(studentNotifUsers.rows.map((r) => r.user_id)).toEqual(
      [student1.id, student2.id, pendingStudent.id, sa.id].sort()
    );

    const sentAll = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ cnt: number }>(
        `SELECT public.send_bulk_notifications_by_target('all', 'Notice', 'Maintenance') AS cnt`
      )
    );
    expect(sentAll.rows[0].cnt).toBe(6);

    // auto_checkout_forgotten_attendance: closes yesterday's Manila attendance at 17:00 Manila, leaves today's open
    const yesterdayCheckIn = await db.query<{ id: string }>(
      `INSERT INTO public.attendance (user_id, check_in_at)
       VALUES ($1, (((NOW() AT TIME ZONE 'Asia/Manila')::date - 1) + time '09:30:00') AT TIME ZONE 'Asia/Manila')
       RETURNING id`,
      [student1.id]
    );
    const todayCheckIn = await db.query<{ id: string }>(
      `INSERT INTO public.attendance (user_id, check_in_at)
       VALUES ($1, ((NOW() AT TIME ZONE 'Asia/Manila')::date + time '00:05:00') AT TIME ZONE 'Asia/Manila')
       RETURNING id`,
      [student2.id]
    );

    await db.query(`SELECT public.auto_checkout_forgotten_attendance()`);

    const yesterdayAfter = await db.query<{ notes: string; manila_hour: number }>(
      `SELECT notes, EXTRACT(HOUR FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_hour
       FROM public.attendance WHERE id = $1`,
      [yesterdayCheckIn.rows[0].id]
    );
    expect(yesterdayAfter.rows[0]).toEqual({
      notes: 'System auto-checkout: forgotten checkout',
      manila_hour: 17,
    });

    const todayAfter = await db.query<{ check_out_at: string | null }>(
      `SELECT check_out_at FROM public.attendance WHERE id = $1`,
      [todayCheckIn.rows[0].id]
    );
    expect(todayAfter.rows[0].check_out_at).toBeNull();

    // get_analytics_summary: SA rejected; librarian/super_admin gets 7d, 30d, 1y summaries
    await expect(
      withRole(db, 'authenticated', sa.id, (tx) => tx.query(`SELECT public.get_analytics_summary('7d')`))
    ).rejects.toThrow(/Forbidden/);

    const catId = (
      await db.query<{ id: string }>(`INSERT INTO public.categories (name, slug) VALUES ('Fiction', 'fiction') RETURNING id`)
    ).rows[0].id;
    const { copies } = await createBookWithCopies(db, {
      title: 'Dune',
      categoryId: catId,
      copyStatuses: ['BORROWED'],
    });
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
       VALUES ($1, $2, NOW() - interval '1 day', NOW() + interval '10 days', 'ACTIVE')`,
      [student1.id, copies[0].id]
    );

    const summary7d = await withRole(db, 'authenticated', librarian.id, (tx) =>
      tx.query<{ summary: Record<string, unknown[]> }>(`SELECT public.get_analytics_summary('7d') AS summary`)
    );
    expect(summary7d.rows[0].summary.attendanceTrends).toHaveLength(7);
    expect(summary7d.rows[0].summary.borrowingTrends).toHaveLength(7);
    expect(summary7d.rows[0].summary.peakHours).toHaveLength(11); // 8 AM to 6 PM
    expect(summary7d.rows[0].summary.categoryDistribution).toEqual([{ name: 'Fiction', value: 1 }]);
    expect(summary7d.rows[0].summary.popularBooks).toHaveLength(1);

    const summary30d = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ summary: Record<string, unknown[]> }>(`SELECT public.get_analytics_summary('30d') AS summary`)
    );
    expect(summary30d.rows[0].summary.attendanceTrends).toHaveLength(30);

    const summary1y = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ summary: Record<string, unknown[]> }>(`SELECT public.get_analytics_summary('1y') AS summary`)
    );
    expect(summary1y.rows[0].summary.attendanceTrends.length).toBeGreaterThanOrEqual(12);
  });
});
