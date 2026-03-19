-- Reconcile schema drift between Supabase migrations and Prisma model.

-- 1) Profiles parity
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2) Categories parity
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.categories
SET slug = regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL OR btrim(slug) = '';

UPDATE public.categories c
SET slug = c.slug || '-' || left(c.id::text, 8)
WHERE EXISTS (
  SELECT 1
  FROM public.categories d
  WHERE d.id <> c.id
    AND d.slug = c.slug
);

ALTER TABLE public.categories ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_slug_key'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 3) Borrowing records parity
ALTER TABLE public.borrowing_records ADD COLUMN IF NOT EXISTS returned_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'borrowing_records_returned_by_fkey'
      AND conrelid = 'public.borrowing_records'::regclass
  ) THEN
    ALTER TABLE public.borrowing_records
      ADD CONSTRAINT borrowing_records_returned_by_fkey
      FOREIGN KEY (returned_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Status type reconciliation for borrowing_records.status
DO $$
DECLARE
  v_udt_name TEXT;
BEGIN
  SELECT c.udt_name
  INTO v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'borrowing_records'
    AND c.column_name = 'status';

  IF v_udt_name = 'text' THEN
    -- Legacy schema defines a lowercase CHECK constraint on status;
    -- drop it before normalizing rows to uppercase enum literals.
    ALTER TABLE public.borrowing_records
      DROP CONSTRAINT IF EXISTS borrowing_records_status_check;

    BEGIN
      CREATE TYPE "BorrowStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    UPDATE public.borrowing_records
    SET status = CASE
      WHEN UPPER(status) = 'ACTIVE' THEN 'ACTIVE'
      WHEN UPPER(status) = 'RETURNED' THEN 'RETURNED'
      WHEN UPPER(status) = 'OVERDUE' THEN 'OVERDUE'
      ELSE 'OVERDUE'
    END;

    ALTER TABLE public.borrowing_records
      ALTER COLUMN status DROP DEFAULT;

    -- Legacy partial index compares status to lowercase text; remove before type conversion.
    DROP INDEX IF EXISTS uq_borrowing_records_active_copy;

    ALTER TABLE public.borrowing_records
      ALTER COLUMN status TYPE "BorrowStatus"
      USING (
        CASE
          WHEN UPPER(status::text) = 'ACTIVE' THEN 'ACTIVE'::"BorrowStatus"
          WHEN UPPER(status::text) = 'RETURNED' THEN 'RETURNED'::"BorrowStatus"
          WHEN UPPER(status::text) = 'OVERDUE' THEN 'OVERDUE'::"BorrowStatus"
          ELSE 'OVERDUE'::"BorrowStatus"
        END
      );

    ALTER TABLE public.borrowing_records
      ALTER COLUMN status SET DEFAULT 'ACTIVE'::"BorrowStatus";
  END IF;
END $$;

DROP INDEX IF EXISTS uq_borrowing_records_active_copy;
CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowing_records_active_copy
  ON public.borrowing_records(book_copy_id)
  WHERE status = 'ACTIVE';

-- 5) QR column parity for book_copies
ALTER TABLE public.book_copies ADD COLUMN IF NOT EXISTS qr_string TEXT;
ALTER TABLE public.book_copies ADD COLUMN IF NOT EXISTS qr_code TEXT;

UPDATE public.book_copies SET qr_code = qr_string WHERE qr_code IS NULL AND qr_string IS NOT NULL;
UPDATE public.book_copies SET qr_string = qr_code WHERE qr_string IS NULL AND qr_code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'book_copies_qr_code_key'
      AND conrelid = 'public.book_copies'::regclass
  ) THEN
    ALTER TABLE public.book_copies
      ADD CONSTRAINT book_copies_qr_code_key UNIQUE (qr_code);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS book_copies_qr_string_key ON public.book_copies(qr_string);
CREATE INDEX IF NOT EXISTS idx_book_copies_qr_code ON public.book_copies(qr_code);
CREATE INDEX IF NOT EXISTS idx_book_copies_qr_string ON public.book_copies(qr_string);

CREATE OR REPLACE FUNCTION public.sync_book_copy_qr_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.qr_code IS NULL AND NEW.qr_string IS NOT NULL THEN
    NEW.qr_code := NEW.qr_string;
  ELSIF NEW.qr_string IS NULL AND NEW.qr_code IS NOT NULL THEN
    NEW.qr_string := NEW.qr_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_book_copy_qr_columns ON public.book_copies;
CREATE TRIGGER trg_sync_book_copy_qr_columns
BEFORE INSERT OR UPDATE ON public.book_copies
FOR EACH ROW
EXECUTE FUNCTION public.sync_book_copy_qr_columns();

-- 6) Ensure system_settings exists (canonical policy table)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL DEFAULT 'string',
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7) Replace checkout function with system_settings + canonical statuses.
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

  SELECT
    COALESCE(MAX(CASE WHEN key IN ('max_borrow_limit', 'borrow_limit') THEN NULLIF(value, '')::INTEGER END), 5),
    COALESCE(MAX(CASE WHEN key IN ('default_loan_period_days', 'loan_period_days', 'borrow_days') THEN NULLIF(value, '')::INTEGER END), 14),
    COALESCE(MAX(CASE WHEN key IN ('max_outstanding_fines', 'fine_threshold') THEN NULLIF(value, '')::NUMERIC END), 100)
  INTO v_max_borrow_limit, v_loan_days, v_fine_threshold
  FROM public.system_settings;

  SELECT COUNT(*)
  INTO v_active_borrows
  FROM public.borrowing_records
  WHERE user_id = v_card.user_id
    AND UPPER(status::text) = 'ACTIVE';

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
      bc.qr_string,
      b.title
    INTO v_copy
    FROM public.book_copies bc
    JOIN public.books b ON b.id = bc.book_id
    WHERE bc.qr_string = p_book_qr OR bc.qr_code = p_book_qr
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

  IF UPPER(v_copy.status::text) <> 'AVAILABLE' THEN
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
      'book_qr', COALESCE(v_copy.qr_string, p_book_qr),
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
    'ACTIVE',
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
    'book_qr', COALESCE(v_copy.qr_string, p_book_qr),
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
      COALESCE(v_copy.qr_string, p_book_qr),
      v_result
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

-- 8) Replace return function to write returned_by.
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
    WHERE bc.qr_string = p_book_qr OR bc.qr_code = p_book_qr
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
    AND UPPER(br.status::text) = 'ACTIVE'
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
  SET
    status = 'RETURNED',
    returned_at = v_now,
    returned_by = p_librarian_id,
    updated_at = v_now
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

-- 9) Harden new-user trigger to avoid brittle student_id assumptions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  student_id_val TEXT;
  card_number_val TEXT;
BEGIN
  student_id_val := NULL;

  IF new.email IS NOT NULL AND lower(new.email) ~ '^[^@.]+\.[a-z0-9_-]+@alabang\.sti\.edu\.ph$' THEN
    student_id_val := upper(split_part(split_part(lower(new.email), '@', 1), '.', 2));
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    student_id,
    email,
    updated_at,
    created_at
  )
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(COALESCE(new.email, 'user'), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    student_id_val,
    new.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    student_id = COALESCE(public.profiles.student_id, EXCLUDED.student_id),
    updated_at = NOW();

  card_number_val := 'LIB-' || to_char(NOW(), 'YYYY') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.library_cards (user_id, card_number, status, expires_at)
  VALUES (
    new.id,
    card_number_val,
    'pending',
    NOW() + interval '1 year'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;
