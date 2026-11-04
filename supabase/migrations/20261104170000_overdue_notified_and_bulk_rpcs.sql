-- B4.2 & B4.4 (docs/AUDIT_CHECKLIST.md): overdue_notified column + SQL RPCs for large lists. Fixes M7, M8, M9, M23.
-- M7: borrowing_records.overdue_notified column so overdue notices are claimed atomically once per loan.
-- M8/M9: annual_student_reset(), get_analytics_summary(p_range) in Asia/Manila time, send_bulk_notifications_by_target().
-- M23: reactivate_users_bulk(p_user_ids) to reactivate profiles and library cards in bulk.
-- Mirrored in supabase/schema_clean_install.sql.
BEGIN;

ALTER TABLE public.borrowing_records
  ADD COLUMN IF NOT EXISTS overdue_notified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS borrowing_records_overdue_unnotified_idx
  ON public.borrowing_records(due_date)
  WHERE status IN ('ACTIVE', 'OVERDUE') AND overdue_notified = false;

-- M8: Annual student reset in one atomic statement (no 1,000-row cap)
CREATE OR REPLACE FUNCTION public.annual_student_reset()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND status = 'ACTIVE' AND role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin can run annual reset';
    END IF;
  END IF;

  WITH updated_profiles AS (
    UPDATE public.profiles
    SET status = 'SUSPENDED', updated_at = NOW()
    WHERE role = 'student'
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM updated_profiles;

  UPDATE public.library_cards lc
  SET status = 'SUSPENDED', updated_at = NOW()
  FROM public.profiles p
  WHERE lc.user_id = p.id
    AND p.role = 'student';

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.annual_student_reset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annual_student_reset() TO authenticated, service_role;

-- M8 & M9: Analytics summary aggregated in SQL in Asia/Manila time (no 1,000-row cap)
CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_range text DEFAULT '30d')
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_now_local         timestamp := NOW() AT TIME ZONE 'Asia/Manila';
  v_group             text;
  v_start_local       timestamp;
  v_end_local         timestamp;
  v_step              interval;
  v_fmt               text;
  v_start_timestamptz timestamptz;
  v_attendance_trends jsonb;
  v_borrowing_trends  jsonb;
  v_peak_hours        jsonb;
  v_category_dist     jsonb;
  v_popular_books     jsonb;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  IF p_range = '7d' THEN
    v_group       := 'day';
    v_start_local := date_trunc('day', v_now_local) - interval '6 days';
    v_end_local   := date_trunc('day', v_now_local);
    v_step        := interval '1 day';
    v_fmt         := 'Mon DD';
  ELSIF p_range = '1y' THEN
    v_group       := 'month';
    v_start_local := date_trunc('month', v_now_local - interval '364 days');
    v_end_local   := date_trunc('month', v_now_local);
    v_step        := interval '1 month';
    v_fmt         := 'Mon YYYY';
  ELSE
    v_group       := 'day';
    v_start_local := date_trunc('day', v_now_local) - interval '29 days';
    v_end_local   := date_trunc('day', v_now_local);
    v_step        := interval '1 day';
    v_fmt         := 'Mon DD';
  END IF;

  v_start_timestamptz := v_start_local AT TIME ZONE 'Asia/Manila';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(s.bucket, v_fmt),
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY s.bucket
  ), '[]'::jsonb)
  INTO v_attendance_trends
  FROM generate_series(v_start_local, v_end_local, v_step) AS s(bucket)
  LEFT JOIN (
    SELECT date_trunc(v_group, check_in_at AT TIME ZONE 'Asia/Manila') AS bucket,
           count(*)::int AS cnt
    FROM public.attendance
    WHERE check_in_at >= v_start_timestamptz
    GROUP BY 1
  ) c ON c.bucket = s.bucket;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(s.bucket, v_fmt),
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY s.bucket
  ), '[]'::jsonb)
  INTO v_borrowing_trends
  FROM generate_series(v_start_local, v_end_local, v_step) AS s(bucket)
  LEFT JOIN (
    SELECT date_trunc(v_group, borrowed_at AT TIME ZONE 'Asia/Manila') AS bucket,
           count(*)::int AS cnt
    FROM public.borrowing_records
    WHERE borrowed_at >= v_start_timestamptz
    GROUP BY 1
  ) c ON c.bucket = s.bucket;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'hour', CASE
        WHEN h.hr = 12 THEN '12 PM'
        WHEN h.hr > 12 THEN (h.hr - 12)::text || ' PM'
        ELSE h.hr::text || ' AM'
      END,
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY h.hr
  ), '[]'::jsonb)
  INTO v_peak_hours
  FROM generate_series(8, 18) AS h(hr)
  LEFT JOIN (
    SELECT EXTRACT(HOUR FROM (check_in_at AT TIME ZONE 'Asia/Manila'))::int AS hr,
           count(*)::int AS cnt
    FROM public.attendance
    WHERE check_in_at >= v_start_timestamptz
      AND EXTRACT(HOUR FROM (check_in_at AT TIME ZONE 'Asia/Manila'))::int BETWEEN 8 AND 18
    GROUP BY 1
  ) c ON c.hr = h.hr;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('name', cat_name, 'value', cnt)
    ORDER BY cnt DESC, cat_name ASC
  ), '[]'::jsonb)
  INTO v_category_dist
  FROM (
    SELECT COALESCE(cat.name, 'General') AS cat_name,
           count(*)::int AS cnt
    FROM public.borrowing_records br
    LEFT JOIN public.book_copies bc ON bc.id = br.book_copy_id
    LEFT JOIN public.books b ON b.id = bc.book_id
    LEFT JOIN public.categories cat ON cat.id = b.category_id
    WHERE br.borrowed_at >= v_start_timestamptz
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', book_id, 'title', title, 'count', cnt)
    ORDER BY cnt DESC, title ASC
  ), '[]'::jsonb)
  INTO v_popular_books
  FROM (
    SELECT b.id AS book_id,
           b.title,
           count(*)::int AS cnt
    FROM public.borrowing_records br
    JOIN public.book_copies bc ON bc.id = br.book_copy_id
    JOIN public.books b ON b.id = bc.book_id
    WHERE br.borrowed_at >= v_start_timestamptz
    GROUP BY b.id, b.title
    ORDER BY cnt DESC, b.title ASC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'attendanceTrends', v_attendance_trends,
    'borrowingTrends', v_borrowing_trends,
    'categoryDistribution', v_category_dist,
    'peakHours', v_peak_hours,
    'popularBooks', v_popular_books
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_analytics_summary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(text) TO authenticated, service_role;

-- M8: Bulk notifications via INSERT ... SELECT (no 1,000-row cap)
CREATE OR REPLACE FUNCTION public.send_bulk_notifications_by_target(
  p_target text,
  p_title text,
  p_content text,
  p_type text DEFAULT 'SYSTEM',
  p_priority text DEFAULT 'high',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  WITH inserted AS (
    INSERT INTO public.notifications (user_id, title, content, type, priority, metadata)
    SELECT
      p.id,
      p_title,
      p_content,
      COALESCE(p_type, 'SYSTEM'),
      COALESCE(p_priority, 'high'),
      COALESCE(p_metadata, '{}'::jsonb)
    FROM public.profiles p
    WHERE p_target = 'all'
       OR (p_target = 'students' AND p.role = 'student')
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_bulk_notifications_by_target(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_bulk_notifications_by_target(text, text, text, text, text, jsonb) TO authenticated, service_role;

-- M23: Bulk re-activate selected users and their library cards
CREATE OR REPLACE FUNCTION public.reactivate_users_bulk(p_user_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role public.user_role;
  v_count       integer;
BEGIN
  IF COALESCE((auth.jwt() ->> 'role'), '') <> 'service_role' AND current_user <> 'service_role' THEN
    IF NOT public.is_manager() THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin or librarian can reactivate users';
    END IF;
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = (SELECT auth.uid());
  ELSE
    v_caller_role := 'super_admin'::public.user_role;
  END IF;

  IF p_user_ids IS NULL OR coalesce(array_length(p_user_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  -- Cards follow only the profiles this call re-activated (librarians: students only).
  WITH updated AS (
    UPDATE public.profiles
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE id = ANY(p_user_ids)
      AND (v_caller_role = 'super_admin'::public.user_role OR role = 'student'::public.user_role)
    RETURNING id
  ), cards AS (
    UPDATE public.library_cards
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE user_id IN (SELECT id FROM updated)
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reactivate_users_bulk(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_users_bulk(uuid[]) TO authenticated, service_role;

COMMIT;

