CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  librarian_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  book_qr TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_idempotency_created_at
  ON public.checkout_idempotency(created_at DESC);

CREATE OR REPLACE FUNCTION public.process_qr_checkout(
  p_librarian_id UUID,
  p_card_qr TEXT,
  p_book_qr TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_copy RECORD;
  v_active_borrows INTEGER := 0;
  v_max_borrow_limit INTEGER := 5;
  v_loan_days INTEGER := 14;
  v_fine_threshold NUMERIC := 100;
  v_outstanding_fines NUMERIC := 0;
  v_due_date TIMESTAMPTZ;
  v_borrowing_id UUID;
  v_existing JSONB;
  v_result JSONB;
BEGIN
  IF p_librarian_id IS NULL OR p_card_qr IS NULL OR p_book_qr IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'Missing required checkout fields.'
    );
  END IF;

  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response
    INTO v_existing
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  SELECT
    lc.user_id,
    lc.card_number,
    lc.status,
    p.full_name,
    p.student_id
  INTO v_card
  FROM public.library_cards lc
  JOIN public.profiles p ON p.id = lc.user_id
  WHERE lc.card_number = p_card_qr
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CARD_NOT_FOUND',
      'message', 'Student card was not recognized.'
    );
  END IF;

  IF LOWER(v_card.status) <> 'active' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CARD_INACTIVE',
      'message', 'Student card is not active.'
    );
  END IF;

  IF to_regclass('public.settings') IS NOT NULL THEN
    SELECT
      COALESCE(MAX(CASE WHEN key IN ('max_borrow_limit', 'borrow_limit') THEN NULLIF(value, '')::INTEGER END), 5),
      COALESCE(MAX(CASE WHEN key IN ('loan_period_days', 'borrow_days') THEN NULLIF(value, '')::INTEGER END), 14),
      COALESCE(MAX(CASE WHEN key IN ('max_outstanding_fines', 'fine_threshold') THEN NULLIF(value, '')::NUMERIC END), 100)
    INTO v_max_borrow_limit, v_loan_days, v_fine_threshold
    FROM public.settings;
  END IF;

  IF to_regclass('public.borrowing_records') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_active_borrows
    FROM public.borrowing_records
    WHERE user_id = v_card.user_id
      AND status = 'active';
  END IF;

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'LIMIT_EXCEEDED',
      'message', 'Student has reached the maximum borrow limit.'
    );
  END IF;

  IF to_regclass('public.fines') IS NOT NULL THEN
    BEGIN
      EXECUTE '
        SELECT COALESCE(SUM(amount), 0)
        FROM public.fines
        WHERE user_id = $1
          AND status IN (''unpaid'', ''open'')
      '
      INTO v_outstanding_fines
      USING v_card.user_id;
    EXCEPTION
      WHEN undefined_column THEN
        v_outstanding_fines := 0;
    END;
  END IF;

  IF v_outstanding_fines > v_fine_threshold THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'FINE_THRESHOLD_EXCEEDED',
      'message', 'Student has fines above the allowed threshold.'
    );
  END IF;

  BEGIN
    SELECT
      bc.id,
      bc.book_id,
      bc.status,
      b.title
    INTO v_copy
    FROM public.book_copies bc
    JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'COPY_LOCKED',
        'message', 'This book copy was just checked out by another session.'
      );
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_NOT_FOUND',
      'message', 'Book QR code was not recognized.'
    );
  END IF;

  IF UPPER(v_copy.status) <> 'AVAILABLE' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_UNAVAILABLE',
      'message', 'This book copy is no longer available.'
    );
  END IF;

  v_due_date := NOW() + make_interval(days => GREATEST(v_loan_days, 1));

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'student_name', COALESCE(v_card.full_name, 'Student'),
      'student_id', COALESCE(v_card.student_id, 'N/A'),
      'book_title', v_copy.title,
      'book_qr', p_book_qr,
      'card_number', v_card.card_number,
      'due_date', v_due_date
    );
  END IF;

  UPDATE public.book_copies
  SET status = 'BORROWED', updated_at = NOW()
  WHERE id = v_copy.id;

  INSERT INTO public.borrowing_records (
    user_id,
    book_copy_id,
    processed_by,
    borrowed_at,
    due_date,
    status,
    renewal_count
  ) VALUES (
    v_card.user_id,
    v_copy.id,
    p_librarian_id,
    NOW(),
    v_due_date,
    'active',
    0
  )
  RETURNING id INTO v_borrowing_id;

  v_result := jsonb_build_object(
    'ok', true,
    'preview', false,
    'borrowing_id', v_borrowing_id,
    'student_name', COALESCE(v_card.full_name, 'Student'),
    'student_id', COALESCE(v_card.student_id, 'N/A'),
    'book_title', v_copy.title,
    'book_qr', p_book_qr,
    'card_number', v_card.card_number,
    'due_date', v_due_date
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.checkout_idempotency (
      idempotency_key,
      librarian_id,
      card_number,
      book_qr,
      response
    ) VALUES (
      p_idempotency_key,
      p_librarian_id,
      v_card.card_number,
      p_book_qr,
      v_result
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;
