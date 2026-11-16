ALTER TYPE public.user_role RENAME VALUE 'patron' TO 'student';
ALTER TYPE public.user_role RENAME VALUE 'library_staff' TO 'student_assistant';

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND status = 'ACTIVE'
    AND role IN ('super_admin', 'librarian', 'student_assistant')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  card_number_val TEXT;
  v_first BOOLEAN;
  v_demo BOOLEAN;
BEGIN
  v_demo := EXISTS (SELECT 1 FROM public.demo_accounts WHERE email = lower(COALESCE(new.email, '')));

  IF NOT v_demo AND lower(COALESCE(new.email, '')) !~ '^[^@]+@alabang\.sti\.edu\.ph$' THEN
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

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(p_actor_id uuid, p_book_id uuid, p_target_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_id      UUID    := COALESCE(p_target_user_id, p_actor_id);
    v_queue_pos      INTEGER;
    v_res_id         UUID;
    v_profile_status TEXT;
    v_copy_id        UUID;
    v_exp_copy_id    UUID;
    v_hold_days      INTEGER;
    v_expiry         TIMESTAMPTZ;
    v_actor_role     user_role;
    v_max_res        INTEGER;
BEGIN
    -- Authorization Enforcements:
    -- 1. Require authentication: anonymous callers are prohibited unless executed via service_role.
    IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
        IF (SELECT auth.uid()) IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Authentication required.');
        END IF;

        IF p_actor_id <> (SELECT auth.uid()) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Actor ID must match authenticated user.');
        END IF;
    END IF;

    -- 2. If reserving on behalf of another user, verify that p_actor_id has an active staff role.
    IF v_target_id <> p_actor_id THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id AND status = 'ACTIVE';
        IF v_actor_role NOT IN ('super_admin', 'librarian', 'student_assistant') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Only library staff can reserve books on behalf of other users.');
        END IF;
    END IF;

    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF UPPER(COALESCE(v_profile_status, '')) <> 'ACTIVE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Only active accounts can reserve books.');
    END IF;

    -- Lock the user, then the book, so the per-user hold count below can't race
    PERFORM pg_advisory_xact_lock(hashtextextended(v_target_id::text, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 0));

    -- Expire old READY reservations and hand their copies to the next person in line (or AVAILABLE)
    FOR v_exp_copy_id IN
        UPDATE public.reservations
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE book_id = p_book_id
          AND status = 'READY'
          AND hold_expires_at < NOW()
        RETURNING copy_id
    LOOP
        IF v_exp_copy_id IS NOT NULL THEN
            PERFORM public.release_copy(v_exp_copy_id);
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE user_id = v_target_id AND book_id = p_book_id AND status IN ('ACTIVE', 'READY')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'You already have an active reservation for this book.');
    END IF;

    SELECT COALESCE(MAX(NULLIF(value, '')::INTEGER), 3) INTO v_max_res
    FROM public.system_settings WHERE key = 'max_reservations_per_student';

    IF (SELECT COUNT(*) FROM public.reservations
        WHERE user_id = v_target_id AND status IN ('ACTIVE', 'READY')) >= COALESCE(v_max_res, 3) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'RESERVATION_LIMIT', 'message', 'Reservation limit reached.');
    END IF;

    SELECT id INTO v_copy_id
    FROM public.book_copies
    WHERE book_id = p_book_id AND status = 'AVAILABLE'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_copy_id IS NOT NULL THEN
        SELECT COALESCE(MAX(NULLIF(value, '')::INTEGER), 3) INTO v_hold_days
        FROM public.system_settings WHERE key = 'hold_expiry_days';

        v_hold_days := GREATEST(COALESCE(v_hold_days, 3), 1);
        v_expiry := NOW() + make_interval(days => v_hold_days);

        UPDATE public.book_copies SET status = 'RESERVED', updated_at = NOW() WHERE id = v_copy_id;

        INSERT INTO public.reservations (user_id, book_id, copy_id, queue_position, status, hold_expires_at)
        VALUES (v_target_id, p_book_id, v_copy_id, 1, 'READY', v_expiry)
        RETURNING id INTO v_res_id;

        RETURN jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'status', 'READY', 'copy_id', v_copy_id, 'hold_expires_at', v_expiry);
    ELSE
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_queue_pos
        FROM public.reservations WHERE book_id = p_book_id AND status = 'ACTIVE';

        INSERT INTO public.reservations (user_id, book_id, queue_position, status)
        VALUES (v_target_id, p_book_id, v_queue_pos, 'ACTIVE')
        RETURNING id INTO v_res_id;

        RETURN jsonb_build_object('ok', true, 'reservation_id', v_res_id, 'status', 'ACTIVE', 'queue_position', v_queue_pos);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.annual_student_reset()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND status = 'ACTIVE' AND role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin can run annual reset';
    END IF;
  END IF;

  WITH updated_profiles AS (
    UPDATE public.profiles
    SET status = 'SUSPENDED', updated_at = NOW()
    WHERE role = 'student'
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM updated_profiles;

  UPDATE public.library_cards lc
  SET status = 'SUSPENDED', updated_at = NOW()
  FROM public.profiles p
  WHERE lc.user_id = p.id
    AND p.role = 'student';

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_bulk_notifications_by_target(
  p_target text,
  p_title text,
  p_content text,
  p_type text DEFAULT 'SYSTEM',
  p_priority text DEFAULT 'high',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  WITH inserted AS (
    INSERT INTO public.notifications (user_id, title, content, type, priority, metadata)
    SELECT
      p.id,
      p_title,
      p_content,
      COALESCE(p_type, 'SYSTEM'),
      COALESCE(p_priority, 'high'),
      COALESCE(p_metadata, '{}'::jsonb)
    FROM public.profiles p
    WHERE p_target = 'all'
       OR (p_target = 'students' AND p.role IN ('student', 'student_assistant'))
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_users_bulk(p_user_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role public.user_role;
  v_count       integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin or librarian can reactivate users';
    END IF;
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = (SELECT auth.uid());
  ELSE
    v_caller_role := 'super_admin'::public.user_role;
  END IF;

  IF p_user_ids IS NULL OR coalesce(array_length(p_user_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  -- Cards follow only the profiles this call re-activated (librarians: students only).
  WITH updated AS (
    UPDATE public.profiles
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE id = ANY(p_user_ids)
      AND (v_caller_role = 'super_admin'::public.user_role OR role = 'student'::public.user_role)
    RETURNING id
  ), cards AS (
    UPDATE public.library_cards
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE user_id IN (SELECT id FROM updated)
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

UPDATE auth.users SET raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', to_jsonb(CASE raw_app_meta_data->>'role' WHEN 'patron' THEN 'student' WHEN 'library_staff' THEN 'student_assistant' END)) WHERE raw_app_meta_data->>'role' IN ('patron', 'library_staff');
UPDATE auth.users SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', to_jsonb(CASE raw_user_meta_data->>'role' WHEN 'patron' THEN 'student' WHEN 'library_staff' THEN 'student_assistant' END)) WHERE raw_user_meta_data->>'role' IN ('patron', 'library_staff');
