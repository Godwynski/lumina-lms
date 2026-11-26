// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { isValidPolicyValue } from '@/lib/actions/policy-constants';
import { libraryDate } from '@/lib/copy-acquisition';

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
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
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
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/rollback/20261116_undo_rename_role_values.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261116200000_rename_role_values.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261117120000_qa_circulation_fixes.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261117130000_rls_tightening.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261117140000_history_sort.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261119050000_stable_borrowing_history_sort.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261119043439_books_sort_indexes.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261119120000_book_copy_lifecycle.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261122120000_profile_status_guard.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261127031000_remove_demo_access.sql'), 'utf8'));
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
    role?: 'super_admin' | 'librarian' | 'library_staff' | 'patron';
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

describe('Book copy acquisition and disposition', () => {
  it('creates private per-copy acquisition details and rolls back an invalid batch', async () => {
    const db = await bootLuminaDb();
    try {
      const { bookId } = await createBookWithCopies(db, { title: 'Batch' });
      const create = (rows: object[]) => withRole(db, 'service_role', null, tx =>
        tx.query<{ id: string }>('select id from public.create_book_copy_batch($1::jsonb)', [JSON.stringify(rows)]));
      const acquired = { book_id: bookId, acquisition: { method: 'PURCHASED', acquiredOn: '2024-02-29', purchasePrice: '125.50' } };
      const copies = await create([acquired, acquired]);
      expect(copies.rows).toHaveLength(2);
      const read = await db.query('select acquisition_method, acquired_on::text, purchase_price::text from public.book_copy_lifecycle order by copy_id');
      expect(read.rows).toEqual(Array(2).fill({ acquisition_method: 'PURCHASED', acquired_on: '2024-02-29', purchase_price: '125.50' }));
      await expect(create([acquired, { ...acquired, acquisition: { method: 'DONATED', purchasePrice: '1' } }])).rejects.toThrow();
      expect((await db.query('select total_copies, available_copies from public.books where id = $1', [bookId])).rows).toEqual([{ total_copies: 3, available_copies: 3 }]);
      await expect(withRole(db, 'authenticated', null, tx => tx.query('select * from public.book_copy_lifecycle'))).rejects.toThrow(/permission denied/i);
      await expect(withRole(db, 'authenticated', null, tx => tx.query("select public.create_book_copy_batch('[]')"))).rejects.toThrow(/permission denied/i);
    } finally {
      await db.close();
    }
  });

  it('keeps retired copy identities and history out of stock and release flows', async () => {
    const db = await bootLuminaDb();
    try {
      const librarian = await createUser(db, { email: 'lifecycle-lib@alabang.sti.edu.ph', fullName: 'Librarian', role: 'librarian', status: 'ACTIVE' });
      const patron = await createUser(db, { email: 'lifecycle.111111@alabang.sti.edu.ph', fullName: 'Patron', role: 'patron', status: 'ACTIVE' });
      const { bookId, copies: [sold, donated] } = await createBookWithCopies(db, { title: 'Retired', copyStatuses: ['AVAILABLE', 'AVAILABLE'] });
      await expect(withRole(db, 'authenticated', librarian.id, tx =>
        tx.query("update public.book_copies set status='LOST' where id=$1", [sold.id]))).rejects.toThrow(/through inventory/i);
      const change = (actor: string, id: string, change: object) => withRole(db, 'service_role', null, tx =>
        tx.query('select public.change_book_copy_lifecycle($1, $2, $3::jsonb)', [actor, id, JSON.stringify(change)]));
      await expect(change(patron.id, sold.id, { status: 'SOLD', occurredOn: '2024-05-01', saleAmount: '0' })).rejects.toThrow(/unauthorized/i);
      await change(librarian.id, sold.id, { status: 'SOLD', occurredOn: '2024-05-01', saleAmount: '0' });
      await change(librarian.id, donated.id, { status: 'DONATED_OUT', occurredOn: '2024-05-02' });
      await expect(change(librarian.id, sold.id, { status: 'LOST', occurredOn: '2024-05-03' })).rejects.toThrow(/already.*circulation/i);
      await db.query('select public.release_copy($1)', [sold.id]);
      expect((await db.query('select status, qr_string from public.book_copies where id = $1', [sold.id])).rows).toEqual([{ status: 'SOLD', qr_string: sold.qr }]);
      expect((await db.query('select total_copies, available_copies from public.books where id = $1', [bookId])).rows).toEqual([{ total_copies: 0, available_copies: 0 }]);
      expect((await db.query("select subject_copy_id, new_value->>'sale_amount' as amount from public.audit_log_records where subject_book_id = $1 and action = 'update_copy_sold'", [bookId])).rows)
        .toEqual([{ subject_copy_id: sold.id, amount: '0.00' }]);
      const res = await withRole(db, 'authenticated', patron.id, tx =>
        tx.query<{ result: { code: string } }>('select public.create_reservation_atomic($1,$2) as result', [patron.id, bookId]));
      expect(res.rows[0].result.code).toBe('NO_CIRCULATING_COPIES');
    } finally {
      await db.close();
    }
  });

  it('keeps checkout, the reservation queue, a recorded loss and a later return consistent', async () => {
    const db = await bootLuminaDb();
    try {
      const staff = await createUser(db, { email: 'copy-lib@alabang.sti.edu.ph', fullName: 'Librarian', role: 'librarian', status: 'ACTIVE' });
      const borrower = await createUser(db, { email: 'copy.111111@alabang.sti.edu.ph', fullName: 'Borrower', status: 'ACTIVE', cardStatus: 'ACTIVE' });
      const waiter = await createUser(db, { email: 'copy.222222@alabang.sti.edu.ph', fullName: 'Waiter', status: 'ACTIVE', cardStatus: 'ACTIVE' });
      const { bookId, copies: [loaned, sellable] } = await createBookWithCopies(db, { title: 'Circulation', copyStatuses: ['AVAILABLE', 'MAINTENANCE'] });
      const change = (copyId: string, status: string, saleAmount?: string) => db.query<{ result: { queueWaiting: boolean } }>(
        'select public.change_book_copy_lifecycle($1, $2, $3::jsonb) as result',
        [staff.id, copyId, JSON.stringify({ status, occurredOn: libraryDate(), saleAmount })]);
      const checkout = (qr: string, key: string) => db.query<{ result: {ok: boolean; code?: string} }>(
        'select public.process_qr_checkout($1,$2,$3,$4,false) as result', [staff.id, borrower.cardNumber, qr, key]);
      expect((await checkout(loaned.qr, 'lifecycle-first-loan')).rows[0].result.ok).toBe(true);
      await expect(db.query('select public.change_book_copy_lifecycle($1,$2,$3::jsonb)',
        [staff.id, loaned.id, JSON.stringify({ status: 'LOST', occurredOn: '2024-01-01' })])).rejects.toThrow(/latest loss or loan activity/i);
      await expect(change(loaned.id, 'SOLD', '15')).rejects.toThrow(/return or recover/i);
      expect((await withRole(db, 'authenticated', waiter.id, tx =>
        tx.query<{ result: { status: string } }>('select public.create_reservation_atomic($1,$2) as result', [waiter.id, bookId]))).rows[0].result.status).toBe('ACTIVE');
      expect((await change(loaned.id, 'LOST')).rows[0].result.queueWaiting).toBe(true);
      expect((await db.query('select status, returned_at from public.borrowing_records where book_copy_id=$1', [loaned.id])).rows)
        .toEqual([{ status: 'LOST', returned_at: null }]);
      await expect(change(sellable.id, 'SOLD', '15')).rejects.toThrow(/last copy/i);
      const returned = await db.query<{ result: { ok: boolean } }>(
        'select public.process_qr_return($1,$2,$3,false) as result', [staff.id, loaned.qr, 'lifecycle-return']);
      expect(returned.rows[0].result.ok).toBe(true);
      expect((await db.query('select status from public.book_copies where id=$1', [loaned.id])).rows).toEqual([{ status: 'RESERVED' }]);
      expect((await db.query('select last_lost_on::text from public.book_copy_lifecycle where copy_id=$1', [loaned.id])).rows)
        .toEqual([{ last_lost_on: libraryDate() }]);
      await expect(change(loaned.id, 'DONATED_OUT')).rejects.toThrow(/on hold/i);
      await change(sellable.id, 'SOLD', '15');
      expect((await checkout(sellable.qr, 'lifecycle-retired-scan')).rows[0].result.ok).toBe(false);
    } finally {
      await db.close();
    }
  });

  it('allocates initial copies and records ISBN retry summaries without duplicating copies', async () => {
    const db = await bootLuminaDb();
    try {
      const acquisition = JSON.stringify({ method: 'DONATED', acquiredOn: '2024-02-29' });
      const created = await db.query<{ result: { id: string; copyIds: string[] } }>(
        'select public.create_book_with_acquisition($1,$2,$3) as result',
        [JSON.stringify({ title: 'Donation', author: 'A' }), 2, acquisition]);
      const { id, copyIds } = created.rows[0].result;
      expect(copyIds).toHaveLength(2);
      expect((await db.query(
        'select acquisition_method, purchase_price from public.book_copy_lifecycle l join public.book_copies c on c.id = l.copy_id where c.book_id=$1', [id])).rows)
        .toEqual(Array(2).fill({ acquisition_method: 'DONATED', purchase_price: null }));

      const job = '00000000-0000-4000-8000-000000000001';
      await db.query('select public.catalog_import_enqueue($1,null,$2,$3)', [
        job, 'Batch', JSON.stringify([{ mode: 'create', isbn: '9781492040347', requested_copies: 2 }, { mode: 'create', isbn: '9780132350884', requested_copies: 1 }]),
      ]);
      const claim = await db.query<{ id: string; lease: string }>('select id, lease from public.catalog_import_claim()');
      const item = claim.rows[0];
      const metadata = JSON.stringify({ title: 'Imported', author: 'A' });
      await db.query('select public.catalog_import_apply_book($1,$2,$3)', [item.id, item.lease, metadata]);
      await db.query('select public.catalog_import_apply_book($1,$2,$3)', [item.id, item.lease, metadata]);
      const second = claim.rows[1];
      await db.query('select public.catalog_import_apply_book($1,$2,$3)', [second.id, second.lease, metadata]);
      const auditRows = await db.query<{ id: string; details: { jobId: string } }>("select id, details from public.audit_logs where action='create_isbn_import'");
      expect(auditRows.rows).toHaveLength(2);
      expect(new Set(auditRows.rows.map(row => row.id)).size).toBe(2);
      expect(auditRows.rows.every(row => row.details.jobId === job)).toBe(true);
      await expect(db.query("update public.audit_logs set reason='changed' where id=$1", [auditRows.rows[0].id])).rejects.toThrow(/append.only/i);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        await expect(db.transaction(async tx => {
          await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role })]);
          await tx.query("update public.audit_logs set reason='changed' where id=$1", [auditRows.rows[0].id]);
        })).rejects.toThrow(/append.only/i);
      }
      for (const role of ['anon', 'authenticated']) {
        await expect(db.transaction(async tx => {
          await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role })]);
          await tx.query('delete from public.audit_logs where id=$1', [auditRows.rows[0].id]);
        })).rejects.toThrow(/append.only/i);
      }
      const audit = await db.query<{ details: { copyIds: string[]; copiesCount: number } }>(
        "select details from public.audit_logs where action='create_isbn_import'");
      expect(audit.rows).toHaveLength(2);
      const twoCopies = audit.rows.find(row => row.details.copiesCount === 2);
      expect(twoCopies).toBeDefined();
      expect(new Set(twoCopies!.details.copyIds).size).toBe(2);
      expect((await db.query('select count(*)::int as count from public.book_copy_lifecycle')).rows[0]).toEqual({ count: 2 });
      await withRole(db, 'service_role', null, tx => tx.query('delete from public.audit_logs where id=$1', [auditRows.rows[0].id]));
      await db.query('delete from public.audit_logs where id=$1', [auditRows.rows[1].id]);
      expect((await db.query("select id from public.audit_logs where action='create_isbn_import'")).rows).toHaveLength(0);
      expect((await db.query("select has_function_privilege('authenticated', 'public.guard_audit_logs_append_only()', 'execute') as allowed")).rows[0]).toEqual({ allowed: false });
    } finally {
      await db.close();
    }
  });

  it('applies spreadsheet titles, categories and copy additions in one transaction', async () => {
    const db = await bootLuminaDb();
    try {
      const { bookId } = await createBookWithCopies(db, { title: 'Existing' });
      const titles = [{ book: { title: 'Imported', author: 'A' }, categoryName: 'Imported category', acquisitions: [null] }];
      const applySheet = (copies: object[]) => withRole(db, 'service_role', null, tx =>
        tx.query<{ result: { books: Array<{ id: string; title: string; copyIds: string[] }>; copyIds: string[] } }>(
          'select public.apply_catalog_spreadsheet($1::jsonb, $2::jsonb) as result', [JSON.stringify(titles), JSON.stringify(copies)],
        ));
      await expect(applySheet([{ book_id: bookId, acquisition: { method: 'DONATED', purchasePrice: '4' } }])).rejects.toThrow();
      expect((await db.query("select id from public.books where title = 'Imported'")).rows).toHaveLength(0);
      expect((await db.query("select id from public.categories where name = 'Imported category'")).rows).toHaveLength(0);
      expect((await db.query('select id from public.book_copies')).rows).toHaveLength(1);

      const { result } = (await applySheet([{ book_id: bookId, acquisition: { method: 'DONATED', acquiredOn: '2024-02-29' } }])).rows[0];
      expect(result.books).toEqual([expect.objectContaining({ title: 'Imported', copyIds: [expect.any(String)] })]);
      expect(result.copyIds).toHaveLength(2);
      expect((await db.query('select total_copies from public.books where id=$1', [bookId])).rows).toEqual([{ total_copies: 2 }]);
      expect((await db.query("select name from public.categories where name = 'Imported category'")).rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it('releases a recovered copy once and never overwrites a new hold', async () => {
    const db = await bootLuminaDb();
    try {
      const patron = await createUser(db, { email: 'hold.111111@alabang.sti.edu.ph', fullName: 'Patron', status: 'ACTIVE' });
      const { bookId, copies: [copy] } = await createBookWithCopies(db, { title: 'Found', copyStatuses: ['LOST'] });
      await db.query("insert into public.reservations (user_id, book_id, status, queue_position) values ($1,$2,'ACTIVE',1)", [patron.id, bookId]);
      const recover = () => withRole(db, 'service_role', null, tx => tx.query('select public.recover_book_copy($1,$2)', [copy.id, 'LOST']));
      await recover();
      await expect(recover()).rejects.toThrow(/changed/i);
      expect((await db.query('select status, copy_id from public.reservations where book_id=$1', [bookId])).rows)
        .toEqual([{ status: 'READY', copy_id: copy.id }]);
      expect((await db.query('select status from public.book_copies where id=$1', [copy.id])).rows)
        .toEqual([{ status: 'RESERVED' }]);
    } finally {
      await db.close();
    }
  });
});

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
    expect(inactiveAccRes.rows[0].res).toMatchObject({
      ok: false,
      code: 'ACCOUNT_INACTIVE',
      message: 'Patron account is not active.',
    });
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
    expect(blocked.rows[0].res).toMatchObject({
      ok: false,
      code: 'COPY_UNAVAILABLE',
      message: 'This copy is reserved for another patron.',
    });

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

  it('process_qr_checkout blocks staff self-checkout and allows another staff member to process staff borrowing', async () => {
    const { copies } = await createBookWithCopies(db, {
      title: 'Staff Borrowing Book',
      copyStatuses: ['AVAILABLE'],
    });
    const staff2 = await createUser(db, {
      email: 'staff2@alabang.sti.edu.ph',
      fullName: 'Library Staff Two',
      role: 'library_staff',
      status: 'ACTIVE',
      cardStatus: 'ACTIVE',
    });

    // Self-checkout preview & commit both rejected
    const selfPreview = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, true) AS res`,
      [librarian.id, librarian.cardNumber, copies[0].qr]
    );
    expect(selfPreview.rows[0].res).toMatchObject({ ok: false, code: 'SELF_CHECKOUT_FORBIDDEN' });

    const selfCommit = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [librarian.id, librarian.cardNumber, copies[0].qr]
    );
    expect(selfCommit.rows[0].res).toMatchObject({ ok: false, code: 'SELF_CHECKOUT_FORBIDDEN' });

    // A second staff member can check out the book to the librarian
    const otherStaffCheckout = await db.query<{ res: Record<string, unknown> }>(
      `SELECT public.process_qr_checkout($1, $2, $3, NULL, false) AS res`,
      [staff2.id, librarian.cardNumber, copies[0].qr]
    );
    expect(otherStaffCheckout.rows[0].res).toMatchObject({
      ok: true,
      student_name: 'Librarian User',
      book_title: 'Staff Borrowing Book',
    });
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
      role: 'library_staff',
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
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status, fine_amount, fine_settled_at, fine_resolution, fine_remarks)
         VALUES ($1, $2, NOW() - interval '22 days', NOW() - interval '10 days', NOW() - interval '8 days', 'RETURNED', 25.00, NOW() - interval '7 days', 'PAID', 'Cash receipt #101') RETURNING id`,
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

  it('orders by an allowlisted p_sort column and ignores unknown values', async () => {
    const run = (sort: string | null) =>
      withRole(db, 'authenticated', sa.id, (tx) =>
        tx.query<{ id: string; due_date: string; title: string }>(
          `SELECT h.id, h.due_date::text, lower(b.title) AS title
             FROM public.get_borrowing_history_v2(NULL, 1, 50, 'all', NULL, NULL, $1) h
             JOIN public.book_copies bc ON bc.id = h.book_copy_id
             JOIN public.books b ON b.id = bc.book_id`,
          [sort]
        )
      );
    const isSorted = (xs: string[], desc = false) =>
      xs.every((x, i) => i === 0 || (desc ? xs[i - 1] >= x : xs[i - 1] <= x));

    const dueAsc = (await run('due_asc')).rows;
    const dueDesc = (await run('due_desc')).rows;
    expect(dueAsc).toHaveLength(7);
    expect(isSorted(dueAsc.map((r) => r.due_date))).toBe(true);
    expect(isSorted(dueDesc.map((r) => r.due_date), true)).toBe(true);
    expect(dueAsc[0].due_date).not.toBe(dueAsc[6].due_date);

    const titleAsc = (await run('title_asc')).rows;
    expect(isSorted(titleAsc.map((r) => r.title))).toBe(true);

    const defaultOrder = (await run(null)).rows.map((r) => r.id);
    expect((await run('nonsense; DROP TABLE books')).rows.map((r) => r.id)).toEqual(defaultOrder);
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

  it('enforces fine_resolution constraints, filters SETTLED by p_resolution, and returns CURRENT borrows overdue-first', async () => {
    const condonedBook = await createBookWithCopies(db, {
      title: 'Condoned Fine Book',
      copyStatuses: ['AVAILABLE'],
    });
    const recCondonedId = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (
           user_id, book_copy_id, borrowed_at, due_date, returned_at, status,
           fine_amount, fine_settled_at, fine_resolution, fine_remarks, fine_settled_by
         )
         VALUES ($1, $2, NOW() - interval '15 days', NOW() - interval '8 days', NOW() - interval '5 days', 'RETURNED',
           15.00, NOW() - interval '4 days', 'CONDONED', 'Medical excuse approved', $3)
         RETURNING id`,
        [student1.id, condonedBook.copies[0].id, sa.id]
      )
    ).rows[0].id;

    // Invalid fine_resolution enum value rejected
    await expect(
      db.query(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status, fine_amount, fine_settled_at, fine_resolution)
         VALUES ($1, $2, NOW(), 'RETURNED', 10.00, NOW(), 'WAIVED')`,
        [student1.id, condonedBook.copies[0].id]
      )
    ).rejects.toThrow();

    // fine_settled_at without fine_resolution rejected
    await expect(
      db.query(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status, fine_amount, fine_settled_at)
         VALUES ($1, $2, NOW(), 'RETURNED', 10.00, NOW())`,
        [student1.id, condonedBook.copies[0].id]
      )
    ).rejects.toThrow();

    // fine_resolution without fine_settled_at rejected
    await expect(
      db.query(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, due_date, status, fine_amount, fine_resolution)
         VALUES ($1, $2, NOW(), 'RETURNED', 10.00, 'PAID')`,
        [student1.id, condonedBook.copies[0].id]
      )
    ).rejects.toThrow();

    // Verify migration backfill logic: dropping pair constraint, inserting legacy settled row, running backfill UPDATE, re-adding constraint
    await db.exec(`
      ALTER TABLE public.borrowing_records DROP CONSTRAINT borrowing_records_fine_settlement_pair_check;
      INSERT INTO public.borrowing_records (id, user_id, book_copy_id, borrowed_at, due_date, returned_at, status, fine_amount, fine_settled_at)
      VALUES ('00000000-0000-4000-8000-000000000999', '${student2.id}', '${condonedBook.copies[0].id}', NOW() - interval '10 days', NOW() - interval '5 days', NOW() - interval '2 days', 'RETURNED', 15.00, NOW() - interval '1 day');
      UPDATE public.borrowing_records SET fine_resolution = 'PAID' WHERE fine_settled_at IS NOT NULL AND fine_resolution IS NULL;
      ALTER TABLE public.borrowing_records ADD CONSTRAINT borrowing_records_fine_settlement_pair_check CHECK (
        (fine_settled_at IS NULL AND fine_resolution IS NULL)
        OR (fine_settled_at IS NOT NULL AND fine_resolution IS NOT NULL)
      );
    `);
    const backfilled = await db.query<{ fine_resolution: string }>(
      `SELECT fine_resolution FROM public.borrowing_records WHERE id = '00000000-0000-4000-8000-000000000999'`
    );
    expect(backfilled.rows[0].fine_resolution).toBe('PAID');

    // Filter SETTLED by p_resolution = PAID / CONDONED / all
    const paidRows = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string; fine_resolution: string; fine_remarks: string | null }>(
        `SELECT id, fine_resolution, fine_remarks FROM public.get_borrowing_history_v2(NULL, 1, 50, 'SETTLED', NULL, 'PAID')`
      )
    );
    expect(paidRows.rows.every((r) => r.fine_resolution === 'PAID')).toBe(true);
    expect(paidRows.rows.map((r) => r.id)).toContain(recSettledLateReturnId);
    expect(paidRows.rows.map((r) => r.id)).not.toContain(recCondonedId);

    const condonedRows = await withRole(db, 'authenticated', sa.id, (tx) =>
      tx.query<{ id: string; fine_resolution: string; fine_remarks: string; fine_settled_by: string }>(
        `SELECT id, fine_resolution, fine_remarks, fine_settled_by FROM public.get_borrowing_history_v2(NULL, 1, 50, 'SETTLED', NULL, 'CONDONED')`
      )
    );
    expect(condonedRows.rows).toEqual([
      {
        id: recCondonedId,
        fine_resolution: 'CONDONED',
        fine_remarks: 'Medical excuse approved',
        fine_settled_by: sa.id,
      },
    ]);

    // p_status = 'CURRENT' for student1 returns past-due ACTIVE and unpaid RETURNED before non-overdue ACTIVE
    const currentRows = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM public.get_borrowing_history_v2($1, 1, 50, 'CURRENT', NULL, NULL)`,
        [student1.id]
      )
    );
    expect(currentRows.rows.map((r) => r.id)).toEqual([
      recUnpaidLateReturnId,
      recPastDueActiveId,
      recActiveId,
    ]);

    await db.query(
      "UPDATE public.borrowing_records SET borrowed_at = NOW() - interval '1 day' WHERE id = $1",
      [recActiveId],
    );
    const newest = await withRole(db, 'authenticated', student1.id, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM public.get_borrowing_history_v2($1, 1, 1, 'CURRENT', NULL, NULL, 'borrowed_desc')`,
        [student1.id],
      ),
    );
    expect(newest.rows.map((row) => row.id)).toEqual([recActiveId]);
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
      role: 'library_staff',
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

    // ISBN typed without hyphens, with spaces, or as a partial run still matches the hyphenated record
    for (const typed of ['9780134757599', '978 0 13 475759 9', '0134757599', '47575']) {
      const res = await withRole(db, 'anon', null, (tx) =>
        tx.query<{ id: string }>(`SELECT id FROM public.search_book_ids($1, 'ACTIVE', NULL, NULL, false, 0, 10)`, [typed])
      );
      expect(res.rows.map((r) => r.id)).toEqual([authorMatch.bookId]);
    }
    // A non-ISBN word does not trigger the digits-only match
    const wordRes = await withRole(db, 'anon', null, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM public.search_book_ids('xyzzy', 'ACTIVE', NULL, NULL, false, 0, 10)`)
    );
    expect(wordRes.rows).toHaveLength(0);

    // Short query (<3 chars) matches title only (ignores author 'Clean Author')
    const shortRes = await withRole(db, 'anon', null, (tx) =>
      tx.query<{ id: string }>(
        `SELECT id FROM public.search_book_ids('cl', 'ACTIVE', NULL, NULL, true, 0, 10)`
      )
    );
    expect(shortRes.rows.map((r) => r.id)).toEqual([exactTitle.bookId, containsTitle.bookId]);
  });

  it('serves both sort directions from book indexes and paginates the filtered rows within RLS', async () => {
    const category = await db.query<{ id: string }>(
      `INSERT INTO public.categories (name, slug) VALUES ('Catalog Sort', 'catalog-sort') RETURNING id`
    );
    const categoryId = category.rows[0].id;
    const sameAuthorA = await createBookWithCopies(db, { title: 'Clean Code', author: 'Martin', categoryId });
    const sameAuthorB = await createBookWithCopies(db, { title: 'Clean Architecture', author: 'Martin', categoryId });
    const archived = await createBookWithCopies(db, { title: 'Clean Archived', author: 'Adams', categoryId, isActive: false });
    await createBookWithCopies(db, { title: 'Clean Other Category', author: 'Adams' });
    const [firstId, secondId] = [sameAuthorA.bookId, sameAuthorB.bookId].sort();

    for (const [userId, expected] of [[student1.id, secondId], [librarian.id, firstId]]) {
      const page = await withRole(db, 'authenticated', userId, (tx) => tx.query<{ id: string }>(
        `SELECT id FROM public.books WHERE category_id = $1 AND title ILIKE '%clean%' AND available_copies > 0
         ORDER BY author ASC, id ASC LIMIT 1 OFFSET 1`,
        [categoryId]
      ));
      expect(page.rows).toEqual([{ id: expected }]);
    }
    const staffFirst = await withRole(db, 'authenticated', librarian.id, (tx) => tx.query<{ id: string }>(
      `SELECT id FROM public.books WHERE category_id = $1 ORDER BY author ASC, id ASC LIMIT 1`,
      [categoryId]
    ));
    expect(staffFirst.rows).toEqual([{ id: archived.bookId }]);

    await db.transaction(async (tx) => {
      // Force the planner to consider ordered access on the small test fixture.
      await tx.exec('SET LOCAL enable_seqscan = off');
      for (const column of ['title', 'author', 'available_copies', 'created_at']) {
        for (const direction of ['ASC', 'DESC']) {
          const plan = await tx.query<{ 'QUERY PLAN': string }>(
            `EXPLAIN SELECT id FROM public.books ORDER BY ${column} ${direction}, id ${direction} LIMIT 2`
          );
          expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(`books_${column}_id_idx`);
        }
      }
    });
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
    // annual_student_reset: all patrons, including faculty, are suspended
    await expect(
      withRole(db, 'authenticated', librarian.id, (tx) => tx.query(`SELECT public.annual_student_reset()`))
    ).rejects.toThrow(/Unauthorized/);

    await db.query("UPDATE public.profiles SET patron_type = 'faculty' WHERE id = $1", [student1.id]);
    const resetRes = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ cnt: number }>(`SELECT public.annual_student_reset() AS cnt`)
    );
    expect(resetRes.rows[0].cnt).toBe(3); // student1, student2, pendingStudent

    const afterReset = await db.query<{ id: string; role: string; status: string; card_status: string }>(
      `SELECT p.id, p.role::text, p.status, lc.status AS card_status
       FROM public.profiles p JOIN public.library_cards lc ON lc.user_id = p.id`
    );
    for (const row of afterReset.rows) {
      if (row.role === 'patron') {
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

    // send_bulk_notifications_by_target: SA rejected; manager sends to students (student + library_staff) or all
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
    expect(sentStudents.rows[0].cnt).toBe(4); // student1, student2, pendingStudent, and library_staff (sa)

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

    // auto_checkout_forgotten_attendance: closes yesterday's Manila attendance at library_closing_time (default 17:00), leaves today's open
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

    const yesterdayAfter = await db.query<{ notes: string; manila_hour: number; manila_min: number }>(
      `SELECT notes,
              EXTRACT(HOUR FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_hour,
              EXTRACT(MINUTE FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_min
       FROM public.attendance WHERE id = $1`,
      [yesterdayCheckIn.rows[0].id]
    );
    expect(yesterdayAfter.rows[0]).toEqual({
      notes: 'No Log Out',
      manila_hour: 17,
      manila_min: 0,
    });

    const todayAfter = await db.query<{ check_out_at: string | null }>(
      `SELECT check_out_at FROM public.attendance WHERE id = $1`,
      [todayCheckIn.rows[0].id]
    );
    expect(todayAfter.rows[0].check_out_at).toBeNull();

    // Custom closing time + check-in after closing time never yields check_out_at < check_in_at
    await db.query(
      `UPDATE public.system_settings SET value = '19:30' WHERE key = 'library_closing_time'`
    );
    const beforeCustomClosing = await db.query<{ id: string }>(
      `INSERT INTO public.attendance (user_id, check_in_at)
       VALUES ($1, (((NOW() AT TIME ZONE 'Asia/Manila')::date - 2) + time '10:00:00') AT TIME ZONE 'Asia/Manila')
       RETURNING id`,
      [student1.id]
    );
    const afterCustomClosing = await db.query<{ id: string }>(
      `INSERT INTO public.attendance (user_id, check_in_at)
       VALUES ($1, (((NOW() AT TIME ZONE 'Asia/Manila')::date - 2) + time '21:15:00') AT TIME ZONE 'Asia/Manila')
       RETURNING id`,
      [sa.id]
    );

    await db.query(`SELECT public.auto_checkout_forgotten_attendance()`);

    const beforeRes = await db.query<{ notes: string; manila_hour: number; manila_min: number; non_negative: boolean }>(
      `SELECT notes,
              EXTRACT(HOUR FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_hour,
              EXTRACT(MINUTE FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_min,
              (check_out_at >= check_in_at) AS non_negative
       FROM public.attendance WHERE id = $1`,
      [beforeCustomClosing.rows[0].id]
    );
    expect(beforeRes.rows[0]).toEqual({
      notes: 'No Log Out',
      manila_hour: 19,
      manila_min: 30,
      non_negative: true,
    });

    const afterRes = await db.query<{ notes: string; manila_hour: number; manila_min: number; non_negative: boolean; same_ts: boolean }>(
      `SELECT notes,
              EXTRACT(HOUR FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_hour,
              EXTRACT(MINUTE FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_min,
              (check_out_at >= check_in_at) AS non_negative,
              (check_out_at = check_in_at) AS same_ts
       FROM public.attendance WHERE id = $1`,
      [afterCustomClosing.rows[0].id]
    );
    expect(afterRes.rows[0]).toEqual({
      notes: 'No Log Out',
      manila_hour: 21,
      manila_min: 15,
      non_negative: true,
      same_ts: true,
    });

    // Malformed library_closing_time safely falls back to 17:00
    await db.query(
      `UPDATE public.system_settings SET value = 'invalid-time' WHERE key = 'library_closing_time'`
    );
    const fallbackCheckIn = await db.query<{ id: string }>(
      `INSERT INTO public.attendance (user_id, check_in_at)
       VALUES ($1, (((NOW() AT TIME ZONE 'Asia/Manila')::date - 3) + time '08:00:00') AT TIME ZONE 'Asia/Manila')
       RETURNING id`,
      [student1.id]
    );
    await db.query(`SELECT public.auto_checkout_forgotten_attendance()`);
    const fallbackRes = await db.query<{ notes: string; manila_hour: number; manila_min: number }>(
      `SELECT notes,
              EXTRACT(HOUR FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_hour,
              EXTRACT(MINUTE FROM (check_out_at AT TIME ZONE 'Asia/Manila'))::int AS manila_min
       FROM public.attendance WHERE id = $1`,
      [fallbackCheckIn.rows[0].id]
    );
    expect(fallbackRes.rows[0]).toEqual({
      notes: 'No Log Out',
      manila_hour: 17,
      manila_min: 0,
    });
    // Restore default closing time
    await db.query(
      `UPDATE public.system_settings SET value = '17:00' WHERE key = 'library_closing_time'`
    );

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

  it('archive_old_logs enforces super_admin, rejects recent cutoffs, and moves only eligible completed rows', async () => {
    const patron = student1;
    const patron2 = student2;

    const { copies } = await createBookWithCopies(db, {
      title: 'Archive Test Book',
      copyStatuses: ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BORROWED', 'BORROWED', 'LOST'],
    });

    // Compute a cutoff strictly more than 1 year old and one strictly less than 1 year old in Manila time
    const datesRes = await db.query<{ valid_cutoff: string; too_recent: string }>(
      `SELECT
         (((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '1 year' - INTERVAL '10 days')::date)::text AS valid_cutoff,
         (((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '1 year' + INTERVAL '1 day')::date)::text AS too_recent`
    );
    const { valid_cutoff: validCutoff, too_recent: tooRecent } = datesRes.rows[0];

    // 1. Non-super-admin roles & anon denied
    await expect(
      withRole(db, 'anon', null, (tx) => tx.query(`SELECT public.archive_old_logs($1::date)`, [validCutoff]))
    ).rejects.toThrow();
    for (const actorId of [patron.id, sa.id, librarian.id]) {
      await expect(
        withRole(db, 'authenticated', actorId, (tx) => tx.query(`SELECT public.archive_old_logs($1::date)`, [validCutoff]))
      ).rejects.toThrow(/Unauthorized/);
    }

    // 2. Cutoff less than 1 year old or null refused
    await expect(
      withRole(db, 'authenticated', admin.id, (tx) => tx.query(`SELECT public.archive_old_logs($1::date)`, [tooRecent]))
    ).rejects.toThrow(/at least 1 year old/);
    await expect(
      withRole(db, 'authenticated', admin.id, (tx) => tx.query(`SELECT public.archive_old_logs(NULL::date)`))
    ).rejects.toThrow(/at least 1 year old/);

    // 3. Seed borrowing_records (eligible vs ineligible)
    const oldStart = `('${validCutoff}'::date - 30)::timestamp AT TIME ZONE 'Asia/Manila'`;
    const oldDue = `('${validCutoff}'::date - 16)::timestamp AT TIME ZONE 'Asia/Manila'`;
    const oldEnd = `('${validCutoff}'::date - 10)::timestamp AT TIME ZONE 'Asia/Manila'`;
    const afterCutoff = `('${validCutoff}'::date + 2)::timestamp AT TIME ZONE 'Asia/Manila'`;

    // Eligible 1: RETURNED, no fine, before cutoff
    const brEligibleClean = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status)
         VALUES ($1, $2, ${oldStart}, ${oldDue}, ${oldEnd}, 'RETURNED') RETURNING id`,
        [patron.id, copies[0].id]
      )
    ).rows[0].id;

    // Eligible 2: RETURNED, settled fine (CONDONED with remarks & settled_by), before cutoff
    const brEligibleSettled = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (
           user_id, book_copy_id, borrowed_at, due_date, returned_at, status,
           fine_amount, fine_settled_at, fine_resolution, fine_remarks, fine_settled_by
         ) VALUES (
           $1, $2, ${oldStart}, ${oldDue}, ${oldEnd}, 'RETURNED',
           25.00, ${oldEnd}, 'CONDONED', 'Medical excuse approved', $3
         ) RETURNING id`,
        [patron.id, copies[1].id, librarian.id]
      )
    ).rows[0].id;

    // Ineligible 1: RETURNED before cutoff, but UNSETTLED receivable fine
    const brUnsettled = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (
           user_id, book_copy_id, borrowed_at, due_date, returned_at, status, fine_amount
         ) VALUES ($1, $2, ${oldStart}, ${oldDue}, ${oldEnd}, 'RETURNED', 30.00) RETURNING id`,
        [patron.id, copies[2].id]
      )
    ).rows[0].id;

    // Ineligible 2: ACTIVE old loan
    const brActive = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES ($1, $2, ${oldStart}, ${oldDue}, 'ACTIVE') RETURNING id`,
        [patron.id, copies[3].id]
      )
    ).rows[0].id;

    // Ineligible 3: OVERDUE old loan
    const brOverdue = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES ($1, $2, ${oldStart}, ${oldDue}, 'OVERDUE') RETURNING id`,
        [patron.id, copies[4].id]
      )
    ).rows[0].id;

    // Ineligible 4: LOST old loan
    const brLost = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status)
         VALUES ($1, $2, ${oldStart}, ${oldDue}, 'LOST') RETURNING id`,
        [patron.id, copies[5].id]
      )
    ).rows[0].id;

    // Ineligible 5: RETURNED on/after cutoff
    const brRecent = (
      await db.query<{ id: string }>(
        `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status)
         VALUES ($1, $2, ${oldStart}, ${oldDue}, ${afterCutoff}, 'RETURNED') RETURNING id`,
        [patron2.id, copies[0].id]
      )
    ).rows[0].id;

    // 4. Seed attendance (eligible vs ineligible)
    // Eligible attendance: checked out before cutoff with 'No Log Out' note
    const attEligible = (
      await db.query<{ id: string }>(
        `INSERT INTO public.attendance (user_id, check_in_at, check_out_at, notes)
         VALUES ($1, ${oldStart}, ${oldEnd}, 'No Log Out') RETURNING id`,
        [patron.id]
      )
    ).rows[0].id;

    // Ineligible attendance 1: open check-in (check_out_at IS NULL)
    const attOpen = (
      await db.query<{ id: string }>(
        `INSERT INTO public.attendance (user_id, check_in_at)
         VALUES ($1, ${oldStart}) RETURNING id`,
        [patron.id]
      )
    ).rows[0].id;

    // Ineligible attendance 2: checked out on/after cutoff
    const attRecent = (
      await db.query<{ id: string }>(
        `INSERT INTO public.attendance (user_id, check_in_at, check_out_at)
         VALUES ($1, ${oldStart}, ${afterCutoff}) RETURNING id`,
        [patron2.id]
      )
    ).rows[0].id;

    // Run RPC as super_admin
    const res = await withRole(db, 'authenticated', admin.id, (tx) =>
      tx.query<{ result: { before: string; borrowing_count: number; attendance_count: number; total_count: number } }>(
        `SELECT public.archive_old_logs($1::date) AS result`,
        [validCutoff]
      )
    );

    expect(res.rows[0].result).toEqual({
      before: validCutoff,
      borrowing_count: 2,
      attendance_count: 1,
      total_count: 3,
    });

    // Verify remaining rows in live tables
    const liveBorrowingIds = (
      await db.query<{ id: string }>(`SELECT id FROM public.borrowing_records ORDER BY id`)
    ).rows.map((r) => r.id);
    expect(new Set(liveBorrowingIds)).toEqual(new Set([brUnsettled, brActive, brOverdue, brLost, brRecent]));

    const liveAttendanceIds = (
      await db.query<{ id: string }>(`SELECT id FROM public.attendance ORDER BY id`)
    ).rows.map((r) => r.id);
    expect(new Set(liveAttendanceIds)).toEqual(new Set([attOpen, attRecent]));

    // Verify archived rows & WP1/WP3 columns preserved
    const archBorrowing = await db.query<{
      id: string;
      fine_resolution: string | null;
      fine_remarks: string | null;
      fine_settled_by: string | null;
      archived_at: string;
    }>(`SELECT id, fine_resolution, fine_remarks, fine_settled_by, archived_at FROM public.borrowing_records_archive`);
    expect(new Set(archBorrowing.rows.map((r) => r.id))).toEqual(new Set([brEligibleClean, brEligibleSettled]));
    const settledArch = archBorrowing.rows.find((r) => r.id === brEligibleSettled)!;
    expect(settledArch.fine_resolution).toBe('CONDONED');
    expect(settledArch.fine_remarks).toBe('Medical excuse approved');
    expect(settledArch.fine_settled_by).toBe(librarian.id);
    expect(settledArch.archived_at).toBeTruthy();

    const archAttendance = await db.query<{ id: string; notes: string | null; archived_at: string }>(
      `SELECT id, notes, archived_at FROM public.attendance_archive`
    );
    expect(archAttendance.rows).toHaveLength(1);
    expect(archAttendance.rows[0].id).toBe(attEligible);
    expect(archAttendance.rows[0].notes).toBe('No Log Out');
    expect(archAttendance.rows[0].archived_at).toBeTruthy();
  });
});

describe('QA circulation fixes (20261117120000)', () => {
  let db: PGlite;
  let librarian: { id: string; cardNumber: string };
  let student1: { id: string; cardNumber: string };
  let student2: { id: string; cardNumber: string };

  beforeEach(async () => {
    db = await bootLuminaDb();
    await createUser(db, { email: 'admin@alabang.sti.edu.ph', fullName: 'Admin User' });
    librarian = await createUser(db, { email: 'lib@alabang.sti.edu.ph', fullName: 'Librarian User', role: 'librarian', status: 'ACTIVE', cardStatus: 'ACTIVE' });
    student1 = await createUser(db, { email: 'juan.111111@alabang.sti.edu.ph', fullName: 'Juan Dela Cruz', status: 'ACTIVE', cardStatus: 'ACTIVE' });
    student2 = await createUser(db, { email: 'maria.222222@alabang.sti.edu.ph', fullName: 'Maria Clara', status: 'ACTIVE', cardStatus: 'ACTIVE' });
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  const reserve = (userId: string, bookId: string) =>
    withRole(db, 'authenticated', userId, (tx) =>
      tx.query<{ res: Record<string, unknown> }>(`SELECT public.create_reservation_atomic($1, $2) AS res`, [userId, bookId])
    ).then((r) => r.rows[0].res);

  const checkout = (card: string, qr: string, key: string | null = null) =>
    db
      .query<{ res: Record<string, unknown> }>(`SELECT public.process_qr_checkout($1, $2, $3, $4, false) AS res`, [librarian.id, card, qr, key])
      .then((r) => r.rows[0].res);

  const giveLoan = async (userId: string, copyId: string, status: string, dueOffset: string, fine: number | null = null) => {
    await db.query(`UPDATE public.book_copies SET status = $2 WHERE id = $1`, [copyId, status === 'LOST' ? 'LOST' : 'BORROWED']);
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, status, fine_amount)
       VALUES ($1, $2, NOW() - interval '30 days', NOW() + $3::interval, $4, $5)`,
      [userId, copyId, dueOffset, status, fine]
    );
  };

  it('returning a borrowed copy promotes the next hold to READY and notifies that patron', async () => {
    const { bookId, copies } = await createBookWithCopies(db, { title: 'Queued Book' });
    expect(await checkout(student1.cardNumber, copies[0].qr)).toMatchObject({ ok: true });
    expect(await reserve(student2.id, bookId)).toMatchObject({ ok: true, status: 'ACTIVE' });

    const ret = await db.query<{ res: Record<string, unknown> }>(`SELECT public.process_qr_return($1, $2, NULL, false) AS res`, [librarian.id, copies[0].qr]);
    expect(ret.rows[0].res).toMatchObject({ ok: true, reservation_ready: true });

    const notes = await db.query<{ title: string; type: string; priority: string; content: string }>(
      `SELECT title, type, priority, content FROM public.notifications WHERE user_id = $1`,
      [student2.id]
    );
    expect(notes.rows).toHaveLength(1);
    expect(notes.rows[0]).toMatchObject({ title: 'Reservation Ready for Pickup', type: 'RESERVATION', priority: 'high' });
    expect(notes.rows[0].content).toContain('"Queued Book" is ready for pickup');
    expect((await db.query(`SELECT id FROM public.notifications WHERE user_id = $1`, [student1.id])).rows).toHaveLength(0);
  });

  it('refuses reservations and checkouts of archived titles', async () => {
    const { bookId, copies } = await createBookWithCopies(db, { title: 'Archived', isActive: false });
    expect(await reserve(student1.id, bookId)).toMatchObject({ ok: false, code: 'BOOK_ARCHIVED' });
    expect(await checkout(student1.cardNumber, copies[0].qr)).toMatchObject({ ok: false, code: 'BOOK_ARCHIVED' });
    expect((await db.query(`SELECT id FROM public.reservations`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT id FROM public.borrowing_records`)).rows).toHaveLength(0);
  });

  it('blocks reservations for overdue loans, lost loans and unpaid fines, with the checkout wording', async () => {
    const { bookId } = await createBookWithCopies(db, { title: 'Wanted' });
    const other = await createBookWithCopies(db, { title: 'Held', copyStatuses: ['AVAILABLE', 'AVAILABLE'] });

    // Not yet due: allowed
    await giveLoan(student1.id, other.copies[0].id, 'ACTIVE', '3 days');
    expect(await reserve(student1.id, bookId)).toMatchObject({ ok: true });
    await db.query(`DELETE FROM public.reservations`);
    await db.query(`UPDATE public.book_copies SET status = 'AVAILABLE' WHERE book_id = $1`, [bookId]);

    // ACTIVE but past due (cron has not flipped it yet) counts as overdue
    await db.query(`UPDATE public.borrowing_records SET due_date = NOW() - interval '2 days' WHERE user_id = $1`, [student1.id]);
    const overdue = await reserve(student1.id, bookId);
    expect(overdue).toMatchObject({ ok: false, code: 'BORROWING_BLOCKED' });
    expect(overdue.message).toMatch(/^User has 1 overdue book\(s\) and ₱\d+\.00 in unpaid fines\./);

    // LOST loan counts as overdue
    await giveLoan(student2.id, other.copies[1].id, 'LOST', '5 days', 0);
    expect(await reserve(student2.id, bookId)).toMatchObject({
      ok: false,
      code: 'BORROWING_BLOCKED',
      message: 'User has 1 overdue book(s). Please return them before borrowing more.',
    });

    // Returned loan with an unsettled fine
    await db.query(`DELETE FROM public.borrowing_records`);
    await db.query(`UPDATE public.book_copies SET status = 'AVAILABLE'`);
    await db.query(
      `INSERT INTO public.borrowing_records (user_id, book_copy_id, borrowed_at, due_date, returned_at, status, fine_amount)
       VALUES ($1, $2, NOW() - interval '20 days', NOW() - interval '6 days', NOW() - interval '1 day', 'RETURNED', 25)`,
      [student1.id, other.copies[0].id]
    );
    expect(await reserve(student1.id, bookId)).toMatchObject({
      ok: false,
      code: 'BORROWING_BLOCKED',
      message: 'User has ₱25.00 in unpaid fines. Please settle them before borrowing more.',
    });

    // Settled fine: allowed again
    await db.query(`UPDATE public.borrowing_records SET fine_settled_at = NOW(), fine_resolution = 'PAID'`);
    expect(await reserve(student1.id, bookId)).toMatchObject({ ok: true });
  });

  it('checkout of a READY hold sets fulfilled_at', async () => {
    const { bookId, copies } = await createBookWithCopies(db, { title: 'Hold Me' });
    const rsv = await reserve(student1.id, bookId);
    expect(rsv).toMatchObject({ ok: true, status: 'READY' });
    await db.query(`UPDATE public.reservations SET fulfilled_at = NULL WHERE id = $1`, [rsv.reservation_id]);
    expect(await checkout(student1.cardNumber, copies[0].qr)).toMatchObject({ ok: true });
    const row = await db.query<{ status: string; fulfilled: boolean }>(
      `SELECT status::text, fulfilled_at IS NOT NULL AS fulfilled FROM public.reservations WHERE id = $1`,
      [rsv.reservation_id]
    );
    expect(row.rows[0]).toEqual({ status: 'FULFILLED', fulfilled: true });
  });

  it('rejects a reused idempotency key with a different card or book, but replays the same request', async () => {
    const { copies } = await createBookWithCopies(db, { title: 'Twice', copyStatuses: ['AVAILABLE', 'AVAILABLE'] });
    const first = await checkout(student1.cardNumber, copies[0].qr, 'k-1');
    expect(first).toMatchObject({ ok: true });
    expect(await checkout(student1.cardNumber, copies[0].qr, 'k-1')).toMatchObject({ ok: true, idempotent: true, borrowing_id: first.borrowing_id });
    expect(await checkout(student1.cardNumber, copies[1].qr, 'k-1')).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    expect(await checkout(student2.cardNumber, copies[0].qr, 'k-1')).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    expect((await db.query(`SELECT id FROM public.borrowing_records`)).rows).toHaveLength(1);

    const ret = (qr: string) =>
      db
        .query<{ res: Record<string, unknown> }>(`SELECT public.process_qr_return($1, $2, 'r-1', false) AS res`, [librarian.id, qr])
        .then((r) => r.rows[0].res);
    expect(await ret(copies[0].qr)).toMatchObject({ ok: true });
    expect(await ret(copies[0].qr)).toMatchObject({ ok: true, idempotent: true });
    expect(await ret(copies[1].qr)).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('scanning a found LOST copy closes the lost loan, computes the overdue fine and frees the copy', async () => {
    const { copies } = await createBookWithCopies(db, { title: 'Found Book' });
    await giveLoan(student1.id, copies[0].id, 'LOST', '-3 days');

    const res = await db.query<{ res: Record<string, unknown> }>(`SELECT public.process_qr_return($1, $2, NULL, false) AS res`, [librarian.id, copies[0].qr]);
    expect(res.rows[0].res).toMatchObject({ ok: true, student_name: 'Juan Dela Cruz', overdue_days: 3, fine_amount: 15 });

    const loan = await db.query<{ status: string; returned: boolean; fine_amount: string }>(
      `SELECT status::text, returned_at IS NOT NULL AS returned, fine_amount::text FROM public.borrowing_records`
    );
    expect(loan.rows[0]).toEqual({ status: 'RETURNED', returned: true, fine_amount: '15.00' });
    expect((await db.query<{ status: string }>(`SELECT status FROM public.book_copies WHERE id = $1`, [copies[0].id])).rows[0].status).toBe('AVAILABLE');
  });
});
