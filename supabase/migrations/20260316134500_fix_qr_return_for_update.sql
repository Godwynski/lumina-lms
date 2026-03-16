CREATE OR REPLACE FUNCTION public.process_qr_return(
  p_librarian_id UUID,
  p_book_qr TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copy RECORD;
  v_borrow RECORD;
  v_existing JSONB;
  v_result JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_librarian_id IS NULL OR p_book_qr IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'Missing required return fields.'
    );
  END IF;

  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response
    INTO v_existing
    FROM public.return_idempotency
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  BEGIN
    SELECT
      bc.id,
      bc.status,
      bc.qr_string,
      b.title
    INTO v_copy
    FROM public.book_copies bc
    JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr
    FOR UPDATE OF bc NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'COPY_LOCKED',
        'message', 'This book copy is being processed by another session.'
      );
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'COPY_NOT_FOUND',
      'message', 'Book QR code was not recognized.'
    );
  END IF;

  SELECT
    br.id,
    br.user_id,
    br.borrowed_at,
    br.due_date,
    (
      SELECT p.full_name
      FROM public.profiles p
      WHERE p.id = br.user_id
      LIMIT 1
    ) AS full_name
  INTO v_borrow
  FROM public.borrowing_records br
  WHERE br.book_copy_id = v_copy.id
    AND br.status = 'active'
  ORDER BY br.borrowed_at DESC
  LIMIT 1
  FOR UPDATE OF br;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_BORROWED',
      'message', 'This copy is not currently checked out.'
    );
  END IF;

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'borrowing_id', v_borrow.id,
      'book_title', v_copy.title,
      'book_qr', v_copy.qr_string,
      'borrowed_at', v_borrow.borrowed_at,
      'due_date', v_borrow.due_date,
      'student_name', COALESCE(v_borrow.full_name, 'Student')
    );
  END IF;

  UPDATE public.borrowing_records
  SET status = 'returned', returned_at = v_now, updated_at = v_now
  WHERE id = v_borrow.id;

  UPDATE public.book_copies
  SET status = 'AVAILABLE', updated_at = v_now
  WHERE id = v_copy.id;

  v_result := jsonb_build_object(
    'ok', true,
    'preview', false,
    'borrowing_id', v_borrow.id,
    'book_title', v_copy.title,
    'book_qr', v_copy.qr_string,
    'returned_at', v_now,
    'student_name', COALESCE(v_borrow.full_name, 'Student')
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.return_idempotency (
      idempotency_key,
      librarian_id,
      book_qr,
      response
    ) VALUES (
      p_idempotency_key,
      p_librarian_id,
      v_copy.qr_string,
      v_result
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;
