-- Invoker security preserves the audit table's existing RLS and role restrictions.
create or replace view public.audit_log_records with (security_invoker = true) as
with linked as (
  select a.*, coalesce(
      case when a.entity_type in ('book','books') then a.entity_id::text end,
      a.details->>'book_id', a.new_value->>'book_id', a.old_value->>'book_id',
      r.book_id::text, c.book_id::text
    ) as subject_book_id,
    coalesce(
      case when a.entity_type in ('profile','profiles') then a.entity_id::text end,
      a.details->>'student_user_id', a.details->>'targetUserId',
      a.new_value->>'user_id', a.old_value->>'user_id',
      loan.user_id::text, r.user_id::text, card.user_id::text, legacy_return.user_id::text
    ) as subject_student_id,
    coalesce(c.id::text, a.details->>'book_copy_id', a.new_value->>'book_copy_id', a.old_value->>'book_copy_id') as subject_copy_id,
    coalesce(c.qr_string, a.details->>'bookQr', a.new_value->>'qr_string', a.old_value->>'qr_string') as copy_barcode,
    c.accession_number as copy_accession
  from public.audit_logs a
  left join public.borrowing_records loan on a.entity_type in ('borrowing_record','borrowing_records') and loan.id = a.entity_id
  left join public.reservations r on a.entity_type in ('reservation','reservations') and r.id = a.entity_id
  left join public.library_cards card on
    (a.entity_type in ('library_card','library_cards') and card.id = a.entity_id)
    or card.card_number = a.details->>'studentCardQr'
  left join public.book_copies c on c.id::text = coalesce(
    case when a.entity_type in ('book_copy','book_copies') then a.entity_id::text end,
    loan.book_copy_id::text, r.copy_id::text, a.details->>'book_copy_id',
    a.new_value->>'book_copy_id', a.old_value->>'book_copy_id'
  ) or (a.entity_id is null and c.qr_string = a.details->>'bookQr')
  -- Legacy returns had no loan ID. Only an exact copy and nearby return time can identify the borrower.
  left join lateral (
    select br.user_id from public.borrowing_records br
    where a.action = 'return' and a.entity_id is null and br.book_copy_id = c.id
      and br.returned_at between a.created_at - interval '5 minutes' and a.created_at + interval '5 minutes'
      and not exists (
        select 1 from public.borrowing_records other
        where other.id <> br.id and other.book_copy_id = c.id
          and other.returned_at between a.created_at - interval '5 minutes' and a.created_at + interval '5 minutes'
      )
  ) legacy_return on true
)
select linked.*,
  coalesce(b.title, linked.details->>'bookTitle', linked.details->>'book_title',
    case when linked.entity_type in ('book','books') then coalesce(linked.new_value->>'title', linked.old_value->>'title') end) as book_title,
  b.isbn as book_isbn,
  coalesce(p.full_name, linked.details->>'studentName', linked.details->>'student_name',
    case when linked.entity_type in ('profile','profiles') then coalesce(linked.new_value->>'full_name', linked.old_value->>'full_name') end) as student_name,
  p.student_id as student_number,
  p.email as student_email,
  actor.full_name as actor_name,
  actor.email as actor_email
from linked
left join public.books b on b.id::text = linked.subject_book_id
left join public.profiles p on p.id::text = linked.subject_student_id
left join public.profiles actor on actor.id = linked.admin_id;

grant select on public.audit_log_records to authenticated;
