alter table public.digital_resources
add column if not exists published_year integer;

alter table public.digital_resources
drop constraint if exists digital_resources_published_year_check;

alter table public.digital_resources
add constraint digital_resources_published_year_check
check (published_year is null or (published_year >= 1000 and published_year <= 9999));
