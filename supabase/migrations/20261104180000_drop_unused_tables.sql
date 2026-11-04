-- M26: drop six tables no app code reads or writes. CASCADE removes their policies,
-- indexes, FKs and realtime publication entries.
DROP TABLE IF EXISTS
  public.announcements,
  public.reports,
  public.deleted_profile_info,
  public.rate_limit_log,
  public.checklist_items,
  public.checklist_dropdown_options
CASCADE;
