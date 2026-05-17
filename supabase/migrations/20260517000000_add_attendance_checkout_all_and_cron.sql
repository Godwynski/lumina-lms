-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- Create function to auto checkout forgotten attendance records
CREATE OR REPLACE FUNCTION public.auto_checkout_forgotten_attendance()
RETURNS VOID AS $$
BEGIN
  -- Close any open attendance records from previous days
  -- Setting checkout time to 5:00 PM (17:00:00) of that check-in day
  UPDATE public.attendance
  SET 
    check_out_at = (check_in_at::date + time '17:00:00')::timestamptz,
    notes = 'System auto-checkout: forgotten checkout'
  WHERE 
    check_out_at IS NULL 
    AND check_in_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe scheduled job registration
-- Unschedule if already exists to ensure idempotency when running migrations
SELECT cron.unschedule('auto-checkout-forgotten-attendance-job') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-checkout-forgotten-attendance-job'
);

-- Schedule to run daily at 11:59 PM Manila Time (UTC+8) -> 3:59 PM UTC (15:59)
SELECT cron.schedule(
  'auto-checkout-forgotten-attendance-job',
  '59 15 * * *',
  'SELECT public.auto_checkout_forgotten_attendance();'
);
