// @vitest-environment node
//
// Runs supabase/schema_clean_install.sql in real Postgres (PGlite, in-process,
// no Docker) with small stand-ins for Supabase's auth/storage parts, then acts
// as each user type.
//
// "Known bugs" use it.fails: each test states the CORRECT behavior, so it fails
// today and CI stays green. When a fix lands, change that it.fails to it.
// IDs match docs/AUDIT_CHECKLIST.md.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'node:fs';
import path from 'node:path';
import { isValidPolicyValue } from '@/lib/actions/policy-constants';

const SQL_DIR = path.resolve(process.cwd(), 'supabase');

// Minimal Supabase stand-ins: roles, auth.uid()/auth.jwt(), storage tables,
// the realtime publication, and Supabase's default grants.
const PRELUDE = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
CREATE TABLE storage.buckets(id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ select string_to_array(name,'/') $$;
CREATE PUBLICATION supabase_realtime;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth, storage TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
`;

let db: PGlite;
const u = { admin: '', lib: '', sa: '', stu: '', stu2: '', pending: '' };
let stuCard = '';
let stu2Card = '';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Result = { ok: true; rows: Row[]; affected: number } | { ok: false; error: string; rows?: undefined; affected?: undefined };

// Superuser query (like a migration or Supabase Auth). Throws on error.
async function q(sql: string, params: unknown[] = []): Promise<Row[]> {
  return (await db.query<Row>(sql, params)).rows;
}

// Query that may fail; a savepoint keeps the test's transaction usable.
async function tryq(sql: string, params: unknown[] = []): Promise<Result> {
  await db.exec('SAVEPOINT t');
  try {
    const r = await db.query<Row>(sql, params);
    await db.exec('RELEASE SAVEPOINT t');
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 };
  } catch (e) {
    await db.exec('ROLLBACK TO SAVEPOINT t');
    return { ok: false, error: (e as Error).message };
  }
}

async function serviceClaims() {
  await db.exec(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false), set_config('request.jwt.claim.sub', '', false)`);
}

// Run fn as a logged-in user (RLS applies) or as the service role.
async function as<T>(who: string | 'service', fn: () => Promise<T>): Promise<T> {
  await db.exec('RESET ROLE');
  if (who === 'service') {
    await serviceClaims();
    await db.exec('SET ROLE service_role');
  } else {
    await db.query(`SELECT set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)`, [
      JSON.stringify({ role: 'authenticated', sub: who }),
      who,
    ]);
    await db.exec('SET ROLE authenticated');
  }
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await serviceClaims();
  }
}

// The jsonb returned by a `SELECT fn(...) r` call, or null if the call errored.
async function rpc(who: string | 'service', sql: string, params: unknown[] = []): Promise<Row | null> {
  const r = await as(who, () => tryq(sql, params));
  return r.ok ? r.rows[0].r : null;
}

const newUser = async (email: string) =>
  (await q(`INSERT INTO auth.users(email, raw_user_meta_data) VALUES ($1, '{"full_name":"T"}') RETURNING id`, [email]))[0].id as string;

async function newBook(copies: number) {
  const book = (await q(`INSERT INTO public.books(title, author) VALUES ('Test Book', 'Author') RETURNING id`))[0].id as string;
  for (let i = 0; i < copies; i++) await q(`INSERT INTO public.book_copies(book_id, status) VALUES ($1, 'AVAILABLE')`, [book]);
  const qrs = (await q(`SELECT qr_string FROM public.book_copies WHERE book_id = $1 ORDER BY created_at, qr_string`, [book])).map(r => r.qr_string as string);
  return { book, qrs };
}

const checkout = (card: string, qr: string, previewOnly = false) =>
  rpc('service', `SELECT public.process_qr_checkout($1, $2, $3, NULL, $4) r`, [u.lib, card, qr, previewOnly]);

const roleOf = async (id: string) => (await q(`SELECT role FROM public.profiles WHERE id = $1`, [id]))[0].role;

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm, uuid_ossp } });
  await db.exec(PRELUDE);
  await db.exec(fs.readFileSync(path.join(SQL_DIR, 'schema_clean_install.sql'), 'utf8'));
  await serviceClaims();

  u.admin = await newUser('admin.fac@alabang.sti.edu.ph');
  u.lib = await newUser('librarian.fac@alabang.sti.edu.ph');
  u.sa = await newUser('assistant.111111@alabang.sti.edu.ph');
  u.stu = await newUser('juan.376536@alabang.sti.edu.ph');
  u.stu2 = await newUser('maria.222222@alabang.sti.edu.ph');
  u.pending = await newUser('pedro.333333@alabang.sti.edu.ph'); // stays PENDING
  await q(`UPDATE public.profiles SET role = 'super_admin', status = 'ACTIVE' WHERE id = $1`, [u.admin]);
  await q(`UPDATE public.profiles SET role = 'librarian', status = 'ACTIVE' WHERE id = $1`, [u.lib]);
  await q(`UPDATE public.profiles SET role = 'student_assistant', status = 'ACTIVE', permissions = '{}'::jsonb WHERE id = $1`, [u.sa]);
  await q(`UPDATE public.profiles SET status = 'ACTIVE', phone = '+63 900 000 0000', address = 'Test St' WHERE id IN ($1, $2)`, [u.stu, u.stu2]);
  await q(`UPDATE public.library_cards SET status = 'ACTIVE' WHERE user_id IN ($1, $2)`, [u.stu, u.stu2]);
  stuCard = (await q(`SELECT card_number FROM public.library_cards WHERE user_id = $1`, [u.stu]))[0].card_number;
  stu2Card = (await q(`SELECT card_number FROM public.library_cards WHERE user_id = $1`, [u.stu2]))[0].card_number;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

// Every test runs in its own transaction and is rolled back.
beforeEach(async () => {
  await db.exec('BEGIN');
});
afterEach(async () => {
  await db.exec('RESET ROLE');
  await db.exec('ROLLBACK');
});

describe('real DB: behavior that is already correct', () => {
  it('loads sample_data.sql, and book copy counts match the copies', async () => {
    await db.exec(fs.readFileSync(path.join(SQL_DIR, 'sample_data.sql'), 'utf8'));
    const bad = await q(`
      SELECT b.id FROM public.books b
      WHERE b.total_copies <> (SELECT count(*) FROM public.book_copies c WHERE c.book_id = b.id)
         OR b.available_copies <> (SELECT count(*) FROM public.book_copies c WHERE c.book_id = b.id AND c.status = 'AVAILABLE')`);
    expect(bad).toEqual([]);
  });

  it('keeps total/available copy counts in sync through the trigger', async () => {
    const { book, qrs } = await newBook(2);
    await q(`UPDATE public.book_copies SET status = 'MAINTENANCE' WHERE qr_string = $1`, [qrs[0]]);
    expect((await q(`SELECT total_copies, available_copies FROM public.books WHERE id = $1`, [book]))[0]).toEqual({ total_copies: 2, available_copies: 1 });
    await q(`DELETE FROM public.book_copies WHERE book_id = $1`, [book]);
    expect((await q(`SELECT total_copies, available_copies FROM public.books WHERE id = $1`, [book]))[0]).toEqual({ total_copies: 0, available_copies: 0 });
  });

  it('rejects impossible rows (check constraints)', async () => {
    expect((await tryq(`INSERT INTO public.books(title, author, total_copies, available_copies) VALUES ('x', 'y', 1, 2)`)).ok).toBe(false);
    expect((await tryq(`INSERT INTO public.books(title, author, published_year) VALUES ('x', 'y', 2500)`)).ok).toBe(false);
    const { qrs } = await newBook(1);
    expect((await checkout(stuCard, qrs[0]))?.ok).toBe(true);
    expect((await tryq(`UPDATE public.borrowing_records SET due_date = borrowed_at - interval '1 day' WHERE user_id = $1`, [u.stu])).ok).toBe(false);
  });

  it('blocks deleting a borrower who has loan history', async () => {
    const { qrs } = await newBook(1);
    await checkout(stuCard, qrs[0]);
    expect((await tryq(`DELETE FROM public.profiles WHERE id = $1`, [u.stu])).ok).toBe(false);
  });

  it('stops a student from changing their own role', async () => {
    await as(u.stu, () => tryq(`UPDATE public.profiles SET role = 'librarian' WHERE id = $1`, [u.stu]));
    expect(await roleOf(u.stu)).toBe('student');
  });

  it('stops a student from calling the checkout function directly', async () => {
    const { qrs } = await newBook(1);
    const r = await as(u.stu, () => tryq(`SELECT public.process_qr_checkout($1, $2, $3)`, [u.stu, stuCard, qrs[0]]));
    expect(r.ok).toBe(false);
  });

  it('gives a returned copy to the next student in the queue', async () => {
    const { book, qrs } = await newBook(1);
    expect((await checkout(stu2Card, qrs[0]))?.ok).toBe(true);
    expect((await rpc(u.stu, `SELECT public.create_reservation_atomic($1, $2) r`, [u.stu, book]))?.status).toBe('ACTIVE');
    const ret = await rpc('service', `SELECT public.process_qr_return($1, $2) r`, [u.lib, qrs[0]]);
    expect(ret?.reservation_ready).toBe(true);
  });

  it('shows a student only their own borrowing history', async () => {
    const a = await newBook(1);
    const b = await newBook(1);
    await checkout(stuCard, a.qrs[0]);
    await checkout(stu2Card, b.qrs[0]);
    const r = await as(u.stu2, () => tryq(`SELECT count(*)::int n FROM public.get_borrowing_history_v2(NULL, 1, 1000)`));
    expect(r.ok && r.rows[0].n).toBe(1);
  });

  it('lets staff read every profile', async () => {
    const r = await as(u.lib, () => tryq(`SELECT count(*)::int n FROM public.profiles`));
    expect(r.ok && r.rows[0].n).toBe(6);
  });
});

describe('real DB: known bugs (it.fails until fixed — flip to it when fixed)', () => {
  // --- B2.1: RLS, roles and sign-up ---
  // A unique index allows one super_admin, so the attack demotes the admin first.
  it.fails('C1 a librarian cannot promote themselves to super_admin', async () => {
    await as(u.lib, async () => {
      await tryq(`UPDATE public.profiles SET role = 'student' WHERE id = $1`, [u.admin]);
      await tryq(`UPDATE public.profiles SET role = 'super_admin' WHERE id = $1`, [u.lib]);
    });
    expect(await roleOf(u.lib)).toBe('librarian');
  });

  it.fails('C1 a librarian cannot demote the super admin', async () => {
    await as(u.lib, () => tryq(`UPDATE public.profiles SET role = 'student' WHERE id = $1`, [u.admin]));
    expect(await roleOf(u.admin)).toBe('super_admin');
  });

  it.fails('C2 a student can read only their own profile', async () => {
    const r = await as(u.stu, () => tryq(`SELECT count(*)::int n FROM public.profiles`));
    expect(r.ok && r.rows[0].n).toBe(1);
  });

  it.fails("C2 a pending user cannot read another student's phone and address", async () => {
    const r = await as(u.pending, () => tryq(`SELECT phone, address FROM public.profiles WHERE id = $1`, [u.stu]));
    expect(r.ok && r.rows.length).toBe(0);
  });

  it.fails('C3 sign-up from a non-school email domain is rejected', async () => {
    expect((await tryq(`INSERT INTO auth.users(email) VALUES ('random.person@gmail.com')`)).ok).toBe(false);
  });

  it.fails("C3 an outsider cannot take a real student's number before they sign up", async () => {
    await tryq(`INSERT INTO auth.users(email) VALUES ('fake.555555@gmail.com')`);
    expect((await tryq(`INSERT INTO auth.users(email) VALUES ('real.555555@alabang.sti.edu.ph')`)).ok).toBe(true);
  });

  it.fails('C3 a user without a student ID cannot set one themselves', async () => {
    await q(`UPDATE public.profiles SET student_id = NULL WHERE id = $1`, [u.stu]);
    await as(u.stu, () => tryq(`UPDATE public.profiles SET student_id = 'STU-999999' WHERE id = $1`, [u.stu]));
    expect((await q(`SELECT student_id FROM public.profiles WHERE id = $1`, [u.stu]))[0].student_id).toBeNull();
  });

  it.fails('M13 a student cannot insert their own attendance', async () => {
    const r = await as(u.stu, () =>
      tryq(`INSERT INTO public.attendance(user_id, check_in_at, check_out_at) VALUES ($1, now() - interval '30 days', now() - interval '30 days' + interval '6 hours')`, [u.stu]),
    );
    expect(r.ok).toBe(false);
  });

  it.fails('M13 a student cannot check themselves out', async () => {
    await q(`INSERT INTO public.attendance(user_id) VALUES ($1)`, [u.stu]);
    await as(u.stu, () => tryq(`UPDATE public.attendance SET check_out_at = now() + interval '5 hours' WHERE user_id = $1`, [u.stu]));
    expect((await q(`SELECT check_out_at FROM public.attendance WHERE user_id = $1`, [u.stu]))[0].check_out_at).toBeNull();
  });

  it.fails('M14 a student assistant cannot close a loan directly', async () => {
    const { qrs } = await newBook(1);
    await checkout(stuCard, qrs[0]);
    await as(u.sa, () => tryq(`UPDATE public.borrowing_records SET status = 'RETURNED', returned_at = now() WHERE user_id = $1`, [u.stu]));
    expect((await q(`SELECT status FROM public.borrowing_records WHERE user_id = $1`, [u.stu]))[0].status).toBe('ACTIVE');
  });

  it.fails("M14 a student assistant cannot change a copy's status directly", async () => {
    const { qrs } = await newBook(1);
    await as(u.sa, () => tryq(`UPDATE public.book_copies SET status = 'LOST' WHERE qr_string = $1`, [qrs[0]]));
    expect((await q(`SELECT status FROM public.book_copies WHERE qr_string = $1`, [qrs[0]]))[0].status).toBe('AVAILABLE');
  });

  it.fails('M17 the last super admin cannot demote themselves', async () => {
    await as(u.admin, () => tryq(`UPDATE public.profiles SET role = 'librarian' WHERE id = $1`, [u.admin]));
    expect((await q(`SELECT count(*)::int n FROM public.profiles WHERE role = 'super_admin'`))[0].n).toBe(1);
  });

  // --- B2.2: circulation SQL functions ---
  it.fails('C4 a PENDING account cannot reserve books', async () => {
    const { book } = await newBook(1);
    expect((await rpc(u.pending, `SELECT public.create_reservation_atomic($1, $2) r`, [u.pending, book]))?.ok).toBe(false);
  });

  it.fails('C4 max_reservations_per_student is enforced', async () => {
    await q(`INSERT INTO public.system_settings(key, value, description, data_type) VALUES ('max_reservations_per_student', '1', 'x', 'number')
             ON CONFLICT (key) DO UPDATE SET value = '1'`);
    const a = await newBook(1);
    const b = await newBook(1);
    expect((await rpc(u.stu, `SELECT public.create_reservation_atomic($1, $2) r`, [u.stu, a.book]))?.ok).toBe(true);
    expect((await rpc(u.stu, `SELECT public.create_reservation_atomic($1, $2) r`, [u.stu, b.book]))?.code).toBe('RESERVATION_LIMIT');
  });

  // Only the counting half of M10; the race needs two connections, which PGlite doesn't have.
  it.fails('M10 an OVERDUE loan counts toward the borrow limit', async () => {
    await q(`UPDATE public.system_settings SET value = '1' WHERE key = 'max_borrow_limit'`);
    const { qrs } = await newBook(2);
    expect((await checkout(stuCard, qrs[0]))?.ok).toBe(true);
    await q(`UPDATE public.borrowing_records SET status = 'OVERDUE' WHERE user_id = $1`, [u.stu]);
    expect((await checkout(stuCard, qrs[1]))?.code).toBe('LIMIT_EXCEEDED');
  });

  it.fails('M12 the return preview includes borrowed_at and due_date', async () => {
    const { qrs } = await newBook(1);
    await checkout(stuCard, qrs[0]);
    const pv = await rpc('service', `SELECT public.process_qr_return($1, $2, NULL, true) r`, [u.lib, qrs[0]]);
    expect(pv?.borrowed_at).toBeTruthy();
    expect(pv?.due_date).toBeTruthy();
  });

  it.fails('m2 a student can see when a borrowed book is due back', async () => {
    const { book, qrs } = await newBook(1);
    await checkout(stu2Card, qrs[0]);
    const due = (await q(`SELECT due_date::date::text d FROM public.borrowing_records WHERE user_id = $1`, [u.stu2]))[0].d;
    const r = await as(u.stu, () => tryq(`SELECT public.get_next_due_date($1)::date::text d`, [book]));
    expect(r.ok && r.rows[0].d).toBe(due);
  });

  // --- B1.2: policy route validation (app code + real checkout SQL together) ---
  it('M4 every loan_period_days value the policy route accepts keeps checkout working', async () => {
    const { qrs } = await newBook(1);
    expect(isValidPolicyValue('loan_period_days', '7')).toBe(true);
    expect(isValidPolicyValue('unknown_key', '7')).toBe(false);
    for (const value of ['1.5', '7', '1e1', ' 14 ']) {
      if (!isValidPolicyValue('loan_period_days', value)) continue;
      await q(`UPDATE public.system_settings SET value = $1 WHERE key = 'loan_period_days'`, [value]);
      expect((await checkout(stuCard, qrs[0], true))?.ok, `loan_period_days = ${value}`).toBe(true);
    }
  });

  // --- B4.1: reservation queue ---
  it.fails('M1 a hold still expires when the hold_expiry_days setting is missing', async () => {
    await q(`DELETE FROM public.system_settings WHERE key = 'hold_expiry_days'`);
    const { book } = await newBook(1);
    const r = await rpc(u.stu, `SELECT public.create_reservation_atomic($1, $2) r`, [u.stu, book]);
    expect(r?.ok).toBe(true);
    expect(r?.hold_expires_at).not.toBeNull();
  });

  // --- B5.1: unused tables ---
  it.fails('M26 the six unused tables are dropped', async () => {
    const tables = ['announcements', 'reports', 'deleted_profile_info', 'rate_limit_log', 'checklist_items', 'checklist_dropdown_options'];
    const left = await q(`SELECT t FROM unnest($1::text[]) t WHERE to_regclass('public.' || t) IS NOT NULL`, [tables]);
    expect(left).toEqual([]);
  });
});
