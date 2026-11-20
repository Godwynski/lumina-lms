-- Undo for migration 20261116190000_wp6_archive_old_logs.sql.
-- Removes archive_old_logs RPC, archive RLS policies, and archive tables.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.archive_old_logs(date) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.archive_old_logs(date);

DROP POLICY IF EXISTS "Super admins can view borrowing archive" ON public.borrowing_records_archive;
DROP POLICY IF EXISTS "Super admins can view attendance archive" ON public.attendance_archive;

DROP TABLE IF EXISTS public.borrowing_records_archive;
DROP TABLE IF EXISTS public.attendance_archive;

COMMIT;
