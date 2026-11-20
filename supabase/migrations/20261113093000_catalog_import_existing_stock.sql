create or replace function public.catalog_import_apply_book(p_item uuid,p_lease uuid,p_data jsonb)
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
