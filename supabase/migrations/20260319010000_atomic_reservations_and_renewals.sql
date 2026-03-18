-- Phase 1 hardening: transactional reservation queueing and renewal processing.

DO $$
DECLARE
  v_udt_name TEXT;
BEGIN
  SELECT c.udt_name
  INTO v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reservations'
    AND c.column_name = 'status';

  IF v_udt_name = 'ReservationStatus' THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_active_user_book
      ON public.reservations (user_id, book_id)
      WHERE status = ''ACTIVE''
    ';
  ELSE
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_active_user_book
      ON public.reservations (user_id, book_id)
      WHERE status IN (''ACTIVE'', ''active'')
    ';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
  p_actor_id UUID,
  p_book_id UUID,
  p_target_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_target_user_id UUID;
  v_book_exists BOOLEAN := false;
  v_existing_id UUID;
  v_hold_expiry_days INTEGER := 7;
  v_queue_position INTEGER := 1;
  v_hold_expires_at TIMESTAMPTZ;
  v_reservation_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_book_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'Missing required fields.'
    );
  END IF;

  SELECT role::text INTO v_actor_role
  FROM public.profiles
  WHERE id = p_actor_id;

  IF v_actor_role IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'UNAUTHORIZED',
      'message', 'Actor profile not found.'
    );
  END IF;

  v_target_user_id := COALESCE(p_target_user_id, p_actor_id);

  IF v_actor_role NOT IN ('admin', 'librarian', 'staff') AND v_target_user_id <> p_actor_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'You can only create reservations for yourself.'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_target_user_id) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'TARGET_USER_NOT_FOUND',
      'message', 'Target user was not found.'
    );
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.books WHERE id = p_book_id) INTO v_book_exists;
  IF NOT v_book_exists THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'BOOK_NOT_FOUND',
      'message', 'Book not found.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_book_id::text, 0));

  SELECT id INTO v_existing_id
  FROM public.reservations
  WHERE user_id = v_target_user_id
    AND book_id = p_book_id
    AND status::text IN ('ACTIVE', 'active')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'DUPLICATE_ACTIVE_RESERVATION',
      'message', 'User already has an active reservation for this book.'
    );
  END IF;

  SELECT COALESCE(NULLIF(value, '')::INTEGER, 7)
  INTO v_hold_expiry_days
  FROM public.system_settings
  WHERE key = 'hold_expiry_days'
  LIMIT 1;

  SELECT COALESCE(MAX(queue_position), 0) + 1
  INTO v_queue_position
  FROM public.reservations
  WHERE book_id = p_book_id
    AND status::text IN ('ACTIVE', 'active');

  v_hold_expires_at := NOW() + make_interval(days => GREATEST(v_hold_expiry_days, 1));

  INSERT INTO public.reservations (
    user_id,
    book_id,
    reserved_at,
    hold_expires_at,
    queue_position
  ) VALUES (
    v_target_user_id,
    p_book_id,
    NOW(),
    v_hold_expires_at,
    v_queue_position
  )
  RETURNING id INTO v_reservation_id;

  BEGIN
    INSERT INTO public.audit_logs (
      admin_id,
      entity_type,
      entity_id,
      action,
      new_value,
      reason
    ) VALUES (
      p_actor_id,
      'reservation',
      v_reservation_id,
      'create',
      jsonb_build_object(
        'user_id', v_target_user_id,
        'book_id', p_book_id,
        'queue_position', v_queue_position
      )::text,
      'Reservation created'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'reservation_id', v_reservation_id,
    'queue_position', v_queue_position,
    'hold_expires_at', v_hold_expires_at,
    'hold_expiry_days', v_hold_expiry_days
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'DUPLICATE_ACTIVE_RESERVATION',
      'message', 'User already has an active reservation for this book.'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_borrowing_atomic(
  p_actor_id UUID,
  p_borrowing_record_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_borrow RECORD;
  v_max_renewal_count INTEGER := 3;
  v_renewal_period_days INTEGER := 14;
  v_new_due_date TIMESTAMPTZ;
  v_renewal_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_borrowing_record_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_INPUT',
      'message', 'Missing required renewal fields.'
    );
  END IF;

  SELECT role::text INTO v_actor_role
  FROM public.profiles
  WHERE id = p_actor_id;

  IF v_actor_role NOT IN ('admin', 'librarian', 'staff') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'FORBIDDEN',
      'message', 'Only staff can renew borrowing records.'
    );
  END IF;

  SELECT * INTO v_borrow
  FROM public.borrowing_records
  WHERE id = p_borrowing_record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'BORROW_NOT_FOUND',
      'message', 'Borrowing record not found.'
    );
  END IF;

  IF UPPER(v_borrow.status::text) <> 'ACTIVE' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'BORROW_NOT_ACTIVE',
      'message', 'Only active borrowing records can be renewed.'
    );
  END IF;

  SELECT COALESCE(NULLIF(value, '')::INTEGER, 3)
  INTO v_max_renewal_count
  FROM public.system_settings
  WHERE key = 'max_renewal_count'
  LIMIT 1;

  SELECT COALESCE(NULLIF(value, '')::INTEGER, 14)
  INTO v_renewal_period_days
  FROM public.system_settings
  WHERE key = 'renewal_period_days'
  LIMIT 1;

  IF v_borrow.renewal_count >= v_max_renewal_count THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'MAX_RENEWAL_EXCEEDED',
      'message', 'Maximum renewal count exceeded.'
    );
  END IF;

  v_new_due_date := v_borrow.due_date + make_interval(days => GREATEST(v_renewal_period_days, 1));

  INSERT INTO public.renewals (
    borrowing_record_id,
    renewed_by,
    renewed_at,
    new_due_date
  ) VALUES (
    p_borrowing_record_id,
    p_actor_id,
    NOW(),
    v_new_due_date
  )
  RETURNING id INTO v_renewal_id;

  UPDATE public.borrowing_records
  SET
    due_date = v_new_due_date,
    renewal_count = renewal_count + 1,
    updated_at = NOW()
  WHERE id = p_borrowing_record_id;

  RETURN jsonb_build_object(
    'ok', true,
    'renewal_id', v_renewal_id,
    'new_due_date', v_new_due_date,
    'renewal_count', v_borrow.renewal_count + 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_borrowing_atomic(UUID, UUID) TO authenticated;
