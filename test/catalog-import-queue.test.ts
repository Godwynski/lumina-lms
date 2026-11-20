import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('claims only two items, commits copies once, preserves data, fences stale workers and restricts access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create table public.profiles(id uuid,role text,status text);
      create table public.books(id uuid primary key default gen_random_uuid(),title text not null,author text not null,isbn text,is_active boolean,description text,dewey_decimal text,published_year integer,tags text[],updated_at timestamptz,cover_url text);
      create table public.book_copies(id uuid primary key default gen_random_uuid(),book_id uuid references books(id),status text);
    `);
    await db.exec(readFileSync('supabase/migrations/20261113090000_catalog_import_queue.sql','utf8'));
    const job='00000000-0000-4000-8000-000000000001';
    const rows=[{isbn:'9781492040347',mode:'create',requested_copies:2},{isbn:'9780451524935',mode:'create',requested_copies:1},{isbn:'9780345339683',mode:'create',requested_copies:1}];
    await db.query('select catalog_import_enqueue($1,null,$2,$3)',[job,'Test',JSON.stringify(rows)]);
    await db.query('select catalog_import_enqueue($1,null,$2,$3)',[job,'Test',JSON.stringify(rows)]);
    expect((await db.query('select * from catalog_import_items')).rows).toHaveLength(3);
    const { rows: claimed } = await db.query<{id:string;lease:string;isbn:string}>('select * from catalog_import_claim()');
    expect(claimed).toHaveLength(2);
    expect((await db.query('select * from catalog_import_claim()')).rows).toHaveLength(0);
    const item=claimed.find(row=>row.isbn==='9781492040347')!;
    const data=JSON.stringify({title:'Original Title',author:'Original Author',description:'Original description'});
    await db.query('select catalog_import_apply_book($1,$2,$3)',[item.id,item.lease,data]);
    await db.query('select catalog_import_apply_book($1,$2,$3)',[item.id,item.lease,JSON.stringify({title:'Overwrite',author:'Overwrite',description:'Overwrite'})]);
    expect((await db.query('select * from book_copies')).rows).toHaveLength(2);
    expect((await db.query('select title,description from books')).rows).toEqual([{title:'Original Title',description:'Original description'}]);
    const finish='select catalog_import_finish($1,$2,$3,$4,$5,$6,$7,$8) as finished';
    expect((await db.query(finish,[item.id,job,'complete','complete','complete',null,'[]',0])).rows).toEqual([{finished:false}]);
    expect((await db.query(finish,[item.id,item.lease,'retry','complete','pending','Cover retry','[]',0])).rows).toEqual([{finished:true}]);
    await db.exec("update catalog_import_items set next_attempt_at=now()+interval '1 hour' where status='queued'");
    const retried=(await db.query<{id:string;lease:string}>('select * from catalog_import_claim()')).rows.find(r=>r.id===item.id)!;
    await db.query('select catalog_import_apply_book($1,$2,$3)',[retried.id,retried.lease,data]);
    expect((await db.query('select * from book_copies')).rows).toHaveLength(2);
    await db.exec('grant select on profiles to authenticated; grant usage on schema auth to authenticated; set role authenticated');
    expect((await db.query('select * from catalog_import_jobs')).rows).toHaveLength(0);
    await expect(db.query('select * from catalog_import_claim()')).rejects.toThrow(/permission denied/i);
  } finally { await db.close(); }
});
