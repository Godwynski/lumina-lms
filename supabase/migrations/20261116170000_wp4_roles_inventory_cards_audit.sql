-- WP4: profiles.patron_type, library card trigger/backfill, self-checkout block, and audit_logs actor-scoped RLS
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

-- 1. #14: profiles.patron_type ('student' | 'faculty')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS patron_type TEXT NOT NULL DEFAULT 'student';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_patron_type_check,
  ADD CONSTRAINT profiles_patron_type_check
    CHECK (patron_type IN ('student', 'faculty'));

-- 2. #16: Ensure every profile row gets a library_cards row, backfill missing/pending staff cards
CREATE OR REPLACE FUNCTION public.ensure_profile_library_card()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_card_number TEXT;
BEGIN
  v_card_number := 'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (
    NEW.id,
    v_card_number,
    CASE WHEN UPPER(COALESCE(NEW.status, 'PENDING')) = 'ACTIVE' THEN 'ACTIVE' ELSE 'PENDING' END,
    now() + interval '100 years'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_library_card ON public.profiles;
CREATE TRIGGER trg_ensure_profile_library_card
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_library_card();

INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
SELECT
  p.id,
  'LIB-' || to_char(now(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  CASE WHEN UPPER(COALESCE(p.status, 'PENDING')) = 'ACTIVE' THEN 'ACTIVE' ELSE 'PENDING' END,
  now() + interval '100 years'
FROM public.profiles p
LEFT JOIN public.library_cards lc ON lc.user_id = p.id
WHERE lc.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.library_cards lc
SET status = 'ACTIVE', updated_at = NOW()
FROM public.profiles p
WHERE lc.user_id = p.id
  AND UPPER(p.status) = 'ACTIVE'
  AND UPPER(lc.status) = 'PENDING'
  AND p.role IN ('super_admin'::public.user_role, 'librarian'::public.user_role, 'student_assistant'::public.user_role);

-- 3. #16: Block staff self-checkout in process_qr_checkout
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
  -- Idempotency check
  IF NOT p_preview_only AND p_idempotency_key IS NOT NULL THEN
    SELECT response INTO v_existing
    FROM public.checkout_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- Resolve patron card → profile
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
    RETURN jsonb_build_object('ok', false, 'code', 'ACCOUNT_INACTIVE', 'message', 'Student account is not active.');
  END IF;

  -- Read policy settings from system_settings
  SELECT
    COALESCE(MAX(CASE WHEN key = 'max_borrow_limit'      THEN value::INTEGER END), 5),
    COALESCE(MAX(CASE WHEN key = 'loan_period_days'      THEN value::INTEGER END), 14)
  INTO v_max_borrow_limit, v_loan_days
  FROM public.system_settings
  WHERE key IN ('max_borrow_limit', 'loan_period_days');

  -- Serialize checkouts per patron so two desks can't both pass the limit check
  PERFORM pg_advisory_xact_lock(hashtextextended(v_card.user_id::text, 0));

  -- Check current loan count (overdue loans still count)
  SELECT COUNT(*) INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id AND status IN ('ACTIVE', 'OVERDUE');

  IF v_active_borrows >= v_max_borrow_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_EXCEEDED', 'message', 'Borrow limit reached.');
  END IF;

  -- Lock + fetch the copy
  SELECT bc.id, bc.book_id, bc.status, b.title
  INTO v_copy
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.qr_string = p_book_qr
  FOR UPDATE OF bc;

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

-- 4. #17: Audit log RLS — super_admin sees all; librarian sees rows whose actor is not super_admin (null actor = system rows, visible)
CREATE OR REPLACE FUNCTION public.can_view_audit_log(p_actor_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role public.user_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = (SELECT auth.uid())
    AND status = 'ACTIVE';

  IF v_caller_role = 'super_admin'::public.user_role THEN
    RETURN TRUE;
  END IF;

  IF v_caller_role = 'librarian'::public.user_role THEN
    IF p_actor_id IS NULL THEN
      RETURN TRUE;
    END IF;
    RETURN NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = p_actor_id
        AND role = 'super_admin'::public.user_role
    );
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_audit_log(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_audit_log(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Librarians can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Managers can view permitted audit logs" ON public.audit_logs;
CREATE POLICY "Managers can view permitted audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.can_view_audit_log(admin_id));

COMMIT;
