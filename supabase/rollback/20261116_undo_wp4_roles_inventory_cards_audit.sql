-- Undo for migration 20261116170000_wp4_roles_inventory_cards_audit.sql.
-- Restores prior audit_logs RLS policy, prior process_qr_checkout without self-checkout check,
-- removes trg_ensure_profile_library_card, and drops profiles.patron_type.
BEGIN;

DROP POLICY IF EXISTS "Managers can view permitted audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Librarians can view all audit logs" ON public.audit_logs;
CREATE POLICY "Librarians can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_manager());

DROP FUNCTION IF EXISTS public.can_view_audit_log(uuid);

DROP TRIGGER IF EXISTS trg_ensure_profile_library_card ON public.profiles;
DROP FUNCTION IF EXISTS public.ensure_profile_library_card();

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
BEGIN
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  SELECT lc.user_id, lc.card_number, lc.status as card_status, p.full_name, p.student_id, p.status as profile_status
  INTO v_card
  FROM public.library_cards lc
  JOIN public.profiles p ON p.id = lc.user_id
  WHERE lc.card_number = p_card_qr
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_NOT_FOUND', 'message', 'Library card not found.');
  END IF;

  IF UPPER(v_card.card_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CARD_INACTIVE', 'message', 'Library card is not active.');
  END IF;

  IF UPPER(v_card.profile_status) <> 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Student account is not active.');
  END IF;

  SELECT
    COALESCE(MAX(CASE WHEN key = 'max_borrow_limit'      THEN value::INTEGER END), 5),
    COALESCE(MAX(CASE WHEN key = 'loan_period_days'      THEN value::INTEGER END), 14)
  INTO v_max_borrow_limit, v_loan_days
  FROM public.system_settings
  WHERE key IN ('max_borrow_limit', 'loan_period_days');

  PERFORM pg_advisory_xact_lock(hashtextextended(v_card.user_id::text, 0));

  SELECT COUNT(*) INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id AND status IN ('ACTIVE', 'OVERDUE');

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED', 'message', 'Borrow limit reached.');
  END IF;

  SELECT bc.id, bc.book_id, bc.status, b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE OF bc;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_NOT_FOUND', 'message', 'Book copy not found.');
  END IF;

  IF v_copy.status = 'RESERVED' THEN
    SELECT r.id
    INTO v_res_id
    FROM public.reservations r
    WHERE r.copy_id   = v_copy.id
      AND r.user_id   = v_card.user_id
      AND r.status    = 'READY'
    LIMIT 1;

    IF v_res_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is reserved for another student.');
    END IF;
  ELSIF v_copy.status <> 'AVAILABLE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'COPY_UNAVAILABLE', 'message', 'This copy is not available for checkout.');
  END IF;

  v_due_date := NOW() + make_interval(days => v_loan_days);

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'ok', true, 'preview', true,
      'student_name', v_card.full_name,
      'book_title',   v_copy.title,
      'due_date',     v_due_date
    );
  END IF;

  UPDATE public.book_copies
  SET status = 'BORROWED', updated_at = NOW()
  WHERE id = v_copy.id;

  INSERT INTO public.borrowing_records (user_id, book_copy_id, processed_by, borrowed_at, due_date, status)
  VALUES (v_card.user_id, v_copy.id, p_librarian_id, NOW(), v_due_date, 'ACTIVE')
  RETURNING id INTO v_borrowing_id;

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

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_patron_type_check,
  DROP COLUMN IF EXISTS patron_type;

COMMIT;
