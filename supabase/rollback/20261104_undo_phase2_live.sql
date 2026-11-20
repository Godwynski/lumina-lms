-- Undo for migrations 20261104120000_rls_roles_signup, 20261104130000_circulation_functions and
-- 20261104140000_fix_profiles_select_recursion
-- on the live project (system-sg). Captured from live right before they were applied on 2026-11-04.
-- Those migrations change no data, only policies and functions, so this restores the previous state.
-- Note: this brings back the security holes those migrations fixed. Use only if something breaks.
BEGIN;

-- New policies added by the migrations
DROP POLICY IF EXISTS "Users can view own profile, staff can view all" ON public.profiles;
DROP POLICY IF EXISTS "Staff can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Librarians can insert book_copies" ON public.book_copies;
DROP POLICY IF EXISTS "Librarians can update book_copies" ON public.book_copies;
DROP POLICY IF EXISTS "Librarians can insert borrowing records" ON public.borrowing_records;
DROP POLICY IF EXISTS "Librarians can update borrowing records" ON public.borrowing_records;
DROP POLICY IF EXISTS "Staff can view all reservations" ON public.reservations;
DROP POLICY IF EXISTS "Librarians can manage reservations" ON public.reservations;

-- Previous live policies that the migrations dropped
CREATE POLICY "Attendance insert policy" ON public.attendance AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_staff() OR (( SELECT auth.uid() AS uid) = user_id)));
CREATE POLICY "Attendance update policy" ON public.attendance AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_staff() OR (( SELECT auth.uid() AS uid) = user_id))) WITH CHECK ((is_staff() OR (( SELECT auth.uid() AS uid) = user_id)));
CREATE POLICY "Staff can insert book_copies" ON public.book_copies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_staff());
CREATE POLICY "Staff can update book_copies" ON public.book_copies AS PERMISSIVE FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "Staff can insert borrowing records" ON public.borrowing_records AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_staff());
CREATE POLICY "Staff can update borrowing records" ON public.borrowing_records AS PERMISSIVE FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "Authenticated users can view profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can delete reservations" ON public.reservations AS PERMISSIVE FOR DELETE TO authenticated USING (is_staff());
CREATE POLICY "Staff can insert reservations" ON public.reservations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_staff());
CREATE POLICY "Staff can update reservations" ON public.reservations AS PERMISSIVE FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- Previous function definitions
CREATE OR REPLACE FUNCTION public.auto_set_student_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_local_part TEXT;
  v_digit_match TEXT;
  v_student_id TEXT;
  v_domain TEXT;
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_local_part := lower(split_part(COALESCE(NEW.email, ''), '@', 1));
  v_domain     := lower(split_part(COALESCE(NEW.email, ''), '@', 2));

  IF v_local_part = '' THEN
    RETURN NEW;
  END IF;

  IF v_domain ILIKE '%sti.edu.ph%' THEN
    v_digit_match := (regexp_match(v_local_part, '(\d{6,})'))[1];
    IF v_digit_match IS NOT NULL THEN
      v_student_id := 'STU-' || v_digit_match;
    ELSE
      v_student_id := 'FAC-' || v_local_part;
    END IF;
  ELSE
    v_digit_match := (regexp_match(v_local_part, '(\d{6,})'))[1];
    IF v_digit_match IS NOT NULL THEN
      v_student_id := 'STU-' || v_digit_match;
    END IF;
  END IF;

  IF v_student_id IS NOT NULL THEN
    NEW.student_id := upper(regexp_replace(v_student_id, '[^A-Z0-9._\-]', '_', 'g'));
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(p_actor_id uuid, p_book_id uuid, p_target_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_target_id      UUID    := COALESCE(p_target_user_id, p_actor_id);
    v_queue_pos      INTEGER;
    v_res_id         UUID;
    v_profile_status TEXT;
    v_copy_id        UUID;
    v_hold_days      INTEGER;
    v_expiry         TIMESTAMPTZ;
    v_actor_role     user_role;
BEGIN
    IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
        IF (SELECT auth.uid()) IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Authentication required.');
        END IF;

        IF p_actor_id <> (SELECT auth.uid()) THEN
            RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED', 'message', 'Actor ID must match authenticated user.');
        END IF;
    END IF;

    IF v_target_id <> p_actor_id THEN
        SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id AND status = 'ACTIVE';
        IF v_actor_role NOT IN ('super_admin', 'librarian', 'student_assistant') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Only library staff can reserve books on behalf of other users.');
        END IF;
    END IF;

    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF v_profile_status = 'SUSPENDED' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'SUSPENDED', 'message', 'User account is suspended.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 0));

    WITH expired_holds AS (
        UPDATE public.reservations
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE book_id = p_book_id
          AND status = 'READY'
          AND hold_expires_at < NOW()
        RETURNING copy_id
    )
    UPDATE public.book_copies
    SET status = 'AVAILABLE', updated_at = NOW()
    WHERE id IN (SELECT copy_id FROM expired_holds);

    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE user_id = v_target_id AND book_id = p_book_id AND status IN ('ACTIVE', 'READY')
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'message', 'You already have an active reservation for this book.');
    END IF;

    SELECT id INTO v_copy_id
    FROM public.book_copies
    WHERE book_id = p_book_id AND status = 'AVAILABLE'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_copy_id IS NOT NULL THEN
        SELECT COALESCE(value::INTEGER, 3) INTO v_hold_days
        FROM public.system_settings WHERE key = 'hold_expiry_days';

        v_expiry := NOW() + (v_hold_days || ' days')::interval;

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
$function$;

CREATE OR REPLACE FUNCTION public.fn_guard_profile_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') = 'service_role' OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('super_admin'::public.user_role, 'librarian'::public.user_role)
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot modify role: unauthorized self-promotion';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify status: unauthorized status escalation';
  END IF;

  IF NEW.student_id IS DISTINCT FROM OLD.student_id AND OLD.student_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify student_id: identifier is immutable once set';
  END IF;

  IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
    RAISE EXCEPTION 'Cannot modify permissions: unauthorized permission escalation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  card_number_val TEXT;
BEGIN
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

  card_number_val := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (new.id, card_number_val, 'PENDING', now() + interval '100 years')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;

-- process_qr_checkout / process_qr_return: the only changes were the per-student lock, counting
-- OVERDUE loans, and two extra fields in the return preview. Rolling those back is optional; if
-- needed, take the versions from git (git show 237dd09:supabase/schema_clean_install.sql), which
-- match what was live.

DROP FUNCTION IF EXISTS public.get_next_due_date(uuid);
DROP FUNCTION IF EXISTS public.is_manager();

COMMIT;
