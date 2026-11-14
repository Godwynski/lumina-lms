import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('links book and student history independently of the staff actor, including legacy barcode returns', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create table audit_logs (id uuid, admin_id uuid, entity_type text, entity_id uuid, action text, reason text, details jsonb, old_value jsonb, new_value jsonb, created_at timestamptz);
      create table books (id uuid, title text, isbn text);
      create table profiles (id uuid, full_name text, student_id text, email text);
      create table book_copies (id uuid, book_id uuid, qr_string text, accession_number text);
      create table borrowing_records (id uuid, user_id uuid, book_copy_id uuid, returned_at timestamptz);
      create table reservations (id uuid, user_id uuid, book_id uuid, copy_id uuid);
      create table library_cards (id uuid, user_id uuid, card_number text);
      insert into books values ('00000000-0000-0000-0000-000000000001','Book One','123');
      insert into profiles values ('00000000-0000-0000-0000-000000000002','Student','STU-1','student@school.edu');
      insert into book_copies values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','QR-1','ACC-1');
      insert into borrowing_records values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','2026-11-13T01:00:00Z');
      insert into audit_logs values
        ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000099','borrowing_record','00000000-0000-0000-0000-000000000004','checkout',null,'{}',null,null,'2026-11-12T01:00:00Z'),
        ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000099','book_copy',null,'return',null,'{"bookQr":"QR-1"}',null,null,'2026-11-13T01:00:01Z'),
        ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','system',null,'update',null,'{}',null,null,'2026-11-13T01:00:00Z');
    `);
    await db.exec(readFileSync('supabase/migrations/20261113020000_audit_record_subjects.sql', 'utf8'));
    const { rows } = await db.query(`select action,book_title,student_name,copy_barcode from audit_log_records where subject_book_id='00000000-0000-0000-0000-000000000001' and subject_student_id='00000000-0000-0000-0000-000000000002' order by created_at`);
    expect(rows).toEqual([
      { action: 'checkout', book_title: 'Book One', student_name: 'Student', copy_barcode: 'QR-1' },
      { action: 'return', book_title: 'Book One', student_name: 'Student', copy_barcode: 'QR-1' },
    ]);
    expect((await db.query(`select * from audit_log_records where subject_student_id='00000000-0000-0000-0000-000000000099'`)).rows).toEqual([]);
    await db.exec(`insert into borrowing_records values ('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000003','2026-11-13T01:01:00Z')`);
    expect((await db.query(`select subject_student_id from audit_log_records where action='return'`)).rows).toEqual([{ subject_student_id: null }]);
    await db.exec(`
      grant select on all tables in schema public to authenticated;
      alter table audit_logs enable row level security;
      create policy no_student_access on audit_logs for select to authenticated using (false);
      set role authenticated;
    `);
    expect((await db.query(`select * from audit_log_records`)).rows).toEqual([]);
  } finally { await db.close(); }
});
