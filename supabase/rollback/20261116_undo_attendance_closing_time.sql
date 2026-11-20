-- Undo for migration 20261116160000_attendance_closing_time.sql.
-- Restores hard-coded 17:00 auto_checkout_forgotten_attendance(), old notes text, and removes library_closing_time setting.
BEGIN;

CREATE OR REPLACE FUNCTION public.auto_checkout_forgotten_attendance()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.attendance
  SET
    check_out_at = ((check_in_at AT TIME ZONE 'Asia/Manila')::date + time '17:00:00') AT TIME ZONE 'Asia/Manila',
    notes = 'System auto-checkout: forgotten checkout'
  WHERE
    check_out_at IS NULL
    AND (check_in_at AT TIME ZONE 'Asia/Manila')::date < (NOW() AT TIME ZONE 'Asia/Manila')::date;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_checkout_forgotten_attendance() FROM PUBLIC, anon, authenticated;

UPDATE public.attendance
SET notes = 'System auto-checkout: forgotten checkout'
WHERE notes = 'No Log Out';

DELETE FROM public.system_settings
WHERE key = 'library_closing_time';

COMMIT;
