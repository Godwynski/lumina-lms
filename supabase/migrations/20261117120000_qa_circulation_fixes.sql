-- QA circulation fixes: hold-ready notification, reservation blocks (archived / overdue / fines),
-- archived checkout block, fulfilled_at on checkout, idempotency key conflict, return of LOST loans,
-- ISBN search ignoring hyphens/spaces.

ALTER TABLE public.checkout_idempotency ADD COLUMN IF NOT EXISTS request_hash TEXT;
ALTER TABLE public.return_idempotency ADD COLUMN IF NOT EXISTS request_hash TEXT;

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
  v_book_title       TEXT;
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

    -- Tell the patron their hold is ready (every path that promotes a hold comes through here).
    SELECT title INTO v_book_title FROM public.books WHERE id = v_book_id;
    INSERT INTO public.notifications (user_id, title, content, type, priority, metadata)
    VALUES (
      v_next_reservation.user_id,
      'Reservation Ready for Pickup',
      format('"%s" is ready for pickup. Please claim it by %s.',
             COALESCE(v_book_title, 'Your reserved book'),
             to_char(v_hold_expires_at AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY')),
      'RESERVATION',
      'high',
      jsonb_build_object('reservationId', v_next_reservation.id, 'bookId', v_book_id, 'holdExpiresAt', v_hold_expires_at)
    );

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
    v_fine_rate      NUMERIC;
    v_overdue_count  INTEGER;
    v_receivable     NUMERIC;
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
        IF v_actor_role NOT IN ('super_admin', 'librarian', 'library_staff') THEN
            RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Only library staff can reserve books on behalf of other users.');
        END IF;
    END IF;

    SELECT status INTO v_profile_status FROM public.profiles WHERE id = v_target_id;
    IF UPPER(COALESCE(v_profile_status, '')) <> 'ACTIVE' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Only active accounts can reserve books.');
    END IF;

    -- Archived titles are out of circulation (P3-CAT-021).
    IF EXISTS (SELECT 1 FROM public.books WHERE id = p_book_id AND is_active = false) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BOOK_ARCHIVED', 'message', 'This title is archived and cannot be reserved.');
    END IF;

    -- Same borrowing block as checkout: overdue or lost loans and unpaid fines (GAP-033).
    SELECT COALESCE(MAX(NULLIF(value, '')::NUMERIC), 5) INTO v_fine_rate
    FROM public.system_settings WHERE key = 'overdue_fine_per_day';

    SELECT
        COUNT(*) FILTER (WHERE br.status IN ('OVERDUE', 'LOST') OR (br.status = 'ACTIVE' AND br.due_date < NOW())),
        COALESCE(SUM(CASE
            WHEN br.fine_settled_at IS NOT NULL THEN 0
            WHEN br.fine_amount IS NOT NULL THEN br.fine_amount
            WHEN br.returned_at IS NULL AND (br.status = 'OVERDUE' OR br.due_date < NOW())
                THEN GREATEST(1, ((NOW() AT TIME ZONE 'Asia/Manila')::date - (br.due_date AT TIME ZONE 'Asia/Manila')::date)) * COALESCE(v_fine_rate, 5)
            ELSE 0
        END), 0)
    INTO v_overdue_count, v_receivable
    FROM public.borrowing_records br
    WHERE br.user_id = v_target_id
      AND (br.status IN ('ACTIVE', 'OVERDUE', 'LOST') OR br.fine_settled_at IS NULL);

    IF v_overdue_count > 0 OR v_receivable > 0 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'BORROWING_BLOCKED', 'message',
            CASE
                WHEN v_overdue_count > 0 AND v_receivable > 0 THEN
                    format('User has %s overdue book(s) and ₱%s in unpaid fines. Please settle them before borrowing more.', v_overdue_count, to_char(v_receivable, 'FM999999990.00'))
                WHEN v_overdue_count > 0 THEN
                    format('User has %s overdue book(s). Please return them before borrowing more.', v_overdue_count)
                ELSE
                    format('User has ₱%s in unpaid fines. Please settle them before borrowing more.', to_char(v_receivable, 'FM999999990.00'))
            END);
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

CREATE OR REPLACE FUNCTION public.process_qr_checkout(p_librarian_id uuid, p_card_qr text, p_book_qr text, p_idempotency_key text DEFAULT NULL::text, p_preview_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_card              RECORD;
  v_copy              RECORD;
  v_active_borrows    INTEGER := 0;
  v_max_borrow_limit  INTEGER;
  v_loan_days         INTEGER;
  v_due_date          TIMESTAMPTZ;
  v_borrowing_id      UUID;
  v_existing          JSONB;
  v_result            JSONB;
  v_res_id            UUID := NULL;
  v_request_hash      TEXT := md5(COALESCE(p_card_qr, '') || '|' || COALESCE(p_book_qr, ''));
  v_stored_hash       TEXT;
BEGIN
  -- Idempotency check: a replayed key must carry the same card + book (QA idempotency conflict)
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response, request_hash INTO v_existing, v_stored_hash
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_stored_hash IS NOT NULL AND v_stored_hash <> v_request_hash THEN
        RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT', 'message', 'This request key was already used for a different checkout. Please scan again.');
      END IF;
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- Resolve student card → profile
  SELECT lc.user_id, lc.card_number, lc.status as card_status, p.full_name, p.student_id, p.status as profile_status
  INTO v_card
  FROM public.library_cards lc
  JOIN public.profiles p ON p.id = lc.user_id
  WHERE lc.card_number = p_card_qr
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_NOT_FOUND', 'message', 'Library card not found.');
  END IF;

  -- Block self-checkout: a staff member cannot check out a book to themself
  IF p_librarian_id IS NOT NULL AND v_card.user_id = p_librarian_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SELF_CHECKOUT_FORBIDDEN',
      'message', 'You cannot check out a book to yourself. Another staff member must process your checkout.'
    );
  END IF;

  -- Use UPPER() for case-insensitive status check
  IF UPPER(v_card.card_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_INACTIVE', 'message', 'Library card is not active.');
  END IF;

  -- Check if the profile (account) itself is active
  IF UPPER(v_card.profile_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Patron account is not active.');
  END IF;

  -- Read policy settings from system_settings
  SELECT
    COALESCE(MAX(CASE WHEN key = 'max_borrow_limit'      THEN value::INTEGER END), 5),
    COALESCE(MAX(CASE WHEN key = 'loan_period_days'      THEN value::INTEGER END), 14)
  INTO v_max_borrow_limit, v_loan_days
  FROM public.system_settings
  WHERE key IN ('max_borrow_limit', 'loan_period_days');

  -- Serialize checkouts per student so two desks can't both pass the limit check
  PERFORM pg_advisory_xact_lock(hashtextextended(v_card.user_id::text, 0));

  -- Check current loan count (overdue loans still count)
  SELECT COUNT(*) INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id AND status IN ('ACTIVE', 'OVERDUE');

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED', 'message', 'Borrow limit reached.');
  END IF;

  -- Lock + fetch the copy
  SELECT bc.id, bc.book_id, bc.status, b.title, b.is_active
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE OF bc;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
  END IF;

  IF NOT COALESCE(v_copy.is_active, true) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOK_ARCHIVED', 'message', 'This title is archived and cannot be checked out.');
  END IF;

  -- Handle RESERVED copies
  IF v_copy.status = 'RESERVED' THEN
    SELECT r.id
    INTO v_res_id
    FROM public.reservations r
    WHERE r.copy_id   = v_copy.id
      AND r.user_id   = v_card.user_id
      AND r.status    = 'READY'
    LIMIT 1;

    IF v_res_id IS NULL THEN
      -- Reserved for someone else
      RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is reserved for another patron.');
    END IF;
  ELSIF v_copy.status <> 'AVAILABLE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is not available for checkout.');
  END IF;

  v_due_date := NOW() + make_interval(days => v_loan_days);

  -- Preview mode: return info without committing
  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true, 'preview', true,
      'student_name', v_card.full_name,
      'book_title',   v_copy.title,
      'due_date',     v_due_date
    );
  END IF;

  -- Commit: mark copy as BORROWED, create borrowing record
  UPDATE public.book_copies
  SET status = 'BORROWED', updated_at = NOW()
  WHERE id = v_copy.id;

  INSERT INTO public.borrowing_records (user_id, book_copy_id, processed_by, borrowed_at, due_date, status)
  VALUES (v_card.user_id, v_copy.id, p_librarian_id, NOW(), v_due_date, 'ACTIVE')
  RETURNING id INTO v_borrowing_id;

  -- Fulfill reservation if applicable
  IF v_res_id IS NOT NULL THEN
    UPDATE public.reservations
    SET status = 'FULFILLED', fulfilled_at = NOW(), updated_at = NOW()
    WHERE id = v_res_id;
  END IF;

  v_result := jsonb_build_object(
    'ok',           true,
    'borrowing_id', v_borrowing_id,
    'student_name', v_card.full_name,
    'book_title',   v_copy.title,
    'due_date',     v_due_date
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.checkout_idempotency
      (idempotency_key, response, request_hash)
    VALUES
      (p_idempotency_key, v_result, v_request_hash)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
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
  v_borrow_id         UUID := NULL;
  v_student_name      TEXT := 'Student';
  v_existing          JSONB;
  v_release           JSONB;
  v_result            JSONB;
  v_now               TIMESTAMPTZ := NOW();
  v_fine_rate         NUMERIC := 5;
  v_overdue_days      INTEGER := 0;
  v_fine_amount       NUMERIC(10,2) := 0;
  v_request_hash      TEXT := md5(COALESCE(p_book_qr, ''));
  v_stored_hash       TEXT;
BEGIN
  -- Idempotency check: a replayed key must carry the same book
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response, request_hash INTO v_existing, v_stored_hash
    FROM public.return_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_stored_hash IS NOT NULL AND v_stored_hash <> v_request_hash THEN
        RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT', 'message', 'This request key was already used for a different return. Please scan again.');
      END IF;
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
  SELECT br.id, br.user_id, br.borrowed_at, br.due_date, br.status, br.fine_amount, p.full_name
  INTO v_borrow
  FROM public.borrowing_records br
  LEFT JOIN public.profiles p ON p.id = br.user_id
  WHERE br.book_copy_id = v_copy.id AND br.status IN ('ACTIVE', 'OVERDUE', 'LOST') AND br.returned_at IS NULL
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
          'student_name', 'System Recovery (No Record)',
          'fine_amount',  0,
          'overdue_days', 0
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
    v_borrow_id := v_borrow.id;
    v_student_name := COALESCE(v_borrow.full_name, 'Student');

    SELECT COALESCE(MAX(NULLIF(value, '')::NUMERIC), 5)
    INTO v_fine_rate
    FROM public.system_settings
    WHERE key = 'overdue_fine_per_day';

    IF v_now > v_borrow.due_date OR v_borrow.status = 'OVERDUE' THEN
      v_overdue_days := GREATEST(1, ((v_now AT TIME ZONE 'Asia/Manila')::date - (v_borrow.due_date AT TIME ZONE 'Asia/Manila')::date));
      v_fine_amount := COALESCE(v_borrow.fine_amount, v_overdue_days * v_fine_rate);
    ELSE
      v_overdue_days := 0;
      v_fine_amount := COALESCE(v_borrow.fine_amount, 0);
    END IF;

    -- Preview mode
    IF p_preview_only THEN
      RETURN jsonb_build_object(
        'ok', true, 'preview', true,
        'borrowing_id', v_borrow_id,
        'book_title',   v_copy.title,
        'student_name', v_student_name,
        'borrowed_at',  v_borrow.borrowed_at,
        'due_date',     v_borrow.due_date,
        'fine_amount',  v_fine_amount,
        'overdue_days', v_overdue_days
      );
    END IF;

    -- Mark borrow record as returned and snapshot fine amount
    UPDATE public.borrowing_records
    SET status = 'RETURNED',
        returned_at = v_now,
        updated_at = v_now,
        fine_amount = v_fine_amount
    WHERE id = v_borrow.id;
  END IF;

  -- Release copy to the next queued reservation or mark AVAILABLE
  v_release := public.release_copy(v_copy.id);

  IF COALESCE((v_release ->> 'reservation_ready')::boolean, false) THEN
    v_result := jsonb_build_object(
      'ok',                true,
      'borrowing_id',      v_borrow_id,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      v_student_name,
      'fine_amount',       v_fine_amount,
      'overdue_days',      v_overdue_days,
      'reservation_ready', true,
      'reserved_for',      COALESCE(v_release ->> 'reserved_for', 'Reserved Student')
    );
  ELSE
    v_result := jsonb_build_object(
      'ok',                true,
      'borrowing_id',      v_borrow_id,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      v_student_name,
      'fine_amount',       v_fine_amount,
      'overdue_days',      v_overdue_days,
      'reservation_ready', false
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.return_idempotency
      (idempotency_key, response, request_hash)
    VALUES
      (p_idempotency_key, v_result, v_request_hash)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_book_ids(
  p_query text,
  p_status text DEFAULT 'ACTIVE',
  p_category_ids uuid[] DEFAULT NULL,
  p_section text DEFAULT NULL,
  p_available_only boolean DEFAULT false,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
 RETURNS TABLE(id uuid, total_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT
      lower(btrim(coalesce(p_query, ''))) AS raw,
      replace(replace(replace(lower(btrim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') AS esc,
      regexp_replace(lower(btrim(coalesce(p_query, ''))), '[^0-9a-z]', '', 'g') AS isbn_key
  ),
  words AS (
    SELECT w
    FROM q, regexp_split_to_table(regexp_replace(q.raw, '[^[:alnum:][:space:]]', ' ', 'g'), '\s+') AS w
    WHERE w <> ''
  ),
  tsq AS (
    SELECT CASE
             WHEN length((SELECT raw FROM q)) >= 3 AND EXISTS (SELECT 1 FROM words)
             THEN to_tsquery('english', (SELECT string_agg(w || ':*', ' & ') FROM words))
           END AS v
  ),
  matched AS (
    SELECT
      b.id,
      b.title,
      CASE
        WHEN q.isbn_key <> '' AND regexp_replace(lower(coalesce(b.isbn, '')), '[^0-9a-z]', '', 'g') = q.isbn_key THEN 0
        WHEN lower(b.title) = q.raw THEN 1
        WHEN lower(b.title) LIKE q.esc || '%' THEN 2
        WHEN (tsq.v IS NOT NULL AND to_tsvector('english', coalesce(b.title, '')) @@ tsq.v)
          OR lower(b.title) LIKE '%' || q.esc || '%' THEN 3
        WHEN (tsq.v IS NOT NULL AND to_tsvector('english', coalesce(b.author, '')) @@ tsq.v)
          OR lower(coalesce(b.author, '')) LIKE '%' || q.esc || '%' THEN 4
        ELSE 5
      END AS tier,
      CASE WHEN tsq.v IS NOT NULL THEN ts_rank_cd(b.search_vector, tsq.v) ELSE 0 END AS score
    FROM public.books b, q, tsq
    WHERE q.raw <> ''
      AND (
        CASE
          WHEN length(q.raw) < 3 THEN lower(b.title) LIKE '%' || q.esc || '%'
          ELSE (tsq.v IS NOT NULL AND b.search_vector @@ tsq.v)
            OR lower(b.title) LIKE '%' || q.esc || '%'
            OR lower(coalesce(b.author, '')) LIKE '%' || q.esc || '%'
            OR lower(coalesce(b.isbn, '')) LIKE '%' || q.esc || '%'
            -- ISBN typed with hyphens or spaces (P3-CAT-004)
            OR (q.isbn_key ~ '^[0-9]{4,}x?$'
                AND regexp_replace(lower(coalesce(b.isbn, '')), '[^0-9a-z]', '', 'g') LIKE '%' || q.isbn_key || '%')
        END
      )
      AND (p_status = 'ALL'
           OR (p_status = 'ARCHIVED' AND b.is_active = false)
           OR (coalesce(p_status, 'ACTIVE') = 'ACTIVE' AND b.is_active = true))
      AND (p_category_ids IS NULL OR cardinality(p_category_ids) = 0 OR b.category_id = ANY (p_category_ids))
      AND (p_section IS NULL OR p_section = '' OR b.section = p_section)
      AND (NOT coalesce(p_available_only, false) OR b.available_copies > 0)
  )
  SELECT m.id, count(*) OVER () AS total_count
  FROM matched m
  ORDER BY m.tier, m.score DESC, lower(m.title), m.id
  OFFSET greatest(coalesce(p_offset, 0), 0)
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;
