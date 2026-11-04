-- B4.1 (docs/AUDIT_CHECKLIST.md): unify reservation queue & add LOST loan status. Fixes M1, M2.
-- M1: single release_copy(p_copy_id) function with per-book advisory lock and 3-day default hold.
-- M2: add 'LOST' to public."BorrowStatus" so lost copies don't mark loans as RETURNED.
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

ALTER TYPE public."BorrowStatus" ADD VALUE IF NOT EXISTS 'LOST';

CREATE OR REPLACE FUNCTION public.release_copy(p_copy_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_book_id          UUID;
  v_now              TIMESTAMPTZ := NOW();
  v_next_reservation RECORD;
  v_hold_days        INTEGER;
  v_hold_expires_at  TIMESTAMPTZ;
  v_student_name     TEXT;
BEGIN
  -- Lock the copy and read its book_id
  SELECT bc.book_id
  INTO v_book_id
  FROM public.book_copies bc
  WHERE bc.id = p_copy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'reservation_ready', false);
  END IF;

  -- Serialize queue changes per book
  PERFORM pg_advisory_xact_lock(hashtextextended(v_book_id::text, 0));

  -- Find the next ACTIVE reservation in line
  SELECT r.id, r.user_id
  INTO v_next_reservation
  FROM public.reservations r
  WHERE r.book_id = v_book_id
    AND r.status  = 'ACTIVE'
  ORDER BY r.queue_position ASC, r.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    SELECT COALESCE(MAX(NULLIF(value, '')::INTEGER), 3)
    INTO v_hold_days
    FROM public.system_settings
    WHERE key = 'hold_expiry_days';

    v_hold_days := GREATEST(COALESCE(v_hold_days, 3), 1);
    v_hold_expires_at := v_now + make_interval(days => v_hold_days);

    UPDATE public.reservations
    SET
      status          = 'READY',
      copy_id         = p_copy_id,
      fulfilled_at    = v_now,
      hold_expires_at = v_hold_expires_at,
      updated_at      = v_now
    WHERE id = v_next_reservation.id;

    UPDATE public.book_copies
    SET status = 'RESERVED', updated_at = v_now
    WHERE id = p_copy_id;

    PERFORM public.compress_reservation_queue(v_book_id);

    SELECT full_name INTO v_student_name
    FROM public.profiles
    WHERE id = v_next_reservation.user_id;

    RETURN jsonb_build_object(
      'ok',                true,
      'reservation_ready', true,
      'reservation_id',    v_next_reservation.id,
      'user_id',           v_next_reservation.user_id,
      'reserved_for',      COALESCE(v_student_name, 'Reserved Student'),
      'hold_expires_at',   v_hold_expires_at
    );
  ELSE
    UPDATE public.book_copies
    SET status = 'AVAILABLE', updated_at = v_now
    WHERE id = p_copy_id;

    PERFORM public.compress_reservation_queue(v_book_id);

    RETURN jsonb_build_object(
      'ok',                true,
      'reservation_ready', false
    );
  END IF;
END;
$$;

-- No role check inside: only the server (service role) and other SECURITY DEFINER functions call it.
REVOKE EXECUTE ON FUNCTION public.release_copy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_copy(uuid) TO service_role;

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

CREATE OR REPLACE FUNCTION public.process_qr_return(p_librarian_id uuid, p_book_qr text, p_idempotency_key text DEFAULT NULL::text, p_preview_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_copy              RECORD;
  v_borrow            RECORD;
  v_existing          JSONB;
  v_release           JSONB;
  v_result            JSONB;
  v_now               TIMESTAMPTZ := NOW();
BEGIN
  -- Idempotency check
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing
    FROM public.return_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- Lock + fetch the copy
  SELECT bc.id, bc.status, bc.book_id, bc.qr_string, b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE OF bc;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
  END IF;

  -- Find the active borrowing record
  SELECT br.id, br.user_id, br.borrowed_at, br.due_date, p.full_name
  INTO v_borrow
  FROM public.borrowing_records br
  LEFT JOIN public.profiles p ON p.id = br.user_id
  WHERE br.book_copy_id = v_copy.id AND br.status IN ('ACTIVE', 'OVERDUE')
  ORDER BY br.borrowed_at DESC
  LIMIT 1
  FOR UPDATE OF br;

  IF NOT FOUND THEN
    IF v_copy.status = 'BORROWED' THEN
      -- Auto-recover orphaned copy state
      IF p_preview_only THEN
        RETURN jsonb_build_object(
          'ok', true, 'preview', true,
          'book_title',   v_copy.title,
          'student_name', 'System Recovery (No Record)'
        );
      END IF;
    ELSE
      IF v_copy.status = 'AVAILABLE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_BORROWED', 'message', 'This book copy is already Available.');
      ELSE
        RETURN jsonb_build_object('ok', false, 'code', 'NOT_BORROWED', 'message', 'This book copy is not borrowed (Status: ' || v_copy.status || ').');
      END IF;
    END IF;
  ELSE
    -- Preview mode
    IF p_preview_only THEN
      RETURN jsonb_build_object(
        'ok', true, 'preview', true,
        'book_title',   v_copy.title,
        'student_name', COALESCE(v_borrow.full_name, 'Student'),
        'borrowed_at',  v_borrow.borrowed_at,
        'due_date',     v_borrow.due_date
      );
    END IF;

    -- Mark borrow record as returned
    UPDATE public.borrowing_records
    SET status = 'RETURNED', returned_at = v_now, updated_at = v_now
    WHERE id = v_borrow.id;
  END IF;

  -- Release copy to the next queued reservation or mark AVAILABLE
  v_release := public.release_copy(v_copy.id);

  IF COALESCE((v_release ->> 'reservation_ready')::boolean, false) THEN
    v_result := jsonb_build_object(
      'ok',                true,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      COALESCE(v_borrow.full_name, 'Student'),
      'reservation_ready', true,
      'reserved_for',      COALESCE(v_release ->> 'reserved_for', 'Reserved Student')
    );
  ELSE
    v_result := jsonb_build_object(
      'ok',                true,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      COALESCE(v_borrow.full_name, 'Student'),
      'reservation_ready', false
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.return_idempotency
      (idempotency_key, response)
    VALUES
      (p_idempotency_key, v_result)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

COMMIT;

