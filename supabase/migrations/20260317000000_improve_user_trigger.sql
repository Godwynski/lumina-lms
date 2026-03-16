-- Add unique constraint to library_cards user_id to ensure a user has only one card
-- and to support ON CONFLICT (user_id) in the trigger below.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'library_cards_user_id_key'
    ) THEN
        ALTER TABLE public.library_cards ADD CONSTRAINT library_cards_user_id_key UNIQUE (user_id);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student_id_val TEXT;
  card_number_val TEXT;
BEGIN
  -- Parse student_id from email if it follows the STI pattern: lastname.studentid@alabang.sti.edu.ph
  IF new.email LIKE '%.%@alabang.sti.edu.ph' THEN
    student_id_val := split_part(split_part(new.email, '@', 1), '.', 2);
  END IF;

  -- Insert profile (with conflict handling if already exists)
  -- This ensures that the email and full name from Microsoft/Azure are captured.
  INSERT INTO public.profiles (
    id, 
    full_name, 
    avatar_url, 
    student_id, 
    email,
    updated_at
  )
  VALUES (
    new.id, 
    COALESCE(
      new.raw_user_meta_data->>'full_name', 
      new.raw_user_meta_data->>'name', 
      split_part(new.email, '@', 1)
    ), 
    new.raw_user_meta_data->>'avatar_url',
    student_id_val,
    new.email,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();

  -- Generate card number LIB-YYYY-XXXXXXXX
  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  -- Insert library card (with conflict handling)
  -- All registered users get a library card in 'pending' status by default.
  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (
    new.id,
    card_number_val,
    'pending',
    now() + interval '1 year'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;
