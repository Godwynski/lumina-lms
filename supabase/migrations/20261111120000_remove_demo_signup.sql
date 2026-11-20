-- Remove demo access: @lumina.test addresses can no longer sign up.
-- Only @alabang.sti.edu.ph accounts are accepted.
-- The very first account to sign up (when no super admin exists) becomes the
-- ACTIVE super admin. Everyone after that starts as a PENDING student.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  card_number_val TEXT;
  v_first BOOLEAN;
BEGIN
  IF lower(COALESCE(new.email, '')) !~ '^[^@]+@alabang\.sti\.edu\.ph$' THEN
    RAISE EXCEPTION 'Sign-up is limited to @alabang.sti.edu.ph accounts';
  END IF;

  -- Serialise sign-ups so two people can never both become the first super admin.
  PERFORM pg_advisory_xact_lock(hashtext('lumina_first_super_admin'));
  v_first := NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin'::public.user_role);

  -- Insert profile
  INSERT INTO public.profiles (id, full_name, avatar_url, email, status, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    'PENDING',
    'student'::public.user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW();

  -- Create library card with PENDING status
  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (new.id, card_number_val, 'PENDING', now() + interval '100 years')
  ON CONFLICT (user_id) DO NOTHING;

  IF v_first THEN
    UPDATE public.profiles SET role = 'super_admin'::public.user_role, status = 'ACTIVE' WHERE id = new.id;
    UPDATE public.library_cards SET status = 'ACTIVE' WHERE user_id = new.id;
  END IF;

  RETURN new;
END;
$$;
