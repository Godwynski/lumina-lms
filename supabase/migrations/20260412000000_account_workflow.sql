-- 1. Normalize existing statuses to uppercase and handle nulls
-- This must happen before adding the strict constraint
UPDATE public.profiles 
SET status = CASE 
  WHEN status IS NULL THEN 'PENDING'
  ELSE UPPER(status)
END;

-- Explicitly set any non-compliant statuses (e.g. unknown values) to PENDING
UPDATE public.profiles
SET status = 'PENDING'
WHERE status NOT IN ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'DELETED');

-- 2. Update profiles status constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles 
  ALTER COLUMN status SET DEFAULT 'PENDING',
  ADD CONSTRAINT profiles_status_check 
  CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'DELETED'));

-- 3. Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  student_id_val TEXT;
  card_number_val TEXT;
BEGIN
  -- Extract student ID from email if it follows the pattern (e.g. name.12345@school.edu)
  IF new.email LIKE '%.%@alabang.sti.edu.ph' THEN
    student_id_val := split_part(split_part(new.email, '@', 1), '.', 2);
  END IF;

  -- Create profile with PENDING status by default
  INSERT INTO public.profiles (id, full_name, avatar_url, student_id, email, status)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'avatar_url',
    student_id_val,
    new.email,
    'PENDING'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW();

  -- Create library card with PENDING status
  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (new.id, card_number_val, 'PENDING', now() + interval '100 years') -- Effectively no expiry, handled by status
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;
