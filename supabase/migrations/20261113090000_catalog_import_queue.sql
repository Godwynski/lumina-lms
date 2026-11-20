create table public.catalog_import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  label text not null,
  created_at timestamptz not null default now()
);
create table public.catalog_import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.catalog_import_jobs(id) on delete cascade,
  isbn text,
  book_id uuid references public.books(id) on delete set null,
  mode text not null check (mode in ('create','enrich')),
  requested_copies integer not null default 1 check (requested_copies between 0 and 50),
  copies_applied boolean not null default false,
  status text not null default 'queued' check (status in ('queued','processing','retry','complete','review','failed')),
  metadata_status text not null default 'pending' check (metadata_status in ('pending','complete','missing')),
  cover_status text not null default 'pending' check (cover_status in ('pending','complete','missing')),
  covers jsonb not null default '[]',
  cover_source text,
  title text,
  attempts integer not null default 0 check (attempts between 0 and 4),
  lease uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  error text,
  created_at timestamptz not null default now()
);
create index catalog_import_items_pending on public.catalog_import_items(next_attempt_at,created_at) where status in ('queued','retry','processing');
create index catalog_import_items_job on public.catalog_import_items(job_id);
alter table public.catalog_import_jobs enable row level security;
alter table public.catalog_import_items enable row level security;
create policy import_staff_read on public.catalog_import_jobs for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('super_admin','librarian') and status='ACTIVE')
);
create policy import_staff_read on public.catalog_import_items for select to authenticated using (
  exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('super_admin','librarian') and status='ACTIVE')
);
revoke all on public.catalog_import_jobs,public.catalog_import_items from anon,authenticated;
grant select on public.catalog_import_jobs,public.catalog_import_items to authenticated;
grant all on public.catalog_import_jobs,public.catalog_import_items to service_role;

create function public.catalog_import_enqueue(p_job uuid,p_actor uuid,p_label text,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500 then raise exception 'Import requires 1–500 items'; end if;
  insert into public.catalog_import_jobs(id,created_by,label) values(p_job,p_actor,p_label) on conflict(id) do nothing;
  if not found then
    if not exists(select 1 from public.catalog_import_jobs where id=p_job and created_by is not distinct from p_actor) then raise exception 'Import request belongs to another user'; end if;
    return p_job;
  end if;
  insert into public.catalog_import_items(job_id,isbn,book_id,mode,requested_copies,copies_applied,cover_source,title)
  select p_job,x->>'isbn',nullif(x->>'book_id','')::uuid,x->>'mode',coalesce((x->>'requested_copies')::integer,0),
    x->>'mode'='enrich',x->>'cover_source',x->>'title' from jsonb_array_elements(p_items) x;
  return p_job;
end $$;

create function public.catalog_import_claim()
returns setof public.catalog_import_items language plpgsql security definer set search_path='' as $$
declare slots integer;
begin
  perform pg_advisory_xact_lock(80431192);
  update public.catalog_import_items set status='failed',error='Worker interrupted repeatedly. Retry this item.',lease=null,lease_until=null
    where status='processing' and lease_until<now() and attempts>=4;
  select greatest(0,2-count(*))::integer into slots from public.catalog_import_items where status='processing' and lease_until>now();
  return query update public.catalog_import_items i set status='processing',attempts=i.attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '120 seconds'
    where i.id in (select id from public.catalog_import_items where attempts<4 and
      ((status in ('queued','retry') and next_attempt_at<=now()) or (status='processing' and lease_until<now()))
      order by next_attempt_at,created_at for update skip locked limit slots)
    returning i.*;
end $$;

-- Book and copies are committed together; replaying a cover never adds copies again.
create function public.catalog_import_apply_book(p_item uuid,p_lease uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.catalog_import_items; target uuid;
begin
  select * into i from public.catalog_import_items where id=p_item for update;
  if i.lease is distinct from p_lease or i.status<>'processing' then raise exception 'Import lease expired'; end if;
  target:=i.book_id;
  if target is null and i.mode='enrich' then raise exception 'Original book no longer exists'; end if;
  if target is null then
    perform pg_advisory_xact_lock(hashtextextended('catalog-isbn-'||i.isbn,0));
    select id into target from public.books where regexp_replace(isbn,'[[:space:]-]','','g')=i.isbn limit 1 for update;
    if target is null then
      if nullif(p_data->>'title','') is null then return null; end if;
      insert into public.books(title,author,isbn,is_active) values(p_data->>'title',coalesce(p_data->>'author',''),i.isbn,true) returning id into target;
    end if;
  end if;
  update public.books set
    title=coalesce(nullif(title,''),p_data->>'title',''),author=coalesce(nullif(author,''),p_data->>'author',''),
    description=coalesce(nullif(description,''),nullif(p_data->>'description','')),
    dewey_decimal=coalesce(nullif(dewey_decimal,''),nullif(p_data->>'dewey_decimal','')),
    published_year=coalesce(published_year,nullif(p_data->>'published_year','')::integer),
    tags=case when coalesce(cardinality(tags),0)>0 then tags else array(select jsonb_array_elements_text(coalesce(p_data->'tags','[]'))) end,
    updated_at=now() where id=target;
  if not i.copies_applied and i.mode='create' then
    insert into public.book_copies(book_id,status) select target,'AVAILABLE' from generate_series(1,i.requested_copies);
  end if;
  update public.catalog_import_items set book_id=target,copies_applied=true,title=(select title from public.books where id=target) where id=i.id;
  return target;
end $$;

create function public.catalog_import_finish(p_item uuid,p_lease uuid,p_status text,p_metadata text,p_cover text,p_error text,p_covers jsonb,p_delay_ms integer,p_cover_url text default null,p_expected_cover text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare i public.catalog_import_items;
begin
  select * into i from public.catalog_import_items where id=p_item for update;
  if i.lease is distinct from p_lease or i.status<>'processing' then return false; end if;
  if p_cover_url is not null then
    update public.books set cover_url=p_cover_url,updated_at=now() where id=i.book_id and cover_url is not distinct from p_expected_cover;
    if not found then p_status:='review';p_error:='Cover changed during import; kept the newer value.'; end if;
  end if;
  update public.catalog_import_items set status=p_status,metadata_status=p_metadata,cover_status=p_cover,
    error=p_error,covers=p_covers,next_attempt_at=now()+make_interval(secs=>greatest(0,p_delay_ms)/1000.0),lease=null,lease_until=null where id=i.id;
  return true;
end $$;

revoke all on function public.catalog_import_enqueue(uuid,uuid,text,jsonb),public.catalog_import_claim(),public.catalog_import_apply_book(uuid,uuid,jsonb),public.catalog_import_finish(uuid,uuid,text,text,text,text,jsonb,integer,text,text) from public,anon,authenticated;
grant execute on function public.catalog_import_enqueue(uuid,uuid,text,jsonb),public.catalog_import_claim(),public.catalog_import_apply_book(uuid,uuid,jsonb),public.catalog_import_finish(uuid,uuid,text,text,text,text,jsonb,integer,text,text) to service_role;
