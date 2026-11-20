-- WP1: Fine resolutions (PAID / CONDONED), remarks, and settled_by tracking on borrowing_records
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

ALTER TABLE public.borrowing_records
  ADD COLUMN IF NOT EXISTS fine_resolution TEXT,
  ADD COLUMN IF NOT EXISTS fine_remarks TEXT,
  ADD COLUMN IF NOT EXISTS fine_settled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.borrowing_records
  DROP CONSTRAINT IF EXISTS borrowing_records_fine_resolution_check,
  ADD CONSTRAINT borrowing_records_fine_resolution_check
    CHECK (fine_resolution IN ('PAID', 'CONDONED'));

-- Backfill existing settled rows before enforcing the paired constraint
UPDATE public.borrowing_records
SET fine_resolution = 'PAID'
WHERE fine_settled_at IS NOT NULL
  AND fine_resolution IS NULL;

ALTER TABLE public.borrowing_records
  DROP CONSTRAINT IF EXISTS borrowing_records_fine_settlement_pair_check,
  ADD CONSTRAINT borrowing_records_fine_settlement_pair_check
    CHECK (
      (fine_settled_at IS NULL AND fine_resolution IS NULL)
      OR (fine_settled_at IS NOT NULL AND fine_resolution IS NOT NULL)
    );

DROP FUNCTION IF EXISTS public.get_borrowing_history_v2(uuid, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.get_borrowing_history_v2(uuid, integer, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.get_borrowing_history_v2(
  p_user_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_resolution text DEFAULT NULL
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
  fine_resolution text,
  fine_remarks text,
  fine_settled_by uuid,
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
      br.fine_settled_at,
      br.fine_resolution,
      br.fine_remarks,
      br.fine_settled_by
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
        OR (UPPER(p_status) = 'CURRENT' AND (
          br.status IN ('ACTIVE', 'OVERDUE')
          OR (br.status = 'RETURNED' AND COALESCE(br.fine_amount, 0) > 0 AND br.fine_settled_at IS NULL)
        ))
        OR (UPPER(p_status) = 'RETURNED' AND br.status = 'RETURNED' AND (COALESCE(br.fine_amount, 0) = 0 OR br.fine_settled_at IS NOT NULL))
        OR (UPPER(p_status) = 'SETTLED' AND COALESCE(br.fine_amount, 0) > 0 AND br.fine_settled_at IS NOT NULL)
        OR (v_norm_status IS NOT NULL AND UPPER(p_status) NOT IN ('ACTIVE', 'OVERDUE', 'CURRENT', 'RETURNED', 'SETTLED') AND br.status = v_norm_status)
      )
      AND (
        p_resolution IS NULL OR p_resolution = '' OR LOWER(p_resolution) = 'all'
        OR br.fine_resolution = UPPER(p_resolution)
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
    f.fine_resolution,
    f.fine_remarks,
    f.fine_settled_by,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY
    CASE
      WHEN UPPER(COALESCE(p_status, '')) = 'CURRENT' THEN
        CASE
          WHEN f.status = 'OVERDUE'
            OR (f.status = 'ACTIVE' AND f.due_date < NOW())
            OR (f.status = 'RETURNED' AND COALESCE(f.fine_amount, 0) > 0 AND f.fine_settled_at IS NULL)
          THEN 0
          ELSE 1
        END
      ELSE 0
    END ASC,
    CASE WHEN UPPER(COALESCE(p_status, '')) = 'CURRENT' THEN f.due_date ELSE NULL END ASC,
    f.borrowed_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_borrowing_history_v2(uuid, int, int, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_borrowing_history_v2(uuid, int, int, text, text, text) TO authenticated, service_role;

COMMIT;
