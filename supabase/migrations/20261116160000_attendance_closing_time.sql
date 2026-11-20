-- WP3: Configurable library closing time, GREATEST(check_in_at, closing_time) auto-checkout, and 'No Log Out' notes
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

INSERT INTO public.system_settings (key, value, description, data_type)
VALUES (
  'library_closing_time',
  '17:00',
  'Daily library closing time (24h HH:MM, Asia/Manila) used to close forgotten check-outs',
  'string'
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.attendance
SET notes = 'No Log Out'
WHERE notes = 'System auto-checkout: forgotten checkout';

CREATE OR REPLACE FUNCTION public.auto_checkout_forgotten_attendance()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_closing_raw TEXT;
  v_closing_time TIME := time '17:00:00';
BEGIN
  SELECT value
  INTO v_closing_raw
  FROM public.system_settings
  WHERE key = 'library_closing_time'
  LIMIT 1;

  IF v_closing_raw IS NOT NULL AND trim(v_closing_raw) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    v_closing_time := (trim(v_closing_raw) || ':00')::time;
  END IF;

  UPDATE public.attendance
  SET
    check_out_at = GREATEST(
      check_in_at,
      (((check_in_at AT TIME ZONE 'Asia/Manila')::date + v_closing_time) AT TIME ZONE 'Asia/Manila')
    ),
    notes = 'No Log Out'
  WHERE
    check_out_at IS NULL
    AND (check_in_at AT TIME ZONE 'Asia/Manila')::date < (NOW() AT TIME ZONE 'Asia/Manila')::date;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_checkout_forgotten_attendance() FROM PUBLIC, anon, authenticated;

COMMIT;
