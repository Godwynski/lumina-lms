-- Migration: Fix case-sensitivity in process_qr_checkout status check
-- Also adds profile status check for consistency with application logic.
-- Fixed: "v_ready_reservation" is not assigned yet error.
-- Fixed: Simplified idempotency insert to avoid schema mismatches for both checkout and return.

CREATE OR REPLACE FUNCTION public.process_qr_checkout(
  p_librarian_id UUID,
  p_card_qr      TEXT,
  p_book_qr      TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_preview_only    BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card              RECORD;
  v_copy              RECORD;
  v_active_borrows    INTEGER := 0;
  v_max_borrow_limit  INTEGER;
  v_loan_days         INTEGER;
  v_fine_threshold    NUMERIC;
  v_due_date          TIMESTAMPTZ;
  v_borrowing_id      UUID;
  v_existing          JSONB;
  v_result            JSONB;
  v_res_id            UUID := NULL;
BEGIN
  -- Idempotency check
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
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

  -- Use UPPER() for case-insensitive status check
  IF UPPER(v_card.card_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_INACTIVE', 'message', 'Library card is not active.');
  END IF;

  -- Check if the profile (account) itself is active
  IF UPPER(v_card.profile_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Student account is not active.');
  END IF;

  -- Read policy settings from system_settings
  SELECT
    COALESCE(MAX(CASE WHEN key = 'max_borrow_limit'      THEN value::INTEGER END), 5),
    COALESCE(MAX(CASE WHEN key = 'loan_period_days'      THEN value::INTEGER END), 14),
    COALESCE(MAX(CASE WHEN key = 'max_outstanding_fines' THEN value::NUMERIC  END), 100)
  INTO v_max_borrow_limit, v_loan_days, v_fine_threshold
  FROM public.system_settings
  WHERE key IN ('max_borrow_limit', 'loan_period_days', 'max_outstanding_fines');

  -- Check active borrow count
  SELECT COUNT(*) INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id AND status = 'ACTIVE';

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED', 'message', 'Borrow limit reached.');
  END IF;

  -- Lock + fetch the copy
  SELECT bc.id, bc.book_id, bc.status, b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
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
      RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is reserved for another student.');
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
    SET status = 'FULFILLED', updated_at = NOW()
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
      (idempotency_key, response)
    VALUES
      (p_idempotency_key, v_result)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION public.process_qr_return(
  p_librarian_id    UUID,
  p_book_qr         TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_preview_only    BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copy              RECORD;
  v_borrow            RECORD;
  v_existing          JSONB;
  v_result            JSONB;
  v_now               TIMESTAMPTZ := NOW();
  v_next_reservation  RECORD;
  v_hold_expiry_days  INTEGER := 7;
  v_hold_expires_at   TIMESTAMPTZ;
  v_student_name      TEXT;
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
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
  END IF;

  -- Find the active borrowing record
  SELECT br.id, br.user_id, br.borrowed_at, br.due_date, p.full_name
  INTO v_borrow
  FROM public.borrowing_records br
  LEFT JOIN public.profiles p ON p.id = br.user_id
  WHERE br.book_copy_id = v_copy.id AND br.status = 'ACTIVE'
  ORDER BY br.borrowed_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_BORROWED', 'message', 'No active borrow record found for this copy.');
  END IF;

  -- Preview mode
  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true, 'preview', true,
      'book_title',   v_copy.title,
      'student_name', COALESCE(v_borrow.full_name, 'Student')
    );
  END IF;

  -- Mark borrow record as returned
  UPDATE public.borrowing_records
  SET status = 'RETURNED', returned_at = v_now, updated_at = v_now
  WHERE id = v_borrow.id;

  -- Atomically check for next queued reservation for this book
  SELECT r.id, r.user_id
  INTO v_next_reservation
  FROM public.reservations r
  WHERE r.book_id = v_copy.book_id
    AND r.status  = 'ACTIVE'
  ORDER BY r.queue_position ASC, r.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Promote the next reservation to READY and assign this copy
    SELECT COALESCE(NULLIF(value, '')::INTEGER, 7)
    INTO v_hold_expiry_days
    FROM public.system_settings
    WHERE key = 'hold_expiry_days'
    LIMIT 1;

    v_hold_expires_at := v_now + make_interval(days => GREATEST(v_hold_expiry_days, 1));

    UPDATE public.reservations
    SET
      status         = 'READY',
      copy_id        = v_copy.id,
      fulfilled_at   = v_now,
      hold_expires_at = v_hold_expires_at,
      updated_at     = v_now
    WHERE id = v_next_reservation.id;

    -- Mark copy as RESERVED for the next student
    UPDATE public.book_copies
    SET status = 'RESERVED', updated_at = v_now
    WHERE id = v_copy.id;

    -- Fetch name for the librarian notification
    SELECT full_name INTO v_student_name
    FROM public.profiles
    WHERE id = v_next_reservation.user_id;

    v_result := jsonb_build_object(
      'ok',                true,
      'book_title',        v_copy.title,
      'returned_at',       v_now,
      'student_name',      COALESCE(v_borrow.full_name, 'Student'),
      'reservation_ready', true,
      'reserved_for',      COALESCE(v_student_name, 'Reserved Student')
    );
  ELSE
    -- No one waiting — release copy to AVAILABLE
    UPDATE public.book_copies
    SET status = 'AVAILABLE', updated_at = v_now
    WHERE id = v_copy.id;

    v_result := jsonb_build_object(
      'ok',           true,
      'book_title',   v_copy.title,
      'returned_at',  v_now,
      'student_name', COALESCE(v_borrow.full_name, 'Student'),
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
