-- WP6 #10: Export & archive old borrowing_records and attendance rows
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.borrowing_records_archive (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    book_copy_id UUID NOT NULL,
    processed_by UUID,
    borrowed_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    status public."BorrowStatus",
    returned_by UUID,
    reminder_sent BOOLEAN,
    overdue_notified BOOLEAN,
    fine_amount NUMERIC(10,2),
    fine_settled_at TIMESTAMPTZ,
    fine_resolution TEXT,
    fine_remarks TEXT,
    fine_settled_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_archive (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS borrowing_records_archive_archived_at_idx
  ON public.borrowing_records_archive(archived_at DESC);
CREATE INDEX IF NOT EXISTS borrowing_records_archive_user_id_idx
  ON public.borrowing_records_archive(user_id);
CREATE INDEX IF NOT EXISTS attendance_archive_archived_at_idx
  ON public.attendance_archive(archived_at DESC);
CREATE INDEX IF NOT EXISTS attendance_archive_user_id_idx
  ON public.attendance_archive(user_id);

ALTER TABLE public.borrowing_records_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view borrowing archive" ON public.borrowing_records_archive;
CREATE POLICY "Super admins can view borrowing archive" ON public.borrowing_records_archive
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND status = 'ACTIVE'
        AND role = 'super_admin'::public.user_role
    )
  );

DROP POLICY IF EXISTS "Super admins can view attendance archive" ON public.attendance_archive;
CREATE POLICY "Super admins can view attendance archive" ON public.attendance_archive
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND status = 'ACTIVE'
        AND role = 'super_admin'::public.user_role
    )
  );

REVOKE ALL ON public.borrowing_records_archive, public.attendance_archive FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.borrowing_records_archive, public.attendance_archive TO authenticated;
GRANT ALL ON public.borrowing_records_archive, public.attendance_archive TO service_role;

CREATE OR REPLACE FUNCTION public.archive_old_logs(p_before DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_min_cutoff       DATE;
  v_cutoff           TIMESTAMPTZ;
  v_borrowing_count  INTEGER := 0;
  v_attendance_count INTEGER := 0;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND status = 'ACTIVE'
        AND role = 'super_admin'::public.user_role
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin can archive old logs';
    END IF;
  END IF;

  v_min_cutoff := ((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '1 year')::date;
  IF p_before IS NULL OR p_before > v_min_cutoff THEN
    RAISE EXCEPTION 'Cutoff date must be at least 1 year old (on or before %)', v_min_cutoff;
  END IF;

  v_cutoff := (p_before::timestamp AT TIME ZONE 'Asia/Manila');

  WITH moved_attendance AS (
    DELETE FROM public.attendance a
    WHERE a.check_out_at IS NOT NULL
      AND a.check_out_at < v_cutoff
    RETURNING a.id, a.user_id, a.check_in_at, a.check_out_at, a.notes, a.created_at
  ),
  inserted_attendance AS (
    INSERT INTO public.attendance_archive (
      id, user_id, check_in_at, check_out_at, notes, created_at, archived_at
    )
    SELECT id, user_id, check_in_at, check_out_at, notes, created_at, NOW()
    FROM moved_attendance
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ),
  moved_borrowing AS (
    DELETE FROM public.borrowing_records br
    WHERE br.status = 'RETURNED'::public."BorrowStatus"
      AND COALESCE(br.returned_at, br.borrowed_at) < v_cutoff
      AND (COALESCE(br.fine_amount, 0) <= 0 OR br.fine_settled_at IS NOT NULL)
    RETURNING
      br.id, br.user_id, br.book_copy_id, br.processed_by,
      br.borrowed_at, br.due_date, br.returned_at, br.status,
      br.returned_by, br.reminder_sent, br.overdue_notified,
      br.fine_amount, br.fine_settled_at, br.fine_resolution,
      br.fine_remarks, br.fine_settled_by, br.created_at, br.updated_at
  ),
  inserted_borrowing AS (
    INSERT INTO public.borrowing_records_archive (
      id, user_id, book_copy_id, processed_by,
      borrowed_at, due_date, returned_at, status,
      returned_by, reminder_sent, overdue_notified,
      fine_amount, fine_settled_at, fine_resolution,
      fine_remarks, fine_settled_by, created_at, updated_at, archived_at
    )
    SELECT
      id, user_id, book_copy_id, processed_by,
      borrowed_at, due_date, returned_at, status,
      returned_by, reminder_sent, overdue_notified,
      fine_amount, fine_settled_at, fine_resolution,
      fine_remarks, fine_settled_by, created_at, updated_at, NOW()
    FROM moved_borrowing
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  SELECT
    (SELECT count(*)::integer FROM inserted_borrowing),
    (SELECT count(*)::integer FROM inserted_attendance)
  INTO v_borrowing_count, v_attendance_count;

  RETURN jsonb_build_object(
    'before', p_before::text,
    'borrowing_count', v_borrowing_count,
    'attendance_count', v_attendance_count,
    'total_count', v_borrowing_count + v_attendance_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_old_logs(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_old_logs(date) TO authenticated, service_role;

COMMIT;
