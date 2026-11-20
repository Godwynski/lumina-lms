CREATE OR REPLACE FUNCTION public.get_analytics_summary_window(p_from date, p_to date)
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

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 366 THEN
    RAISE EXCEPTION 'Choose a valid date range of at most one year';
  END IF;
  v_group := CASE WHEN p_to - p_from > 90 THEN 'month' ELSE 'day' END;
  v_start_local := date_trunc(v_group, p_from::timestamp);
  v_end_local := date_trunc(v_group, p_to::timestamp);
  v_step := CASE WHEN v_group = 'month' THEN interval '1 month' ELSE interval '1 day' END;
  v_fmt := CASE WHEN v_group = 'month' THEN 'Mon YYYY' ELSE 'Mon DD' END;
  v_start_timestamptz := p_from::timestamp AT TIME ZONE 'Asia/Manila';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(s.bucket, v_fmt),
      'from', greatest(s.bucket::date, p_from),
      'to', least((s.bucket + v_step - interval '1 day')::date, p_to),
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY s.bucket
  ), '[]'::jsonb)
  INTO v_attendance_trends
  FROM generate_series(v_start_local, v_end_local, v_step) AS s(bucket)
  LEFT JOIN (
    SELECT date_trunc(v_group, check_in_at AT TIME ZONE 'Asia/Manila') AS bucket,
           count(*)::int AS cnt
    FROM public.attendance
    WHERE check_in_at >= v_start_timestamptz AND check_in_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
    GROUP BY 1
  ) c ON c.bucket = s.bucket;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(s.bucket, v_fmt),
      'from', greatest(s.bucket::date, p_from),
      'to', least((s.bucket + v_step - interval '1 day')::date, p_to),
      'count', COALESCE(c.cnt, 0)
    ) ORDER BY s.bucket
  ), '[]'::jsonb)
  INTO v_borrowing_trends
  FROM generate_series(v_start_local, v_end_local, v_step) AS s(bucket)
  LEFT JOIN (
    SELECT date_trunc(v_group, borrowed_at AT TIME ZONE 'Asia/Manila') AS bucket,
           count(*)::int AS cnt
    FROM public.borrowing_records
    WHERE borrowed_at >= v_start_timestamptz AND borrowed_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
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
    WHERE check_in_at >= v_start_timestamptz AND check_in_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
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
    WHERE br.borrowed_at >= v_start_timestamptz AND br.borrowed_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
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
    WHERE br.borrowed_at >= v_start_timestamptz AND br.borrowed_at < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
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
REVOKE ALL ON FUNCTION public.get_analytics_summary_window(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_summary_window(date,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_analytics_detail(p_from date, p_to date, p_kind text, p_key text DEFAULT '', p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_manager() AND COALESCE(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 366 OR p_page < 1 OR p_kind NOT IN ('hour','period','genre') THEN RAISE EXCEPTION 'Invalid analytics selection'; END IF;
  WITH records AS (
    SELECT a.id, a.check_in_at AS occurred_at, p.id AS borrower_id, p.full_name AS borrower_name,
      p.email, p.student_id, null::uuid AS book_id, null::text AS book_title, 'CHECK_IN'::text AS status
    FROM public.attendance a LEFT JOIN public.profiles p ON p.id=a.user_id
    WHERE p_kind='hour' AND a.check_in_at >= (p_from::timestamp AT TIME ZONE 'Asia/Manila')
      AND a.check_in_at < ((p_to+1)::timestamp AT TIME ZONE 'Asia/Manila')
      AND trim(to_char(a.check_in_at AT TIME ZONE 'Asia/Manila','FMHH12 AM'))=p_key
    UNION ALL
    SELECT br.id, br.borrowed_at, p.id, p.full_name, p.email, p.student_id, b.id, b.title, br.status::text
    FROM public.borrowing_records br LEFT JOIN public.profiles p ON p.id=br.user_id
      LEFT JOIN public.book_copies bc ON bc.id=br.book_copy_id LEFT JOIN public.books b ON b.id=bc.book_id
      LEFT JOIN public.categories c ON c.id=b.category_id
    WHERE p_kind IN ('period','genre') AND br.borrowed_at >= (p_from::timestamp AT TIME ZONE 'Asia/Manila')
      AND br.borrowed_at < ((p_to+1)::timestamp AT TIME ZONE 'Asia/Manila')
      AND (p_kind='period' OR coalesce(c.name,'General')=p_key)
  ), page AS (SELECT * FROM records ORDER BY occurred_at DESC,id LIMIT 20 OFFSET (p_page-1)*20)
  SELECT jsonb_build_object('total', (SELECT count(*) FROM records), 'rows', coalesce((SELECT jsonb_agg(to_jsonb(page)) FROM page),'[]'::jsonb)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_analytics_detail(date,date,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_detail(date,date,text,text,integer) TO authenticated, service_role;
