-- pg_cron setup for automated library maintenance tasks
-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role for cron jobs
GRANT USAGE ON SCHEMA cron TO postgres;

-- Function to calculate and create overdue fines
CREATE OR REPLACE FUNCTION public.calculate_overdue_fines()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fine_per_day NUMERIC(10, 2) := 0.50;
  v_fine_cap NUMERIC(10, 2) := 50.00;
  v_record RECORD;
  v_days_overdue INTEGER;
  v_fine_amount NUMERIC(10, 2);
  v_existing_fine_id UUID;
BEGIN
  SELECT NULLIF(value, '')::NUMERIC INTO v_fine_per_day
  FROM public.system_settings WHERE key = 'overdue_fine_per_day';

  SELECT NULLIF(value, '')::NUMERIC INTO v_fine_cap
  FROM public.system_settings WHERE key = 'fine_cap_amount';

  FOR v_record IN
    SELECT br.id, br.user_id, br.due_date
    FROM public.borrowing_records br
    WHERE br.status = 'active'
      AND br.due_date < NOW()
  LOOP
    v_days_overdue := GREATEST(0, DATE_PART('day', NOW() - v_record.due_date)::INTEGER);
    v_fine_amount := LEAST(v_days_overdue * v_fine_per_day, v_fine_cap);

    SELECT id INTO v_existing_fine_id
    FROM public.fines
    WHERE borrowing_record_id = v_record.id
      AND status = 'unpaid';

    IF v_existing_fine_id IS NULL AND v_fine_amount > 0 THEN
      INSERT INTO public.fines (user_id, borrowing_record_id, amount, status, reason)
      VALUES (v_record.user_id, v_record.id, v_fine_amount, 'unpaid', 
              'Auto-generated overdue fine: ' || v_days_overdue || ' days overdue');
    END IF;
  END LOOP;
END;
$$;

-- Function to update overdue status in borrowing_records
CREATE OR REPLACE FUNCTION public.update_overdue_status()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.borrowing_records
  SET status = 'overdue'
  WHERE status = 'active'
    AND due_date < NOW();
END;
$$;

-- Schedule overdue fine calculation to run every hour
SELECT cron.schedule(
  'calculate-overdue-fines',
  '0 * * * *',
  'SELECT public.calculate_overdue_fines()'
);

-- Schedule overdue status update to run every 15 minutes
SELECT cron.schedule(
  'update-overdue-status',
  '*/15 * * * *',
  'SELECT public.update_overdue_status()'
);

-- Function to cleanup expired reservations
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hold_days INTEGER := 7;
BEGIN
  SELECT NULLIF(value, '')::INTEGER INTO v_hold_days
  FROM public.system_settings WHERE key = 'hold_expiry_days';

  UPDATE public.reservations
  SET status = 'expired'
  WHERE status = 'active'
    AND hold_expires_at < NOW();
END;
$$;

-- Schedule expired reservation cleanup every hour
SELECT cron.schedule(
  'cleanup-expired-reservations',
  '30 * * * *',
  'SELECT public.cleanup_expired_reservations()'
);
