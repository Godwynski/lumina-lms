-- Add configurable overdue penalty snapshot + settlement tracking on borrowing_records
ALTER TABLE public.borrowing_records
  ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fine_settled_at TIMESTAMPTZ;

INSERT INTO public.system_settings (key, value, description, data_type)
VALUES ('overdue_fine_per_day', '5', 'Daily overdue penalty in PHP', 'number')
ON CONFLICT (key) DO NOTHING;

-- Atomic transaction-safe QR return procedure with fine_amount snapshot
CREATE OR REPLACE FUNCTION public.process_qr_return(
  p_librarian_id uuid,
  p_book_qr text,
  p_idempotency_key text DEFAULT NULL::text,
  p_preview_only boolean DEFAULT false
)
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
  SELECT br.id, br.user_id, br.borrowed_at, br.due_date, br.status, br.fine_amount, p.full_name
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
      (idempotency_key, response)
    VALUES
      (p_idempotency_key, v_result)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_qr_return(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;

-- Drop first so PostgreSQL allows extending RETURNS TABLE with fine_amount + fine_settled_at
DROP FUNCTION IF EXISTS public.get_borrowing_history_v2(uuid, integer, integer, text, text);
CREATE OR REPLACE FUNCTION public.get_borrowing_history_v2(
  p_user_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  book_copy_id uuid,
  user_id uuid,
  status public."BorrowStatus",
  borrowed_at timestamptz,
  due_date timestamptz,
  returned_at timestamptz,
  book_id uuid,
  book_title text,
  book_author text,
  book_cover_url text,
  book_isbn text,
  copy_qr text,
  copy_accession text,
  profile_id uuid,
  profile_name text,
  profile_email text,
  profile_student_id text,
  fine_amount numeric,
  fine_settled_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_norm_status public."BorrowStatus" := NULL;
  v_fine_rate numeric := 5;
BEGIN
  -- Restrict unauthorized/patron access to their own records only
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF (SELECT auth.uid()) IS NULL THEN
      RETURN;
    END IF;
    IF NOT public.is_staff() THEN
      p_user_id := (SELECT auth.uid());
    END IF;
  END IF;

  SELECT COALESCE(MAX(NULLIF(value, '')::numeric), 5)
  INTO v_fine_rate
  FROM public.system_settings
  WHERE key = 'overdue_fine_per_day';

  IF p_status IS NOT NULL AND p_status != 'all' AND p_status != '' THEN
    BEGIN
      v_norm_status := UPPER(p_status)::public."BorrowStatus";
    EXCEPTION WHEN OTHERS THEN
      v_norm_status := NULL;
    END;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      br.id,
      br.book_copy_id,
      br.user_id,
      br.status,
      br.borrowed_at,
      br.due_date,
      br.returned_at,
      b.id AS book_id,
      b.title AS book_title,
      b.author AS book_author,
      b.cover_url AS book_cover_url,
      b.isbn AS book_isbn,
      bc.qr_string AS copy_qr,
      bc.accession_number AS copy_accession,
      p.id AS profile_id,
      p.full_name AS profile_name,
      p.email AS profile_email,
      p.student_id AS profile_student_id,
      CASE
        WHEN br.fine_amount IS NOT NULL THEN br.fine_amount
        WHEN br.returned_at IS NULL AND (NOW() > br.due_date OR br.status = 'OVERDUE')
          THEN GREATEST(1, ((NOW() AT TIME ZONE 'Asia/Manila')::date - (br.due_date AT TIME ZONE 'Asia/Manila')::date)) * v_fine_rate
        ELSE 0
      END::numeric(10,2) AS fine_amount,
      br.fine_settled_at
    FROM borrowing_records br
    JOIN book_copies bc ON br.book_copy_id = bc.id
    JOIN books b ON bc.book_id = b.id
    LEFT JOIN profiles p ON br.user_id = p.id
    WHERE (p_user_id IS NULL OR br.user_id = p_user_id)
      AND (
        p_status IS NULL OR p_status = '' OR LOWER(p_status) = 'all'
        OR (UPPER(p_status) = 'ACTIVE' AND br.status = 'ACTIVE' AND br.due_date >= NOW())
        OR (UPPER(p_status) = 'OVERDUE' AND (
          br.status = 'OVERDUE'
          OR (br.status = 'ACTIVE' AND br.due_date < NOW())
          OR (br.status = 'RETURNED' AND COALESCE(br.fine_amount, 0) > 0 AND br.fine_settled_at IS NULL)
        ))
        OR (UPPER(p_status) = 'RETURNED' AND br.status = 'RETURNED' AND (COALESCE(br.fine_amount, 0) = 0 OR br.fine_settled_at IS NOT NULL))
        OR (UPPER(p_status) = 'SETTLED' AND COALESCE(br.fine_amount, 0) > 0 AND br.fine_settled_at IS NOT NULL)
        OR (v_norm_status IS NOT NULL AND UPPER(p_status) NOT IN ('ACTIVE', 'OVERDUE', 'RETURNED', 'SETTLED') AND br.status = v_norm_status)
      )
      AND (
        p_search IS NULL OR p_search = '' OR (
          -- Borrower
          p.full_name ILIKE '%' || p_search || '%'
          OR p.student_id ILIKE '%' || p_search || '%'
          OR p.email ILIKE '%' || p_search || '%'
          -- Book
          OR b.title ILIKE '%' || p_search || '%'
          OR b.author ILIKE '%' || p_search || '%'
          OR b.isbn ILIKE '%' || p_search || '%'
          -- Copy / Barcode
          OR bc.qr_string ILIKE '%' || p_search || '%'
          OR bc.accession_number ILIKE '%' || p_search || '%'
          -- Status
          OR br.status::text ILIKE '%' || p_search || '%'
          -- Timeline: Borrowed (Local & UTC, full month & short month)
          OR to_char(br.borrowed_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          OR to_char(br.borrowed_at, 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          -- Timeline: Due Date (Local & UTC)
          OR to_char(br.due_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          OR to_char(br.due_date, 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          -- Timeline: Returned Date (Local & UTC)
          OR (br.returned_at IS NOT NULL AND (
            to_char(br.returned_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
            OR to_char(br.returned_at, 'YYYY-MM-DD FMMonth FMDD, YYYY FMMon FMDD, YYYY FMDD Dy') ILIKE '%' || p_search || '%'
          ))
        )
      )
  )
  SELECT
    f.id,
    f.book_copy_id,
    f.user_id,
    f.status,
    f.borrowed_at,
    f.due_date,
    f.returned_at,
    f.book_id,
    f.book_title,
    f.book_author,
    f.book_cover_url,
    f.book_isbn,
    f.copy_qr,
    f.copy_accession,
    f.profile_id,
    f.profile_name,
    f.profile_email,
    f.profile_student_id,
    f.fine_amount,
    f.fine_settled_at,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.borrowed_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_borrowing_history_v2(uuid, int, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_borrowing_history_v2(uuid, int, int, text, text) TO authenticated, service_role;
